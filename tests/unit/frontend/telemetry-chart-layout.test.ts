import { describe, expect, test } from "bun:test";
import { getTelemetryChartPlotInsets } from "../../../frontend/src/analysis/telemetry-chart-layout";

describe("telemetry chart plot layout", () => {
	test("keeps desktop chart and overlay insets on one shared geometry", () => {
		expect(getTelemetryChartPlotInsets("desktop")).toEqual({
			topPx: 18,
			rightPx: 18,
			bottomPx: 38,
			leftPx: 102,
		});
	});

	test("uses the compact ECharts grid inset for every overlay", () => {
		expect(getTelemetryChartPlotInsets("compact")).toEqual({
			topPx: 16,
			rightPx: 12,
			bottomPx: 36,
			leftPx: 72,
		});
	});
});
