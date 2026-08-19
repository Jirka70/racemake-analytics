import { describe, expect, test } from "bun:test";
import { resolveTelemetryTooltipPosition } from "../../../frontend/src/analysis/telemetry-tooltip-position";

describe("resolveTelemetryTooltipPosition", () => {
	test("uses the lower-right position when it is unobstructed", () => {
		expect(
			resolveTelemetryTooltipPosition({
				anchorX: 200,
				anchorY: 100,
				tooltipWidth: 120,
				tooltipHeight: 80,
				viewWidth: 600,
				viewHeight: 400,
				obstacles: [],
			}),
		).toEqual([212, 112]);
	});

	test("moves to the opposite side of a visible overlay", () => {
		expect(
			resolveTelemetryTooltipPosition({
				anchorX: 300,
				anchorY: 120,
				tooltipWidth: 140,
				tooltipHeight: 90,
				viewWidth: 700,
				viewHeight: 400,
				obstacles: [{ left: 305, top: 90, right: 500, bottom: 260 }],
			}),
		).toEqual([148, 132]);
	});

	test("moves above an obstacle that spans both lower quadrants", () => {
		expect(
			resolveTelemetryTooltipPosition({
				anchorX: 300,
				anchorY: 180,
				tooltipWidth: 160,
				tooltipHeight: 80,
				viewWidth: 640,
				viewHeight: 420,
				obstacles: [{ left: 80, top: 175, right: 560, bottom: 340 }],
			}),
		).toEqual([312, 85]);
	});

	test("keeps the tooltip inside compact chart bounds", () => {
		expect(
			resolveTelemetryTooltipPosition({
				anchorX: 380,
				anchorY: 290,
				tooltipWidth: 180,
				tooltipHeight: 100,
				viewWidth: 390,
				viewHeight: 300,
				obstacles: [],
			}),
		).toEqual([188, 178]);
	});
});
