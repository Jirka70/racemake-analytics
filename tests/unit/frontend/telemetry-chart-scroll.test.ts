import { describe, expect, test } from "bun:test";
import {
	calculateTelemetryChartScrollTop,
	calculateTelemetryRegionScrollLeft,
	getTelemetryRegionScrollAffordances,
	resolveTelemetryHorizontalWheelDelta,
	resolveTelemetryWheelGestureAxis,
	resolveTelemetryWheelScrollTarget,
} from "../../../frontend/src/analysis/telemetry-chart-scroll";

describe("telemetry chart wheel scrolling", () => {
	test("routes horizontal trackpad gestures to chart panning", () => {
		expect(
			resolveTelemetryWheelGestureAxis({
				deltaX: 24,
				deltaY: 3,
				shiftKey: false,
				lockedAxis: null,
			}),
		).toBe("horizontal");
	});

	test("routes a normal mouse wheel vertically and Shift+wheel horizontally", () => {
		expect(
			resolveTelemetryWheelGestureAxis({
				deltaX: 0,
				deltaY: 80,
				shiftKey: false,
				lockedAxis: null,
			}),
		).toBe("vertical");
		expect(
			resolveTelemetryWheelGestureAxis({
				deltaX: 0,
				deltaY: 80,
				shiftKey: true,
				lockedAxis: null,
			}),
		).toBe("horizontal");
	});

	test("keeps the initial axis through the low-amplitude gesture tail", () => {
		expect(
			resolveTelemetryWheelGestureAxis({
				deltaX: 0.4,
				deltaY: 0.8,
				shiftKey: false,
				lockedAxis: "horizontal",
			}),
		).toBe("horizontal");
		expect(
			resolveTelemetryWheelGestureAxis({
				deltaX: 0,
				deltaY: 0,
				shiftKey: false,
				lockedAxis: null,
			}),
		).toBeNull();
	});

	test("preserves proportional horizontal trackpad deltas", () => {
		expect(
			resolveTelemetryHorizontalWheelDelta({
				deltaX: 2.5,
				deltaY: 0.2,
				deltaMode: 0,
				pageWidthPx: 800,
				shiftKey: false,
			}),
		).toBe(2.5);
	});

	test("maps Shift plus a line-based mouse wheel to horizontal pixels", () => {
		expect(
			resolveTelemetryHorizontalWheelDelta({
				deltaX: 0,
				deltaY: 3,
				deltaMode: 1,
				pageWidthPx: 800,
				shiftKey: true,
			}),
		).toBe(48);
		expect(
			resolveTelemetryHorizontalWheelDelta({
				deltaX: 0,
				deltaY: 3,
				deltaMode: 1,
				pageWidthPx: 800,
				shiftKey: false,
			}),
		).toBeNull();
	});

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

	test("exposes the region continuation controls only in available directions", () => {
		expect(
			getTelemetryRegionScrollAffordances({
				scrollLeft: 0,
				scrollWidth: 560,
				clientWidth: 360,
			}),
		).toEqual({ canScrollBackward: false, canScrollForward: true });
		expect(
			getTelemetryRegionScrollAffordances({
				scrollLeft: 80,
				scrollWidth: 560,
				clientWidth: 360,
			}),
		).toEqual({ canScrollBackward: true, canScrollForward: true });
		expect(
			getTelemetryRegionScrollAffordances({
				scrollLeft: 200,
				scrollWidth: 560,
				clientWidth: 360,
			}),
		).toEqual({ canScrollBackward: true, canScrollForward: false });
		expect(
			getTelemetryRegionScrollAffordances({
				scrollLeft: 0,
				scrollWidth: 360,
				clientWidth: 360,
			}),
		).toEqual({ canScrollBackward: false, canScrollForward: false });
	});
});
