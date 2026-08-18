import { describe, expect, test } from "bun:test";
import {
	calculateTelemetryChartScrollTop,
	calculateTelemetryRegionScrollLeft,
	resolveTelemetryWheelScrollTarget,
} from "../../../frontend/src/analysis/telemetry-chart-scroll";

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

	test("scrolls the compact workspace when the pointer is over the chart", () => {
		expect(
			resolveTelemetryWheelScrollTarget({
				isCompact: true,
				chart: {
					currentScrollTop: 0,
					maximumScrollTop: 0,
					pageHeightPx: 390,
				},
				workspace: {
					currentScrollTop: 120,
					maximumScrollTop: 640,
					pageHeightPx: 720,
				},
				deltaY: 96,
				deltaMode: 0,
			}),
		).toEqual({ target: "workspace", nextScrollTop: 216 });
	});

	test("keeps desktop wheel movement inside the chart stack", () => {
		expect(
			resolveTelemetryWheelScrollTarget({
				isCompact: false,
				chart: {
					currentScrollTop: 40,
					maximumScrollTop: 300,
					pageHeightPx: 520,
				},
				workspace: {
					currentScrollTop: 100,
					maximumScrollTop: 600,
					pageHeightPx: 720,
				},
				deltaY: 80,
				deltaMode: 0,
			}),
		).toEqual({ target: "chart", nextScrollTop: 120 });
	});

	test("converts a vertical wheel gesture into bounded corner-band movement", () => {
		expect(
			calculateTelemetryRegionScrollLeft({
				currentScrollLeft: 40,
				maximumScrollLeft: 180,
				deltaX: 0,
				deltaY: 80,
			}),
		).toBe(120);
		expect(
			calculateTelemetryRegionScrollLeft({
				currentScrollLeft: 160,
				maximumScrollLeft: 180,
				deltaX: 0,
				deltaY: 80,
			}),
		).toBe(180);
		expect(
			calculateTelemetryRegionScrollLeft({
				currentScrollLeft: 40,
				maximumScrollLeft: 180,
				deltaX: 90,
				deltaY: 20,
			}),
		).toBe(40);
	});
});
