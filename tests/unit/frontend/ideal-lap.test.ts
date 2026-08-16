import { describe, expect, test } from "bun:test";
import {
	createIdealLapDefinition,
	createIdealLapElapsedMs,
	createIdealLapValues,
	createTelemetrySeriesLapNumbers,
	findIdealLapRegionSourceAtPosition,
} from "../../../frontend/src/analysis/ideal-lap";
import type {
	AnalysisId,
	SeriesResponse,
	TimeLossResponse,
	TrackRegionResponse,
} from "../../../src/http/contracts";

const ANALYSIS_ID = `sha256:${"a".repeat(64)}` as AnalysisId;

const TRACK_REGIONS: readonly TrackRegionResponse[] = [
	{
		type: "straight",
		id: "C1-C2",
		previousCornerId: "C1",
		nextCornerId: "C2",
		interval: {
			startNormalizedTrackPosition: 0.25,
			endNormalizedTrackPosition: 0.75,
			crossesStartFinishLine: false,
		},
	},
	{
		type: "straight",
		id: "C2-C1",
		previousCornerId: "C2",
		nextCornerId: "C1",
		interval: {
			startNormalizedTrackPosition: 0.75,
			endNormalizedTrackPosition: 0.25,
			crossesStartFinishLine: true,
		},
	},
];

const TIME_LOSS: TimeLossResponse = {
	analysisId: ANALYSIS_ID,
	sessionId: "session",
	fastestLap: { lapNumber: 4, lapTimeMs: 800 },
	idealLap: {
		durationMs: 1_000,
		basis: "fastest-observed-pass-per-region",
	},
	laps: [
		{
			lapNumber: 2,
			lapTimeMs: 1_000,
			timeLossToFastestLapMs: 200,
			timeLossToIdealLapMs: 0,
			regions: [
				{
					regionId: "C1-C2",
					regionDurationMs: 600,
					fastestObservedPass: { lapNumber: 2, durationMs: 600 },
					timeLossToFastestObservedPassMs: 0,
					cumulativeTimeLossToIdealLapMs: 0,
					limitations: [],
				},
				{
					regionId: "C2-C1",
					regionDurationMs: 400,
					fastestObservedPass: { lapNumber: 4, durationMs: 400 },
					timeLossToFastestObservedPassMs: 0,
					cumulativeTimeLossToIdealLapMs: 0,
					limitations: [],
				},
			],
		},
	],
};

const SERIES: SeriesResponse = {
	analysisId: ANALYSIS_ID,
	sessionId: "session",
	selection: {
		lapNumbers: [2, 3, 4],
		channels: ["speedKmh"],
		positionFrom: 0,
		positionTo: 1,
	},
	grid: {
		normalizedTrackPositions: [0.125, 0.375, 0.625, 0.875],
	},
	laps: [
		{
			lapNumber: 2,
			lapTimeMs: 1_000,
			lapElapsedMs: [125, 375, 625, 875],
			channels: { speedKmh: [20, 21, 22, 23] },
		},
		{
			lapNumber: 3,
			lapTimeMs: 1_100,
			lapElapsedMs: [137.5, 412.5, 687.5, 962.5],
			channels: { speedKmh: [30, 31, 32, 33] },
		},
		{
			lapNumber: 4,
			lapTimeMs: 800,
			lapElapsedMs: [100, 300, 500, 700],
			channels: { speedKmh: [40, 41, 42, 43] },
		},
	],
};

describe("ideal lap chart data", () => {
	test("derives the source lap for every track region", () => {
		const idealLap = createIdealLapDefinition(TIME_LOSS, TRACK_REGIONS);

		expect(
			idealLap?.regions.map(({ region, sourceLapNumber }) => [
				region.id,
				sourceLapNumber,
			]),
		).toEqual([
			["C1-C2", 2],
			["C2-C1", 4],
		]);
		expect(createTelemetrySeriesLapNumbers(3, 2, idealLap)).toEqual([3, 2, 4]);
	});

	test("uses the source lap belonging to the current region", () => {
		const idealLap = createIdealLapDefinition(TIME_LOSS, TRACK_REGIONS);
		if (idealLap === null) throw new Error("Expected an ideal lap definition");

		const values = createIdealLapValues(
			SERIES,
			idealLap,
			(lap, index) => lap.channels.speedKmh?.[index] ?? null,
		);

		expect(values).toEqual([40, 21, 22, 43]);
		expect(findIdealLapRegionSourceAtPosition(idealLap, 0.25)?.region.id).toBe(
			"C1-C2",
		);
		expect(findIdealLapRegionSourceAtPosition(idealLap, 0.9)?.region.id).toBe(
			"C2-C1",
		);
	});

	test("stitches region timing into one continuous theoretical lap", () => {
		const idealLap = createIdealLapDefinition(TIME_LOSS, TRACK_REGIONS);
		if (idealLap === null) throw new Error("Expected an ideal lap definition");

		expect(createIdealLapElapsedMs(SERIES, idealLap)).toEqual([
			100, 350, 650, 900,
		]);
	});
});
