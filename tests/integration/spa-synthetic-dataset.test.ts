import { describe, expect, test } from "bun:test";
import { generateSpaTelemetryPayload } from "../../scripts/generate-spa-dataset";
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

	test("keeps audit evidence and derives a position calibration", () => {
		const result = runTelemetryAuditPipeline(
			generateSpaTelemetryPayload(),
			DEFAULT_FRAME_AUDIT_CONFIG,
		);
		const issueCodes = result.auditResult.issues.map(({ code }) => code);

		expect(issueCodes).toContain("DUPLICATE_SAMPLE");
		expect(issueCodes).toContain("LOCAL_OUTLIER");
		expect(issueCodes).toContain("SAMPLING_GAP");
		expect(result.lapDetectionResult.positionCalibration).not.toBeNull();
		expect(result.lapDetectionResult.linearizedLaps).toHaveLength(result.lapDetectionResult.laps.length);
		for (const lap of result.lapDetectionResult.linearizedLaps) {
			expect(lap.elapsedTimestampsMs).toHaveLength(result.lapDetectionResult.linearGrid?.positions.length ?? 0);
			expect(lap.steeringDegrees).toHaveLength(result.lapDetectionResult.linearGrid?.positions.length ?? 0);
		}
	});
});
