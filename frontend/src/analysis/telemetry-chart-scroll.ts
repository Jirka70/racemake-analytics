const PIXELS_PER_WHEEL_LINE = 16;

export interface TelemetryChartWheelScroll {
	readonly currentScrollTop: number;
	readonly maximumScrollTop: number;
	readonly deltaY: number;
	readonly deltaMode: number;
	readonly pageHeightPx: number;
}

export function calculateTelemetryChartScrollTop({
	currentScrollTop,
	maximumScrollTop,
	deltaY,
	deltaMode,
	pageHeightPx,
}: TelemetryChartWheelScroll): number {
	const scrollDeltaPx = convertWheelDeltaToPixels(
		deltaY,
		deltaMode,
		pageHeightPx,
	);

	return clamp(
		currentScrollTop + scrollDeltaPx,
		0,
		Math.max(0, maximumScrollTop),
	);
}

function convertWheelDeltaToPixels(
	deltaY: number,
	deltaMode: number,
	pageHeightPx: number,
): number {
	if (deltaMode === 1) return deltaY * PIXELS_PER_WHEEL_LINE;
	if (deltaMode === 2) return deltaY * pageHeightPx;
	return deltaY;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}
