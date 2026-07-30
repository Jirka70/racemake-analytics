import { describe, expect, test } from "bun:test";
import { generateSpaTelemetryPayload } from "../../scripts/generate-spa-dataset";
import { selectCornerDetectionLaps } from "../../src/analytics/corner-detect/select-corner-detection-laps";
import { runTelemetryAuditPipeline } from "../../src/application/telemetry-audit-pipeline";
import { DEFAULT_FRAME_AUDIT_CONFIG } from "../../src/config/frame-audit-config";
import { telemetryPayloadSchema } from "../../src/http/schemas/telemetry-payload";

const generatedDatasetPath = `${import.meta.dir}/../../data/spa-synthetic.telemetry.json`;

describe("synthetic Spa-like telemetry dataset", () => {
	test("is deterministic, wire-valid, and checked in up to date", async () => {
		const generated = generateSpaTelemetryPayload();
		const generatedAgain = generateSpaTelemetryPayload();
		const checkedInPayload: unknown =
			await Bun.file(generatedDatasetPath).json();

		expect(generated).toEqual(generatedAgain);
		expect(checkedInPayload).toEqual(generated);
		expect(() => telemetryPayloadSchema.parse(generated)).not.toThrow();
		expect(generated.frame_count).toBe(generated.frames.length);
		expect(generated.frames.length).toBeGreaterThan(10_000);
	});

	test("keeps four racing laps while preserving local corner-detection gaps", () => {
		const result = runTelemetryAuditPipeline(
			generateSpaTelemetryPayload(),
			DEFAULT_FRAME_AUDIT_CONFIG,
		);
		const issueCodes = result.auditResult.issues.map(({ code }) => code);
		const includedLaps = result.lapDetectionResult.includedRacingLaps;
		const selectedCornerLaps = selectCornerDetectionLaps(result.lapDetectionResult);

		expect(issueCodes).toContain("DUPLICATE_SAMPLE");
		expect(issueCodes).toContain("LOCAL_OUTLIER");
		expect(issueCodes).toContain("SAMPLING_GAP");
		expect(includedLaps).toHaveLength(4);
		expect(result.lapDetectionResult.fragments).toHaveLength(2);
		expect(includedLaps.every(({ realRacingLap }) => realRacingLap)).toBeTrue();
		expect(includedLaps.filter(({ cornerModelEligible }) => cornerModelEligible)).toHaveLength(3);

		const locallySupportedLap = includedLaps.find(({ cornerModelEligible }) => !cornerModelEligible);
		const locallySupportedLapGrid = result.lapDetectionResult.lapGridSupport.find(
			({ lapId }) => lapId === locallySupportedLap?.id,
		);

		expect(locallySupportedLap).toBeDefined();
		expect(locallySupportedLapGrid).toBeDefined();
		expect(locallySupportedLapGrid?.cornerDetectionSupportedCellMask).toHaveLength(
			result.lapDetectionResult.linearGrid?.cellCount ?? 0,
		);
		expect(
			locallySupportedLapGrid?.cornerDetectionSupportedCellMask.some((supported) => !supported),
		).toBeTrue();
		expect(locallySupportedLap?.confidence.limitations).toContainEqual(
			expect.objectContaining({ code: "PARTIAL_CORNER_GRID_SUPPORT" }),
		);
		expect(selectedCornerLaps).toHaveLength(4);
		expect(
			selectedCornerLaps.filter(({ eligibility }) => eligibility === "corner-eligible"),
		).toHaveLength(3);

		const selectedPartialLap = selectedCornerLaps.find(
			({ eligibility }) => eligibility === "real-racing-lap",
		);

		expect(selectedPartialLap?.supportedCellMask.some((supported) => !supported)).toBeTrue();
		expect(
			includedLaps.every(
				({ positionComparisonEligible }) => positionComparisonEligible,
			),
		).toBeTrue();
		expect(
			new Set(includedLaps.map(({ lapTimeMs }) => Math.round(lapTimeMs))).size,
		).toBe(includedLaps.length);
	});
});
