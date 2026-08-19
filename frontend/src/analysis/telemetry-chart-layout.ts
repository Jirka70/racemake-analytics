export type TelemetryChartPresentation = "desktop" | "compact";

export interface TelemetryChartPlotInsets {
	readonly topPx: number;
	readonly rightPx: number;
	readonly bottomPx: number;
	readonly leftPx: number;
}

const TELEMETRY_CHART_PLOT_INSETS: Readonly<
	Record<TelemetryChartPresentation, TelemetryChartPlotInsets>
> = {
	desktop: {
		topPx: 18,
		rightPx: 18,
		bottomPx: 38,
		leftPx: 102,
	},
	compact: {
		topPx: 16,
		rightPx: 12,
		bottomPx: 36,
		leftPx: 72,
	},
};

export function getTelemetryChartPlotInsets(
	presentation: TelemetryChartPresentation,
): TelemetryChartPlotInsets {
	return TELEMETRY_CHART_PLOT_INSETS[presentation];
}
