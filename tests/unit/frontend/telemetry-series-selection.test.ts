import { describe, expect, test } from "bun:test";
import type { TelemetryChartLine } from "../../../frontend/src/analysis/telemetry-chart";
import {
	createTelemetryGuideSelectionClick,
	createTelemetrySeriesSelection,
	findNearestTelemetrySeriesHit,
	findStableTelemetrySeriesHoverHit,
	findTelemetrySeriesClickHit,
	readTelemetrySeriesClick,
} from "../../../frontend/src/analysis/telemetry-series-selection";

const reviewedSpeed: TelemetryChartLine = {
	id: "reviewed-lap-3-speed",
	name: "Lap 3",
	role: "reviewed",
	measurement: "speed",
	points: [
		[40, 220],
		[50, 210],
		[60, 230],
	],
};

const secondSpeed: TelemetryChartLine = {
	id: "second-lap-2-speed",
	name: "Lap 2",
	role: "second",
	measurement: "speed",
	points: [
		[40, 221],
		[50, 209.5],
		[60, 229],
	],
};

describe("telemetry series selection", () => {
	test("creates a guide selection on reviewed speed near the visible demonstration target", () => {
		expect(
			createTelemetryGuideSelectionClick(
				[secondSpeed, reviewedSpeed],
				{ startPercent: 0, endPercent: 100 },
			),
		).toEqual({
			seriesId: reviewedSpeed.id,
			positionPercent: 60,
		});
	});

	test("keeps the guide selection inside the viewport and away from missing samples", () => {
		const damagedReviewed: TelemetryChartLine = {
			...reviewedSpeed,
			points: [
				[40, 220],
				[50, null],
				[60, 230],
			],
		};

		expect(
			createTelemetryGuideSelectionClick([damagedReviewed], {
				startPercent: 45,
				endPercent: 65,
			}),
		).toEqual({
			seriesId: damagedReviewed.id,
			positionPercent: 60,
		});
		expect(
			createTelemetryGuideSelectionClick([damagedReviewed], {
				startPercent: 45,
				endPercent: 55,
			}),
		).toBeNull();
	});

	test("falls back to another visible reviewed series when speed has no usable sample", () => {
		const unavailableSpeed: TelemetryChartLine = {
			...reviewedSpeed,
			points: reviewedSpeed.points.map(([position]) => [position, null]),
		};
		const reviewedSteering: TelemetryChartLine = {
			...reviewedSpeed,
			id: "reviewed-lap-3-steering",
			measurement: "steering",
		};

		expect(
			createTelemetryGuideSelectionClick(
				[unavailableSpeed, secondSpeed, reviewedSteering],
				{ startPercent: 0, endPercent: 100 },
			),
		).toEqual({
			seriesId: reviewedSteering.id,
			positionPercent: 60,
		});
	});

	test("reads a clicked ECharts line point", () => {
		expect(
			readTelemetrySeriesClick({
				componentType: "series",
				seriesId: "reviewed-lap-3-speed",
				value: [47.9, 209.4],
			}),
		).toEqual({
			seriesId: "reviewed-lap-3-speed",
			positionPercent: 47.9,
		});
	});

	test("reads the selected point marker as another click on its series", () => {
		expect(
			readTelemetrySeriesClick({
				componentType: "markPoint",
				seriesId: "reviewed-lap-3-speed",
				data: { coord: [47.9, 209.4] },
			}),
		).toEqual({
			seriesId: "reviewed-lap-3-speed",
			positionPercent: 47.9,
		});
	});

	test("ignores non-series and malformed chart events", () => {
		expect(
			readTelemetrySeriesClick({
				componentType: "xAxis",
				seriesId: "reviewed-lap-3-speed",
				value: [47.9, 209.4],
			}),
		).toBeNull();
		expect(
			readTelemetrySeriesClick({
				componentType: "series",
				seriesId: "reviewed-lap-3-speed",
				value: [Number.NaN, 209.4],
			}),
		).toBeNull();
	});

	test("selects the nearest source point and compares the matching lap", () => {
		const selection = createTelemetrySeriesSelection(
			[reviewedSpeed, secondSpeed],
			{
				seriesId: reviewedSpeed.id,
				positionPercent: 49.8,
			},
			"complete",
		);

		expect(selection).toEqual({
			lineId: reviewedSpeed.id,
			lineName: "Lap 3",
			role: "reviewed",
			measurement: "speed",
			positionPercent: 50,
			value: 210,
			comparison: {
				lineId: secondSpeed.id,
				lineName: "Lap 2",
				role: "second",
				value: 209.5,
			},
			difference: 0.5,
			telemetryStatus: "complete",
		});
	});

	test("reports partial telemetry and never borrows a neighboring comparison value", () => {
		const damagedReviewed: TelemetryChartLine = {
			...reviewedSpeed,
			points: [
				[40, 220],
				[50, 210],
				[60, null],
			],
		};
		const damagedComparison: TelemetryChartLine = {
			...secondSpeed,
			points: [
				[40, 221],
				[50, null],
				[60, 229],
			],
		};

		const selection = createTelemetrySeriesSelection(
			[damagedReviewed, damagedComparison],
			{
				seriesId: damagedReviewed.id,
				positionPercent: 50,
			},
			"partial",
		);

		expect(selection?.telemetryStatus).toBe("partial");
		expect(selection?.comparison?.value).toBeNull();
		expect(selection?.difference).toBeNull();
	});

	test("matches the same tyre when several tyre traces share a grid", () => {
		const reviewedFrontLeft: TelemetryChartLine = {
			...reviewedSpeed,
			id: "reviewed-lap-3-tyre-temperature-frontLeft",
			name: "Lap 3 FL",
			measurement: "tyre-temperature",
		};
		const secondFrontLeft: TelemetryChartLine = {
			...secondSpeed,
			id: "second-lap-2-tyre-temperature-frontLeft",
			name: "Lap 2 FL",
			measurement: "tyre-temperature",
		};
		const secondFrontRight: TelemetryChartLine = {
			...secondFrontLeft,
			id: "second-lap-2-tyre-temperature-frontRight",
			name: "Lap 2 FR",
		};

		const selection = createTelemetrySeriesSelection(
			[reviewedFrontLeft, secondFrontRight, secondFrontLeft],
			{
				seriesId: reviewedFrontLeft.id,
				positionPercent: 50,
			},
			"complete",
		);

		expect(selection?.comparison?.lineId).toBe(secondFrontLeft.id);
	});

	test("uses a generous pixel hit radius and still picks the closest line", () => {
		const hits = [
			{
				seriesId: reviewedSpeed.id,
				positionPercent: 50,
				pixelX: 300,
				pixelY: 200,
			},
			{
				seriesId: secondSpeed.id,
				positionPercent: 50,
				pixelX: 300,
				pixelY: 208,
			},
		];

		expect(findNearestTelemetrySeriesHit(hits, 303, 205, 18)).toEqual({
			seriesId: secondSpeed.id,
			positionPercent: 50,
		});
		expect(findNearestTelemetrySeriesHit(hits, 300, 228, 18)).toBeNull();
	});

	test("keeps a hovered line stable until another line is clearly closer", () => {
		const hits = [
			{
				seriesId: reviewedSpeed.id,
				positionPercent: 50,
				pixelX: 300,
				pixelY: 200,
			},
			{
				seriesId: secondSpeed.id,
				positionPercent: 50,
				pixelX: 300,
				pixelY: 208,
			},
		];

		expect(
			findStableTelemetrySeriesHoverHit(
				hits,
				300,
				205,
				18,
				reviewedSpeed.id,
				4,
			),
		).toEqual({
			seriesId: reviewedSpeed.id,
			positionPercent: 50,
		});
		expect(
			findStableTelemetrySeriesHoverHit(
				hits,
				300,
				207,
				18,
				reviewedSpeed.id,
				4,
			),
		).toEqual({
			seriesId: secondSpeed.id,
			positionPercent: 50,
		});
	});

	test("clicks the visibly highlighted line even when its neighbor is closer", () => {
		const hits = [
			{
				seriesId: reviewedSpeed.id,
				positionPercent: 50,
				pixelX: 300,
				pixelY: 200,
			},
			{
				seriesId: secondSpeed.id,
				positionPercent: 50,
				pixelX: 300,
				pixelY: 208,
			},
		];

		expect(
			findTelemetrySeriesClickHit(hits, 300, 207, 18, reviewedSpeed.id),
		).toEqual({
			seriesId: reviewedSpeed.id,
			positionPercent: 50,
		});
		expect(findTelemetrySeriesClickHit(hits, 300, 207, 18, null)).toBeNull();
		expect(
			findTelemetrySeriesClickHit(hits, 300, 230, 18, reviewedSpeed.id),
		).toBeNull();
	});
});
