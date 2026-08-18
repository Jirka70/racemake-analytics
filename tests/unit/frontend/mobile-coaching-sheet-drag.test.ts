import { describe, expect, test } from "bun:test";
import {
	calculateMobileCoachingSheetDragOffset,
	resolveMobileCoachingSheetDragAction,
} from "../../../frontend/src/analysis/mobile-coaching-sheet-drag";

describe("mobile coaching sheet drag", () => {
	test("tracks only an upward drag when the sheet starts docked", () => {
		expect(
			calculateMobileCoachingSheetDragOffset({
				startedDocked: true,
				startClientY: 700,
				currentClientY: 642,
			}),
		).toBe(-58);
		expect(
			calculateMobileCoachingSheetDragOffset({
				startedDocked: true,
				startClientY: 700,
				currentClientY: 720,
			}),
		).toBe(0);
	});

	test("tracks only a downward drag when the sheet starts open", () => {
		expect(
			calculateMobileCoachingSheetDragOffset({
				startedDocked: false,
				startClientY: 120,
				currentClientY: 178,
			}),
		).toBe(58);
		expect(
			calculateMobileCoachingSheetDragOffset({
				startedDocked: false,
				startClientY: 120,
				currentClientY: 90,
			}),
		).toBe(0);
	});

	test("opens or docks only after crossing the drag threshold", () => {
		expect(
			resolveMobileCoachingSheetDragAction({
				startedDocked: true,
				dragOffsetPx: -44,
				allowModeChange: true,
			}),
		).toBe("open");
		expect(
			resolveMobileCoachingSheetDragAction({
				startedDocked: false,
				dragOffsetPx: 44,
				allowModeChange: true,
			}),
		).toBe("dock");
		expect(
			resolveMobileCoachingSheetDragAction({
				startedDocked: true,
				dragOffsetPx: -43,
				allowModeChange: true,
			}),
		).toBeNull();
		expect(
			resolveMobileCoachingSheetDragAction({
				startedDocked: true,
				dragOffsetPx: -80,
				allowModeChange: false,
			}),
		).toBeNull();
	});
});
