export const DEFAULT_COACHING_RAIL_WIDTH_PX = 282;
export const MINIMUM_COACHING_RAIL_WIDTH_PX = 282;
export const MAXIMUM_COACHING_RAIL_WIDTH_PX = 420;

export function clampCoachingRailWidth(widthPx: number): number {
	return Math.min(
		MAXIMUM_COACHING_RAIL_WIDTH_PX,
		Math.max(MINIMUM_COACHING_RAIL_WIDTH_PX, widthPx),
	);
}

export function calculateDraggedCoachingRailWidth(
	startingWidthPx: number,
	startingPointerX: number,
	currentPointerX: number,
): number {
	return clampCoachingRailWidth(
		startingWidthPx + startingPointerX - currentPointerX,
	);
}
