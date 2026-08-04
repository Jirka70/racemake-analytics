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

		const aligned = result.cornerDetectionResult.cellAlignedSteering;
		const grid = result.lapDetectionResult.linearGrid;
		expect(aligned.cellCenters).toHaveLength(grid?.cellCount ?? 0);
		expect(aligned.cellCenters.every((center, index) => center === (index + 0.5) / (grid?.cellCount ?? 1))).toBeTrue();
		expect(aligned.laps.map(({ lapNumber }) => lapNumber)).toEqual(
			result.lapDetectionResult.lapEligibilityResults
				.filter(({ eligibility }) => eligibility.realRacing.eligible)
				.map(({ lapNumber }) => lapNumber),
		);

		for (const lap of aligned.laps) {
			expect(lap.steeringDegreesByCell).toHaveLength(aligned.cellCenters.length);
			expect(lap.cornerDetectionSupportedCellMask).toEqual(lap.steeringDegreesByCell.map((value) => value !== null));
			expect(lap.steeringDegreesByCell.every((value) => value === null || Number.isFinite(value))).toBeTrue();
		}

		const profile = result.cornerDetectionResult.trackSteeringProfile;
		expect(profile.selectedLaps.map(({ lapNumber }) => lapNumber)).toEqual(aligned.laps.map(({ lapNumber }) => lapNumber));
		expect(profile.cells).toHaveLength(aligned.cellCenters.length);
		expect(profile.cells.every((cell, index) => cell.cellCenter === aligned.cellCenters[index])).toBeTrue();
		const smoothedProfile = result.cornerDetectionResult.smoothedTrackSteeringProfile;
		expect(smoothedProfile).toMatchObject({ polynomialOrder: 2, windowSize: 5, minimumLapSupport: 2 });
		expect(smoothedProfile.cells).toHaveLength(profile.cells.length);
		expect(smoothedProfile.cells.every(({ smoothedSignedSteeringDegrees }) => Number.isFinite(smoothedSignedSteeringDegrees))).toBeTrue();
		const strengthProfile = result.cornerDetectionResult.steeringStrengthProfile;
		expect(strengthProfile.cells).toHaveLength(smoothedProfile.cells.length);
		expect(strengthProfile.cells.every(({ signedSteeringDegrees, steeringStrengthDegrees }) => signedSteeringDegrees === null
			? steeringStrengthDegrees === null
			: steeringStrengthDegrees === Math.abs(signedSteeringDegrees))).toBeTrue();
		const otsu = result.cornerDetectionResult.steeringStrengthOtsuResult;
		expect(otsu.status).toBe("calculated");
		if (otsu.status !== "calculated") throw new Error("Expected a steering-strength Otsu threshold");
		expect(otsu.diagnostics.lowerClassCount + otsu.diagnostics.upperClassCount).toBe(
			strengthProfile.cells.filter(({ steeringStrengthDegrees }) => steeringStrengthDegrees !== null).length,
		);
		const thresholds = result.cornerDetectionResult.steeringStrengthThresholdResult;
		expect(thresholds.status).toBe("calculated");
		if (thresholds.status !== "calculated") throw new Error("Expected steering-strength hysteresis thresholds");
		expect(thresholds.highThresholdDegrees).toBe(otsu.threshold);
		expect(thresholds.lowThresholdDegrees).toBeLessThanOrEqual(thresholds.highThresholdDegrees);
		for (const candidate of result.cornerDetectionResult.cornerCandidates) {
			expect(candidate.cellIndexes).not.toHaveLength(0);
			expect(candidate.startCellIndex).toBe(candidate.cellIndexes[0]);
			expect(candidate.endCellIndexExclusive).toBe(((candidate.cellIndexes.at(-1) ?? -1) + 1) % strengthProfile.cells.length);
		}
		expect(result.cornerDetectionResult.confirmedCornerCandidates.every(({ confidence }) => confidence > 0.5)).toBeTrue();

		const sampleLap = aligned.laps[0];
		const detectedLap = result.lapDetectionResult.laps.find(({ lapNumber }) => lapNumber === sampleLap?.lapNumber);
		const timeline = result.auditResult.usableTimeline;
		const cellIndex = Math.floor(aligned.cellCenters.length / 2);
		const cellCenter = aligned.cellCenters[cellIndex];
		const transition = timeline?.transitions
			.slice(detectedLap?.startCrossing.transitionIndex, (detectedLap?.endCrossing.transitionIndex ?? -1) + 1)
			.find(({ previous, current }) => previous.normalizedTrackPosition <= cellCenter && current.normalizedTrackPosition >= cellCenter);
		if (!sampleLap || cellCenter === undefined || !transition) throw new Error("Expected one supported cell-aligned steering sample");
		const ratio = (cellCenter - transition.previous.normalizedTrackPosition) / (transition.current.normalizedTrackPosition - transition.previous.normalizedTrackPosition);
		const expectedSteering = transition.previous.steeringDegrees + ratio * (transition.current.steeringDegrees - transition.previous.steeringDegrees);
		expect(sampleLap.steeringDegreesByCell[cellIndex]).toBeCloseTo(expectedSteering);
	});
});
