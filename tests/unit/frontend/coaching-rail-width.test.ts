import { describe, expect, test } from "bun:test";
import {
	MAXIMUM_COACHING_RAIL_WIDTH_PX,
	MINIMUM_COACHING_RAIL_WIDTH_PX,
	calculateDraggedCoachingRailWidth,
	clampCoachingRailWidth,
} from "../../../frontend/src/analysis/coaching-rail-width";

describe("coaching rail width", () => {
	test("dragging the left edge left expands the rail", () => {
		expect(calculateDraggedCoachingRailWidth(282, 1_200, 1_120)).toBe(362);
	});

	test("dragging the left edge right contracts the rail", () => {
		expect(calculateDraggedCoachingRailWidth(362, 1_120, 1_200)).toBe(282);
	});

	test("clamps the rail to its supported range", () => {
		expect(clampCoachingRailWidth(100)).toBe(MINIMUM_COACHING_RAIL_WIDTH_PX);
		expect(clampCoachingRailWidth(800)).toBe(MAXIMUM_COACHING_RAIL_WIDTH_PX);
	});
});
