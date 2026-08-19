import { describe, expect, test } from "bun:test";
import { readTelemetryChartCursorPosition } from "../../../frontend/src/analysis/telemetry-chart-cursor";

describe("readTelemetryChartCursorPosition", () => {
	test("reads the linked x-axis cursor position", () => {
		expect(
			readTelemetryChartCursorPosition({
				currTrigger: "mousemove",
				axesInfo: [
					{ axisDim: "y", value: 0.459 },
					{ axisDim: "x", value: 47.9 },
				],
			}),
		).toBe(47.9);
	});

	test("accepts numeric strings and clamps the position to the lap", () => {
		expect(
			readTelemetryChartCursorPosition({
				axesInfo: [{ axisDim: "x", value: "100.4" }],
			}),
		).toBe(100);
	});

	test("clears the cursor when the pointer leaves", () => {
		expect(
			readTelemetryChartCursorPosition({
				currTrigger: "leave",
				axesInfo: [{ axisDim: "x", value: 47.9 }],
			}),
		).toBeNull();
	});

	test("ignores malformed pointer events", () => {
		expect(readTelemetryChartCursorPosition(null)).toBeNull();
		expect(readTelemetryChartCursorPosition({ axesInfo: [] })).toBeNull();
		expect(
			readTelemetryChartCursorPosition({
				axesInfo: [{ axisDim: "x", value: Number.NaN }],
			}),
		).toBeNull();
	});
});
