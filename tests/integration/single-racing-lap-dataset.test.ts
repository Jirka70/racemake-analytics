import { describe, expect, test } from "bun:test";
import {
	createSingleRacingLapTelemetryPayload,
	SINGLE_RACING_LAP_SESSION_ID,
} from "../../scripts/generate-single-racing-lap-dataset";
import { runTelemetryAuditPipeline } from "../../src/application/telemetry-audit-pipeline";
import { DEFAULT_FRAME_AUDIT_CONFIG } from "../../src/config/frame-audit-config";
import { createInMemoryAnalysisStore } from "../../src/http/analysis-store";
import { getFragmentSeries } from "../../src/http/get-fragment-series";
import { getLaps } from "../../src/http/get-laps";
import { ingestTelemetryAnalysis } from "../../src/http/ingest-telemetry-analysis";
import { telemetryPayloadSchema } from "../../src/http/schemas/telemetry-payload";

const sourceDatasetPath = `${import.meta.dir}/../../data/stint.telemetry.json`;
const generatedDatasetPath = `${import.meta.dir}/../../data/stint-single-racing-lap.telemetry.json`;

describe("single-racing-lap stint fixture", () => {
	test("is deterministic, wire-valid, and checked in up to date", async () => {
		const source: unknown = await Bun.file(sourceDatasetPath).json();
		const validatedSource = telemetryPayloadSchema.parse(source);
		const generated = createSingleRacingLapTelemetryPayload(validatedSource);
		const checkedInPayload: unknown =
			await Bun.file(generatedDatasetPath).json();

		expect(checkedInPayload).toEqual(generated);
		expect(generated.session_id).toBe(SINGLE_RACING_LAP_SESSION_ID);
		expect(generated.frame_count).toBe(generated.frames.length);
		expect(() => telemetryPayloadSchema.parse(generated)).not.toThrow();
	});

	test("contains exactly one racing lap and both surrounding fragments", async () => {
		const input: unknown = await Bun.file(generatedDatasetPath).json();
		const payload = telemetryPayloadSchema.parse(input);
		const analysis = runTelemetryAuditPipeline(
			payload,
			DEFAULT_FRAME_AUDIT_CONFIG,
		);

		expect(
			analysis.coachCallsResult.racingLaps.map(({ lapNumber }) => lapNumber),
		).toEqual([1]);
		expect(analysis.cornerDetectionResult.corners).toHaveLength(7);
		expect(
			analysis.coachCallsResult.trackRegions.filter(
				({ type }) => type === "corner",
			),
		).toHaveLength(7);
		expect(analysis.lapDetectionResult.lapFragments).toHaveLength(2);
		expect(
			analysis.lapDetectionResult.lapFragments[0]?.startPosition,
		).toBeCloseTo(0.4);
		expect(
			analysis.lapDetectionResult.lapFragments[0]?.endPosition,
		).toBeCloseTo(1);
		expect(
			analysis.lapDetectionResult.lapFragments[1]?.startPosition,
		).toBeCloseTo(0);
		expect(
			analysis.lapDetectionResult.lapFragments[1]?.endPosition,
		).toBeCloseTo(0.42, 1);
	});

	test("returns fragment telemetry only inside the fragment's recorded range", async () => {
		const input: unknown = await Bun.file(generatedDatasetPath).json();
		const analysisStore = createInMemoryAnalysisStore({ maximumEntryCount: 1 });
		const ingest = ingestTelemetryAnalysis(input, {
			analysisStore,
			frameAuditConfig: DEFAULT_FRAME_AUDIT_CONFIG,
		});
		const query = { analysisId: ingest.analysisId };
		const laps = getLaps(query, analysisStore);
		const series = getFragmentSeries(
			{
				...query,
				fragment: "0",
				channels: "speedKmh,throttleRatio,brakeRatio,steeringDegrees",
			},
			analysisStore,
		);

		expect(laps.fragments[0]).toEqual({
			startPosition: 0.4,
			endPosition: 1,
		});
		expect(series.fragment).toEqual(laps.fragments[0]);
		expect(series.selection.fragmentIndex).toBe(0);
		expect(series.grid.normalizedTrackPositions.length).toBeGreaterThan(0);
		expect(series.channels.speedKmh).toHaveLength(
			series.grid.normalizedTrackPositions.length,
		);

		const beforeFragmentIndexes = series.grid.normalizedTrackPositions.flatMap(
			(position, index) => (position < 0.4 ? [index] : []),
		);
		const insideFragmentIndexes = series.grid.normalizedTrackPositions.flatMap(
			(position, index) => (position >= 0.4 ? [index] : []),
		);

		expect(
			beforeFragmentIndexes.every(
				(index) => series.channels.speedKmh?.[index] === null,
			),
		).toBeTrue();
		expect(
			insideFragmentIndexes.some(
				(index) => series.channels.speedKmh?.[index] !== null,
			),
		).toBeTrue();
	});
});
