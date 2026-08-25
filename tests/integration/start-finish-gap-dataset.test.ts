import { describe, expect, test } from "bun:test";
import {
	createStartFinishGapTelemetryPayload,
	START_FINISH_GAP_SESSION_ID,
} from "../../scripts/generate-start-finish-gap-dataset";
import { auditTelemetry } from "../../src/analytics/audit-telemetry";
import { detectLaps } from "../../src/analytics/lap-detect/detect-laps";
import { normalizeTelemetryPayload } from "../../src/analytics/normalize-telemetry";
import { DEFAULT_FRAME_AUDIT_CONFIG } from "../../src/config/frame-audit-config";
import { createInMemoryAnalysisStore } from "../../src/http/analysis-store";
import { getLaps } from "../../src/http/get-laps";
import { getSeries } from "../../src/http/get-series";
import { ingestTelemetryAnalysis } from "../../src/http/ingest-telemetry-analysis";
import { telemetryPayloadSchema } from "../../src/http/schemas/telemetry-payload";

const sourceDatasetPath = `${import.meta.dir}/../../data/stint.telemetry.json`;
const generatedDatasetPath = `${import.meta.dir}/../../data/stint-start-finish-gap.telemetry.json`;

describe("start/finish sampling-gap stint fixture", () => {
	test("is deterministic, wire-valid, and checked in up to date", async () => {
		const source: unknown = await Bun.file(sourceDatasetPath).json();
		const validatedSource = telemetryPayloadSchema.parse(source);
		const generated = createStartFinishGapTelemetryPayload(validatedSource);
		const generatedAgain =
			createStartFinishGapTelemetryPayload(validatedSource);
		const checkedInPayload: unknown =
			await Bun.file(generatedDatasetPath).json();

		expect(generated).toEqual(generatedAgain);
		expect(checkedInPayload).toEqual(generated);
		expect(generated.session_id).toBe(START_FINISH_GAP_SESSION_ID);
		expect(generated.frame_count).toBe(generated.frames.length);
		expect(generated.frames.length).toBeLessThan(validatedSource.frames.length);
		expect(() => telemetryPayloadSchema.parse(generated)).not.toThrow();
	});

	test("keeps the merged interval reviewable but rejects its apparent lap time", async () => {
		const sourceInput: unknown = await Bun.file(sourceDatasetPath).json();
		const generatedInput: unknown = await Bun.file(generatedDatasetPath).json();
		const sourcePayload = telemetryPayloadSchema.parse(sourceInput);
		const generatedPayload = telemetryPayloadSchema.parse(generatedInput);
		const sourceDetection = detectLaps(
			auditTelemetry(
				normalizeTelemetryPayload(sourcePayload),
				DEFAULT_FRAME_AUDIT_CONFIG,
			),
		);
		const generatedDetection = detectLaps(
			auditTelemetry(
				normalizeTelemetryPayload(generatedPayload),
				DEFAULT_FRAME_AUDIT_CONFIG,
			),
		);
		const affectedLap = generatedDetection.laps.find((lap) =>
			lap.limitations.some(
				(limitation) =>
					limitation.code === "SAMPLING_GAP_WITHIN_LAP" &&
					limitation.mayContainLapBoundary,
			),
		);

		if (!affectedLap) {
			throw new Error("Expected a detected interval spanning start/finish gap");
		}

		const affectedEligibility = generatedDetection.lapEligibilityResults.find(
			({ lapNumber }) => lapNumber === affectedLap.lapNumber,
		)?.eligibility;
		const verifiedLapTimes = generatedDetection.laps
			.filter((lap) => lap.lapNumber !== affectedLap.lapNumber)
			.map((lap) => lap.lapTimeMs);

		expect(generatedDetection.lapCrossings).toHaveLength(
			sourceDetection.lapCrossings.length - 1,
		);
		expect(affectedLap.lapTimeMs).toBeGreaterThan(
			Math.max(...verifiedLapTimes) * 1.5,
		);
		expect(affectedEligibility?.timeEligible).toEqual({
			eligible: false,
			reasons: [{ code: "SAMPLING_GAP_WITHIN_LAP" }],
		});
		expect(affectedEligibility?.realRacing).toEqual(
			affectedEligibility?.timeEligible,
		);
	});

	test("returns the affected lap and its telemetry to the limited-data UI", async () => {
		const input: unknown = await Bun.file(generatedDatasetPath).json();
		const analysisStore = createInMemoryAnalysisStore({ maximumEntryCount: 1 });
		const ingest = ingestTelemetryAnalysis(input, {
			analysisStore,
			frameAuditConfig: DEFAULT_FRAME_AUDIT_CONFIG,
		});
		const query = { analysisId: ingest.analysisId };
		const response = getLaps(query, analysisStore);
		const affectedLap = response.laps.find(
			(lap) =>
				lap.quality.status === "limited" &&
				lap.quality.limitations.some(
					(limitation) =>
						limitation.code === "SAMPLING_GAP_WITHIN_LAP" &&
						limitation.fromPosition > limitation.toPosition,
				),
		);

		if (affectedLap?.quality.status !== "limited") {
			throw new Error("Expected a limited lap spanning start/finish gap");
		}

		const samplingGap = affectedLap.quality.limitations.find(
			(limitation) => limitation.code === "SAMPLING_GAP_WITHIN_LAP",
		);
		if (samplingGap?.code !== "SAMPLING_GAP_WITHIN_LAP") {
			throw new Error("Expected public sampling-gap details");
		}

		expect(affectedLap.timing.status).toBe("unverified");
		expect(affectedLap.usage).toEqual({
			telemetryReview: "recorded-sections-only",
			lapTimeComparison: "excluded",
			lapRanking: "excluded",
			coaching: "none",
		});
		expect(affectedLap.quality.summary).toBe(
			"Recording stopped around start/finish. This duration may contain more than one lap.",
		);
		expect(samplingGap.gapDurationMs).toBeGreaterThan(4_000);
		expect(samplingGap.fromPosition).toBeGreaterThan(0.9);
		expect(samplingGap.toPosition).toBeLessThan(0.1);
		expect("mayContainLapBoundary" in samplingGap).toBeFalse();

		const referenceLap = response.laps.find(
			(lap) => lap.usage.lapTimeComparison === "verified-only",
		);
		if (!referenceLap) throw new Error("Expected a verified reference lap");

		const series = getSeries(
			{
				...query,
				laps: `${affectedLap.lapNumber},${referenceLap.lapNumber}`,
				channels: "speedKmh,brakeRatio,steeringDegrees",
			},
			analysisStore,
		);
		expect(series.laps.map(({ lapNumber }) => lapNumber)).toEqual([
			affectedLap.lapNumber,
			referenceLap.lapNumber,
		]);
		expect(
			series.laps[0]?.channels.speedKmh?.some((value) => value !== null),
		).toBeTrue();
	});
});
