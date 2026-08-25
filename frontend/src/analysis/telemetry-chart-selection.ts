import type { SeriesChannel } from "../../../src/http/contracts";

export const TELEMETRY_CHART_IDS = [
	"time-delta",
	"speed",
	"pedals",
	"steering",
	"gear",
	"rpm",
	"tyre-temperatures",
] as const;

export type TelemetryChartId = (typeof TELEMETRY_CHART_IDS)[number];

export const DEFAULT_VISIBLE_TELEMETRY_CHARTS: readonly TelemetryChartId[] = [
	"time-delta",
	"speed",
	"pedals",
	"steering",
];

export const FRAGMENT_TELEMETRY_CHART_IDS: readonly TelemetryChartId[] = [
	"speed",
	"pedals",
	"steering",
	"gear",
	"rpm",
	"tyre-temperatures",
];

export const DEFAULT_VISIBLE_FRAGMENT_TELEMETRY_CHARTS: readonly TelemetryChartId[] =
	["speed", "pedals", "steering"];

export const MOBILE_COMPARISON_TELEMETRY_CHARTS: readonly TelemetryChartId[] =
	TELEMETRY_CHART_IDS;

export const MOBILE_SINGLE_TELEMETRY_CHARTS: readonly TelemetryChartId[] =
	FRAGMENT_TELEMETRY_CHART_IDS;

export const PRIMARY_TELEMETRY_CHARTS: readonly TelemetryChartId[] =
	DEFAULT_VISIBLE_TELEMETRY_CHARTS;

export const ADDITIONAL_TELEMETRY_CHARTS: readonly TelemetryChartId[] = [
	"gear",
	"rpm",
	"tyre-temperatures",
];

export const TELEMETRY_CHART_LABELS: Readonly<
	Record<TelemetryChartId, string>
> = {
	"time-delta": "Time delta",
	speed: "Speed",
	pedals: "Pedals",
	steering: "Steering",
	gear: "Gear",
	rpm: "RPM",
	"tyre-temperatures": "Tyre temperatures",
};

const SERIES_CHANNELS_BY_CHART: Readonly<
	Record<TelemetryChartId, readonly SeriesChannel[]>
> = {
	"time-delta": [],
	speed: ["speedKmh"],
	pedals: ["throttleRatio", "brakeRatio"],
	steering: ["steeringDegrees"],
	gear: ["gear"],
	rpm: ["engineRpm"],
	"tyre-temperatures": ["tyreCoreTemperatureC"],
};

export function toggleTelemetryChart(
	visibleChartIds: readonly TelemetryChartId[],
	chartId: TelemetryChartId,
): readonly TelemetryChartId[] {
	const isVisible = visibleChartIds.includes(chartId);
	if (isVisible && visibleChartIds.length === 1) return visibleChartIds;

	const requestedChartIds = isVisible
		? visibleChartIds.filter((visibleChartId) => visibleChartId !== chartId)
		: [...visibleChartIds, chartId];
	const requestedChartIdSet = new Set(requestedChartIds);

	return TELEMETRY_CHART_IDS.filter((visibleChartId) =>
		requestedChartIdSet.has(visibleChartId),
	);
}

export function getSeriesChannelsForTelemetryCharts(
	visibleChartIds: readonly TelemetryChartId[],
): readonly SeriesChannel[] {
	const selectedChannels = new Set<SeriesChannel>();

	for (const chartId of visibleChartIds) {
		for (const channel of SERIES_CHANNELS_BY_CHART[chartId]) {
			selectedChannels.add(channel);
		}
	}

	// Lap elapsed time is always returned by /series. When time delta is the
	// only visible graph, request one small scalar channel to keep the existing
	// non-empty channels contract without downloading all default channels.
	if (selectedChannels.size === 0) selectedChannels.add("speedKmh");

	return [...selectedChannels];
}
