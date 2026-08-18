import { describe, expect, test } from "bun:test";
import {
	DEFAULT_VISIBLE_FRAGMENT_TELEMETRY_CHARTS,
	DEFAULT_VISIBLE_TELEMETRY_CHARTS,
	FRAGMENT_TELEMETRY_CHART_IDS,
	getSeriesChannelsForTelemetryCharts,
	toggleTelemetryChart,
} from "../../../frontend/src/analysis/telemetry-chart-selection";

describe("telemetry chart selection", () => {
	test("keeps comparison-only time delta out of fragment chart choices", () => {
		expect(FRAGMENT_TELEMETRY_CHART_IDS).toEqual([
			"speed",
			"pedals",
			"steering",
			"gear",
			"rpm",
			"tyre-temperatures",
		]);
		expect(DEFAULT_VISIBLE_FRAGMENT_TELEMETRY_CHARTS).toEqual([
			"speed",
			"pedals",
			"steering",
		]);
	});

	test("keeps chart order stable when optional charts are enabled", () => {
		const withRpm = toggleTelemetryChart(
			DEFAULT_VISIBLE_TELEMETRY_CHARTS,
			"rpm",
		);
		const withGearAndRpm = toggleTelemetryChart(withRpm, "gear");

		expect(withGearAndRpm).toEqual([
			"time-delta",
			"speed",
			"pedals",
			"steering",
			"gear",
			"rpm",
		]);
	});

	test("does not allow the final visible chart to be hidden", () => {
		expect(toggleTelemetryChart(["speed"], "speed")).toEqual(["speed"]);
	});

	test("requests only the channels required by visible charts", () => {
		expect(
			getSeriesChannelsForTelemetryCharts([
				"time-delta",
				"pedals",
				"rpm",
				"tyre-temperatures",
			]),
		).toEqual([
			"throttleRatio",
			"brakeRatio",
			"engineRpm",
			"tyreCoreTemperatureC",
		]);
	});

	test("keeps the series request valid for a time-delta-only view", () => {
		expect(getSeriesChannelsForTelemetryCharts(["time-delta"])).toEqual([
			"speedKmh",
		]);
	});
});
