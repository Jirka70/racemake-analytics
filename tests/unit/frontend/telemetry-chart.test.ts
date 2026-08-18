import { describe, expect, test } from "bun:test";
import { createTelemetryChartModel } from "../../../frontend/src/analysis/telemetry-chart";
import type {
	AnalysisId,
	AvailableIdealLapResponse,
	SeriesResponse,
} from "../../../src/http/contracts";

const SERIES: SeriesResponse = {
	analysisId: `sha256:${"a".repeat(64)}` as AnalysisId,
	sessionId: "session",
	selection: {
		lapNumbers: [2, 3],
		channels: [
			"speedKmh",
			"throttleRatio",
			"brakeRatio",
			"steeringDegrees",
			"gear",
			"engineRpm",
			"tyreCoreTemperatureC",
		],
		positionFrom: 0,
		positionTo: 1,
	},
	grid: {
		normalizedTrackPositions: [0, 0.5, 1],
	},
	laps: [
		{
			lapNumber: 2,
			lapTimeMs: 900,
			lapElapsedMs: [20, 420, 920],
			channels: {
				speedKmh: [200, 180, 210],
				throttleRatio: [1, 0.5, 1],
				brakeRatio: [0, 0.2, 0],
				steeringDegrees: [5, 20, -30],
				gear: [6, 4, 6],
				engineRpm: [7_000, 5_000, 7_500],
				tyreCoreTemperatureC: {
					frontLeft: [90, 91, 92],
					frontRight: [91, 92, 93],
					rearLeft: [88, 89, 90],
					rearRight: [89, 90, 91],
				},
			},
		},
		{
			lapNumber: 3,
			lapTimeMs: 1_000,
			lapElapsedMs: [10, 510, 1_010],
			channels: {
				speedKmh: [205, 170, null],
				throttleRatio: [1, 0, 0.8],
				brakeRatio: [0, 0.45, 0],
				steeringDegrees: [10, null, -40],
				gear: [6, 3, 6],
				engineRpm: [7_100, 4_800, 7_400],
				tyreCoreTemperatureC: {
					frontLeft: [92, 93, 94],
					frontRight: [93, 94, 95],
					rearLeft: [90, 91, 92],
					rearRight: [91, 92, 93],
				},
			},
		},
	],
};

const IDEAL_LAP: AvailableIdealLapResponse = {
	analysisId: SERIES.analysisId,
	sessionId: SERIES.sessionId,
	status: "available",
	durationMs: 800,
	basis: "fastest-observed-pass-per-region",
	selection: {
		channels: SERIES.selection.channels,
		positionFrom: 0,
		positionTo: 1,
	},
	grid: SERIES.grid,
	lapElapsedMs: [5, 405, 805],
	channels: {
		speedKmh: [210, 190, 220],
		throttleRatio: [1, 0.2, 1],
		brakeRatio: [0, 0.3, 0],
		steeringDegrees: [4, 18, -25],
		gear: [6, 4, 6],
		engineRpm: [7_200, 5_200, 7_700],
	},
	regionSources: [],
};

describe("telemetry chart model", () => {
	test("creates review charts for one lap without inventing a time delta", () => {
		const singleLapSeries: SeriesResponse = {
			...SERIES,
			selection: { ...SERIES.selection, lapNumbers: [3] },
			laps: SERIES.laps.filter((lap) => lap.lapNumber === 3),
		};

		const model = createTelemetryChartModel(singleLapSeries, 3, null);

		expect(model?.timeDelta).toBeNull();
		expect(model?.idealTimeDelta).toBeNull();
		expect(model?.speed?.map((line) => line.name)).toEqual(["Lap 3"]);
		expect(model?.pedals?.map((line) => line.name)).toEqual(["Lap 3"]);
		expect(model?.steering?.map((line) => line.name)).toEqual(["Lap 3"]);
	});

	test("creates aligned time delta and four telemetry channels", () => {
		const model = createTelemetryChartModel(SERIES, 3, 2);

		expect(model?.timeDelta?.points).toEqual([
			[0, 0],
			[50, 0.1],
			[100, 0.1],
		]);
		expect(model?.speed?.map((line) => line.name)).toEqual(["Lap 3", "Lap 2"]);
		expect(model?.steering?.[0].points[1]).toEqual([50, null]);
	});

	test("draws one dominant pedal trace per lap around the shared zero line", () => {
		const model = createTelemetryChartModel(SERIES, 3, 2);

		expect(model?.pedals?.[0].points).toEqual([
			[0, 100],
			[50, -45],
			[100, 80],
		]);
		expect(model?.pedals?.[1].points[1]).toEqual([50, 50]);
	});

	test("rounds visual ranges outward without clipping measurements", () => {
		const model = createTelemetryChartModel(SERIES, 3, 2);

		expect(model?.maximumAbsoluteTimeDeltaSeconds).toBe(0.1);
		expect(model?.maximumSpeedKmh).toBe(250);
		expect(model?.maximumAbsoluteSteeringDegrees).toBe(50);
	});

	test("keeps the model usable when one requested chart channel is absent", () => {
		const incompleteSeries: SeriesResponse = {
			...SERIES,
			laps: SERIES.laps.map((lap) =>
				lap.lapNumber === 3
					? { ...lap, channels: { speedKmh: lap.channels.speedKmh } }
					: lap,
			),
		};

		const model = createTelemetryChartModel(incompleteSeries, 3, 2);

		expect(model?.speed).not.toBeNull();
		expect(model?.pedals).toBeNull();
		expect(model?.steering).toBeNull();
	});

	test("creates gear, RPM, and per-tyre comparison lines", () => {
		const model = createTelemetryChartModel(SERIES, 3, 2);

		expect(model?.gear?.[0].points[1]).toEqual([50, 3]);
		expect(model?.rpm?.[1].points[2]).toEqual([100, 7_500]);
		expect(model?.tyreTemperatures?.map((line) => line.name)).toEqual([
			"Lap 3 FL",
			"Lap 2 FL",
			"Lap 3 FR",
			"Lap 2 FR",
			"Lap 3 RL",
			"Lap 2 RL",
			"Lap 3 RR",
			"Lap 2 RR",
		]);
	});

	test("uses the separately fetched ideal lap instead of source laps in series", () => {
		const model = createTelemetryChartModel(SERIES, 3, 2, IDEAL_LAP);

		expect(model?.speed?.map((line) => line.name)).toEqual([
			"Lap 3",
			"Lap 2",
			"Ideal",
		]);
		expect(model?.speed?.[2]?.points).toEqual([
			[0, 210],
			[50, 190],
			[100, 220],
		]);
		expect(model?.idealTimeDelta?.points).toEqual([
			[0, 0],
			[50, 0],
			[100, -0.1],
		]);
	});
});
