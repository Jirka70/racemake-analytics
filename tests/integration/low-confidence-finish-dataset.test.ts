import { describe, expect, test } from "bun:test";
import {
	createLowConfidenceFinishTelemetryPayload,
	LOW_CONFIDENCE_FINISH_SESSION_ID,
} from "../../scripts/generate-low-confidence-finish-dataset";
import { auditTelemetry } from "../../src/analytics/audit-telemetry";
import { DEFAULT_LAP_DETECTION_CONFIG } from "../../src/analytics/lap-detect/config/lap-detection-config";
import { detectLaps } from "../../src/analytics/lap-detect/detect-laps";
import { normalizeTelemetryPayload } from "../../src/analytics/normalize-telemetry";
import { DEFAULT_FRAME_AUDIT_CONFIG } from "../../src/config/frame-audit-config";
import { createInMemoryAnalysisStore } from "../../src/http/analysis-store";
import { getLaps } from "../../src/http/get-laps";
import { getSeries } from "../../src/http/get-series";
import { ingestTelemetryAnalysis } from "../../src/http/ingest-telemetry-analysis";
import { telemetryPayloadSchema } from "../../src/http/schemas/telemetry-payload";

const sourceDatasetPath = `${import.meta.dir}/../../data/stint.telemetry.json`;
const generatedDatasetPath = `${import.meta.dir}/../../data/stint-low-confidence-finish.telemetry.json`;

describe("low-confidence finish stint fixture", () => {
	test("is deterministic, wire-valid, and checked in up to date", async () => {
		const source: unknown = await Bun.file(sourceDatasetPath).json();
		const validatedSource = telemetryPayloadSchema.parse(source);
		const generated = createLowConfidenceFinishTelemetryPayload(validatedSource);
		const generatedAgain =
			createLowConfidenceFinishTelemetryPayload(validatedSource);
		const checkedInPayload: unknown =
			await Bun.file(generatedDatasetPath).json();

		expect(generated).toEqual(generatedAgain);
		expect(checkedInPayload).toEqual(generated);
		expect(generated.session_id).toBe(LOW_CONFIDENCE_FINISH_SESSION_ID);
		expect(generated.frame_count).toBe(generated.frames.length);
		expect(generated.frames.length).toBeLessThan(validatedSource.frames.length);
		expect(() => telemetryPayloadSchema.parse(generated)).not.toThrow();
	});

	test("keeps the finish detectable but rejects its lap only for low boundary confidence", async () => {
		const input: unknown = await Bun.file(generatedDatasetPath).json();
		const payload = telemetryPayloadSchema.parse(input);
		const audit = auditTelemetry(
			normalizeTelemetryPayload(payload),
			DEFAULT_FRAME_AUDIT_CONFIG,
		);
		const lapDetection = detectLaps(audit);
		const rejectedResults = lapDetection.lapEligibilityResults.filter(
			({ eligibility }) => !eligibility.timeEligible.eligible,
		);
		const rejectedResult = rejectedResults[0];
		if (!rejectedResult) throw new Error("Expected one rejected lap");
		const rejectedLap = lapDetection.laps.find(
			({ lapNumber }) => lapNumber === rejectedResult.lapNumber,
		);
		if (!rejectedLap) throw new Error("Expected the rejected detected lap");

		const minimumBoundaryConfidence =
			DEFAULT_LAP_DETECTION_CONFIG.eligibility.time.minimumBoundaryConfidence;
		const minimumLapTimeConfidence =
			DEFAULT_LAP_DETECTION_CONFIG.eligibility.time.minimumLapTimeConfidence;
		const expectedFinishLimitationCodes = [
			"LAP_COUNTER_CONFIRMATION_MISSING",
			"LOCAL_POSITION_RATE_CONTEXT_UNAVAILABLE",
			"POSITION_INTERPOLATION_SPAN_EXCEEDED",
			"POSITION_RATE_LIMIT_EXCEEDED",
		] as const;

		expect(rejectedResults).toHaveLength(1);
		expect(rejectedResult.eligibility.timeEligible.reasons).toEqual([
			{
				code: "BOUNDARY_CONFIDENCE_BELOW_MINIMUM",
				observedValue: rejectedLap.confidence.boundaryConfidence,
				requiredMinimum: minimumBoundaryConfidence,
			},
		]);
		expect(rejectedLap.confidence.boundaryConfidence).toBeLessThan(
			minimumBoundaryConfidence,
		);
		expect(rejectedLap.confidence.lapTimeConfidence).toBeGreaterThanOrEqual(
			minimumLapTimeConfidence,
		);
		expect(rejectedLap.endCrossing.confidence.boundaryConfidence).toBeLessThan(
			minimumBoundaryConfidence,
		);
		expect(rejectedLap.endCrossing.lapCounterEvidence.status).toBe("missing");
		expect(
			rejectedLap.endCrossing.limitations.map(({ code }) => code).sort(),
		).toEqual([...expectedFinishLimitationCodes].sort());
		expect(
			lapDetection.lapEligibilityResults.filter(
				({ eligibility }) => eligibility.timeEligible.eligible,
			).length,
		).toBeGreaterThanOrEqual(2);
	});

	test("returns the limited lap for recorded-section review without ranking its time", async () => {
		const input: unknown = await Bun.file(generatedDatasetPath).json();
		const analysisStore = createInMemoryAnalysisStore({ maximumEntryCount: 1 });
		const ingest = ingestTelemetryAnalysis(input, {
			analysisStore,
			frameAuditConfig: DEFAULT_FRAME_AUDIT_CONFIG,
		});
		const query = { analysisId: ingest.analysisId };
		const response = getLaps(query, analysisStore);
		const limitedLaps = response.laps.filter(
			({ quality }) => quality.status === "limited",
		);
		const limitedLap = limitedLaps.find(({ quality }) =>
			quality.limitations.some(
				({ code }) => code === "FINISH_BOUNDARY_UNCERTAIN",
			),
		);
		if (limitedLap?.quality.status !== "limited") {
			throw new Error("Expected a limited lap with an uncertain finish");
		}
		const finishLimitation = limitedLap.quality.limitations.find(
			(limitation) => limitation.code === "FINISH_BOUNDARY_UNCERTAIN",
		);
		if (finishLimitation?.code !== "FINISH_BOUNDARY_UNCERTAIN") {
			throw new Error("Expected finish-boundary evidence");
		}

		expect(limitedLaps).toHaveLength(2);
		expect(limitedLap.timing.status).toBe("unverified");
		expect(limitedLap.usage).toEqual({
			telemetryReview: "recorded-sections-only",
			lapTimeComparison: "excluded",
			lapRanking: "excluded",
			coaching: "none",
		});
		expect(limitedLap.quality.summary).toBe(
			"Finish crossing was not captured clearly.",
		);
		expect(limitedLap.coverage.capturedRatio).toBeGreaterThan(0.98);
		expect(limitedLap.confidence.lap.boundary).toBeLessThan(
			DEFAULT_LAP_DETECTION_CONFIG.eligibility.time.minimumBoundaryConfidence,
		);
		expect(finishLimitation.evidence).toMatchObject({
			fromPosition: 0.987,
			toPosition: 0.011,
			transitionDurationMs: 250,
			lapCounterEvidence: "missing",
			usablePositionRateSamplesBefore: 6,
			usablePositionRateSamplesAfter: 0,
		});
		expect(finishLimitation.evidence.reasonCodes).toEqual([
			"POSITION_INTERPOLATION_SPAN_EXCEEDED",
			"POSITION_RATE_LIMIT_EXCEEDED",
			"LAP_COUNTER_CONFIRMATION_MISSING",
			"LOCAL_POSITION_RATE_CONTEXT_UNAVAILABLE",
		]);

		const series = getSeries(
			{
				...query,
				laps: String(limitedLap.lapNumber),
				channels: "speedKmh,brakeRatio",
			},
			analysisStore,
		);
		expect(series.laps).toHaveLength(1);
		expect(series.laps[0]?.lapNumber).toBe(limitedLap.lapNumber);
		expect(
			series.laps[0]?.channels.speedKmh?.some((value) => value !== null),
		).toBeTrue();
	});
});
