import { describe, expect, test } from "bun:test";
import { calculateTelemetryChartScrollTop } from "../../../frontend/src/analysis/telemetry-chart-scroll";

describe("telemetry chart wheel scrolling", () => {
	test("preserves small pixel deltas from a trackpad", () => {
		expect(
			calculateTelemetryChartScrollTop({
				currentScrollTop: 10,
				maximumScrollTop: 200,
				deltaY: 3.5,
				deltaMode: 0,
				pageHeightPx: 400,
			}),
		).toBe(13.5);
	});

	test("converts line-based mouse wheel movement to pixels", () => {
		expect(
			calculateTelemetryChartScrollTop({
				currentScrollTop: 20,
				maximumScrollTop: 200,
				deltaY: 3,
				deltaMode: 1,
				pageHeightPx: 400,
			}),
		).toBe(68);
	});

	test("supports movement in both directions and clamps at the edges", () => {
		expect(
			calculateTelemetryChartScrollTop({
				currentScrollTop: 4,
				maximumScrollTop: 72,
				deltaY: -12,
				deltaMode: 0,
				pageHeightPx: 400,
			}),
		).toBe(0);
		expect(
			calculateTelemetryChartScrollTop({
				currentScrollTop: 60,
				maximumScrollTop: 72,
				deltaY: 120,
				deltaMode: 0,
				pageHeightPx: 400,
			}),
		).toBe(72);
	});
});
