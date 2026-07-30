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

	test("exercises audit cases without invalidating the four complete laps", () => {
		const result = runTelemetryAuditPipeline(
			generateSpaTelemetryPayload(),
			DEFAULT_FRAME_AUDIT_CONFIG,
		);
		const issueCodes = result.auditResult.issues.map(({ code }) => code);
		const includedLaps = result.lapDetectionResult.includedRacingLaps;

		expect(issueCodes).toContain("DUPLICATE_SAMPLE");
		expect(issueCodes).toContain("LOCAL_OUTLIER");
		expect(issueCodes).toContain("SAMPLING_GAP");
		expect(includedLaps).toHaveLength(4);
		expect(result.lapDetectionResult.fragments).toHaveLength(2);
		expect(includedLaps.every(({ realRacingLap }) => realRacingLap)).toBeTrue();
		expect(
			includedLaps.every(({ cornerModelEligible }) => cornerModelEligible),
		).toBeTrue();
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
