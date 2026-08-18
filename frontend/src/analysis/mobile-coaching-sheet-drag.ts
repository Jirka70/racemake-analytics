export const MOBILE_COACHING_SHEET_DRAG_THRESHOLD_PX = 44;

export type MobileCoachingSheetDragAction = "dock" | "open";

export function calculateMobileCoachingSheetDragOffset({
	startedDocked,
	startClientY,
	currentClientY,
}: {
	readonly startedDocked: boolean;
	readonly startClientY: number;
	readonly currentClientY: number;
}): number {
	const verticalDeltaPx = currentClientY - startClientY;
	return startedDocked
		? Math.min(0, verticalDeltaPx)
		: Math.max(0, verticalDeltaPx);
}

export function resolveMobileCoachingSheetDragAction({
	startedDocked,
	dragOffsetPx,
	allowModeChange,
}: {
	readonly startedDocked: boolean;
	readonly dragOffsetPx: number;
	readonly allowModeChange: boolean;
}): MobileCoachingSheetDragAction | null {
	if (!allowModeChange) return null;
	if (
		startedDocked &&
		dragOffsetPx <= -MOBILE_COACHING_SHEET_DRAG_THRESHOLD_PX
	) {
		return "open";
	}
	if (
		!startedDocked &&
		dragOffsetPx >= MOBILE_COACHING_SHEET_DRAG_THRESHOLD_PX
	) {
		return "dock";
	}
	return null;
}
