const PIXELS_PER_WHEEL_LINE = 16;

export interface TelemetryChartWheelScroll {
	readonly currentScrollTop: number;
	readonly maximumScrollTop: number;
	readonly deltaY: number;
	readonly deltaMode: number;
	readonly pageHeightPx: number;
}

export interface TelemetryScrollArea {
	readonly currentScrollTop: number;
	readonly maximumScrollTop: number;
	readonly pageHeightPx: number;
}

export interface TelemetryWheelScrollTarget {
	readonly target: "chart" | "workspace";
	readonly nextScrollTop: number;
}

export function resolveTelemetryWheelScrollTarget({
	isCompact,
	chart,
	workspace,
	deltaY,
	deltaMode,
}: {
	readonly isCompact: boolean;
	readonly chart: TelemetryScrollArea;
	readonly workspace: TelemetryScrollArea | null;
	readonly deltaY: number;
	readonly deltaMode: number;
}): TelemetryWheelScrollTarget | null {
	const target = isCompact && workspace !== null ? "workspace" : "chart";
	const scrollArea = target === "workspace" ? workspace : chart;
	if (scrollArea === null) return null;

	const nextScrollTop = calculateTelemetryChartScrollTop({
		currentScrollTop: scrollArea.currentScrollTop,
		maximumScrollTop: scrollArea.maximumScrollTop,
		deltaY,
		deltaMode,
		pageHeightPx: scrollArea.pageHeightPx,
	});

	return nextScrollTop === scrollArea.currentScrollTop
		? null
		: { target, nextScrollTop };
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

export function calculateTelemetryRegionScrollLeft({
	currentScrollLeft,
	maximumScrollLeft,
	deltaX,
	deltaY,
}: {
	readonly currentScrollLeft: number;
	readonly maximumScrollLeft: number;
	readonly deltaX: number;
	readonly deltaY: number;
}): number {
	if (Math.abs(deltaY) <= Math.abs(deltaX)) return currentScrollLeft;

	return clamp(
		currentScrollLeft + deltaY,
		0,
		Math.max(0, maximumScrollLeft),
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
