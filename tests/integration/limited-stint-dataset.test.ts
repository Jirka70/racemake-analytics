import { describe, expect, test } from "bun:test";
import {
	createLimitedStintTelemetryPayload,
	LIMITED_STINT_SESSION_ID,
} from "../../scripts/generate-limited-stint-dataset";
import { findAnalysisUsability } from "../../src/application/analysis-usability";
import { runTelemetryAuditPipeline } from "../../src/application/telemetry-audit-pipeline";
import { DEFAULT_FRAME_AUDIT_CONFIG } from "../../src/config/frame-audit-config";
import { telemetryPayloadSchema } from "../../src/http/schemas/telemetry-payload";

const sourceDatasetPath = `${import.meta.dir}/../../data/stint.telemetry.json`;
const generatedDatasetPath = `${import.meta.dir}/../../data/stint-limited.telemetry.json`;

describe("telemetry-gap stint fixture", () => {
	test("is deterministic, wire-valid, and checked in up to date", async () => {
		const source: unknown = await Bun.file(sourceDatasetPath).json();
		const validatedSource = telemetryPayloadSchema.parse(source);
		const generated = createLimitedStintTelemetryPayload(validatedSource);
		const generatedAgain = createLimitedStintTelemetryPayload(validatedSource);
		const checkedInPayload: unknown =
			await Bun.file(generatedDatasetPath).json();

		expect(generated).toEqual(generatedAgain);
		expect(checkedInPayload).toEqual(generated);
		expect(generated.session_id).toBe(LIMITED_STINT_SESSION_ID);
		expect(generated.frame_count).toBe(generated.frames.length);
		expect(validatedSource.frames.length - generated.frames.length).toBe(43);
		expect(() => telemetryPayloadSchema.parse(generated)).not.toThrow();
	});

	test("remains usable and reports the controlled damage as a limitation", async () => {
		const input: unknown = await Bun.file(generatedDatasetPath).json();
		const payload = telemetryPayloadSchema.parse(input);
		const analysis = runTelemetryAuditPipeline(
			payload,
			DEFAULT_FRAME_AUDIT_CONFIG,
		);
		const usability = findAnalysisUsability(analysis);
		const racingLapNumbers = analysis.coachCallsResult.racingLaps.map(
			({ lapNumber }) => lapNumber,
		);
		const excludedLapReason = usability.reasons.find(
			(reason) => reason.code === "LAPS_EXCLUDED_FROM_COMPARISON",
		);
		const timelineReason = usability.reasons.find(
			(reason) => reason.code === "TIMELINE_DISCONTINUITIES",
		);

		expect(usability.status).toBe("usable");
		expect(usability.unavailableCapabilities).toEqual([]);
		expect(usability.availableCapabilities).toEqual([
			"lap-comparison",
			"region-comparison",
			"ideal-lap",
			"coaching",
		]);
		expect(racingLapNumbers).toEqual([1, 2, 3, 4]);
		expect(
			analysis.cornerDetectionResult.cellAlignedSteering.laps.map(
				({ lapNumber }) => lapNumber,
			),
		).toEqual(racingLapNumbers);
		expect(
			analysis.cornerDetectionResult.cellAlignedSteering.laps
				.filter(({ contribution }) => contribution === "supported-cells")
				.map(({ lapNumber }) => lapNumber),
		).toContain(1);
		expect(analysis.cornerDetectionResult.corners).toHaveLength(7);
		expect(excludedLapReason).toBeUndefined();
		expect(timelineReason?.severity).toBe("limitation");
		expect(
			timelineReason?.evidence.discontinuities.flatMap(
				({ affectedLapNumber }) =>
					affectedLapNumber === undefined ? [] : [affectedLapNumber],
			),
		).toEqual([1, 4]);
	});
});
