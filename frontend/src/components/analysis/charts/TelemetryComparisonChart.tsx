import type { TooltipComponentFormatterCallbackParams } from "echarts";
import { LineChart, type LineSeriesOption } from "echarts/charts";
import {
	AxisPointerComponent,
	type AxisPointerComponentOption,
	DataZoomComponent,
	type DataZoomComponentOption,
	GridComponent,
	type GridComponentOption,
	TooltipComponent,
	type TooltipComponentOption,
} from "echarts/components";
import { type ComposeOption, type EChartsType, init, use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useMemo, useRef } from "react";
import type {
	AvailableIdealLapResponse,
	LapSamplingGapResponse,
	SeriesResponse,
	TrackRegionResponse,
} from "../../../../../src/http/contracts";
import type { CoachingChartMarker } from "../../../analysis/coaching-findings";
import {
	findIdealLapRegionSourceAtPosition,
	type IdealLapDefinition,
} from "../../../analysis/ideal-lap";
import type { LapFragmentPresentation } from "../../../analysis/lap-fragment-presentation";
import {
	createTelemetryChartModel,
	type TelemetryChartLine,
	type TelemetryChartMeasurement,
	type TelemetryChartModel,
} from "../../../analysis/telemetry-chart";
import { resolveTelemetryHorizontalWheelDelta } from "../../../analysis/telemetry-chart-scroll";
import type { TelemetryChartId } from "../../../analysis/telemetry-chart-selection";
import {
	moveTelemetryViewport,
	type TelemetryViewport,
} from "../../../analysis/telemetry-viewport";
import { CoachingChartMarkers } from "./CoachingChartMarkers";
import { FragmentCoverageOverlay } from "./FragmentCoverageOverlay";
import { TelemetryGapOverlays } from "./TelemetryGapOverlays";
import { TrackRegionSelectionOverlay } from "./TrackRegionSelectionOverlay";

use([
	LineChart,
	AxisPointerComponent,
	DataZoomComponent,
	GridComponent,
	TooltipComponent,
	CanvasRenderer,
]);

type TelemetryChartOption = ComposeOption<
	| LineSeriesOption
	| AxisPointerComponentOption
	| DataZoomComponentOption
	| GridComponentOption
	| TooltipComponentOption
>;

type TelemetryTooltipSample = Exclude<
	TooltipComponentFormatterCallbackParams,
	readonly unknown[]
>;

export interface TelemetryComparisonChartDataProps {
	readonly status: "loading" | "ready" | "empty" | "error";
	readonly series: SeriesResponse | null;
	readonly reviewedLapNumber: number | null;
	readonly reviewedLabel?: string;
	readonly secondLapNumber: number | null;
	readonly idealLap: IdealLapDefinition | null;
	readonly idealLapSeries: AvailableIdealLapResponse | null;
	readonly errorMessage: string | null;
	readonly coachingMarkers: readonly CoachingChartMarker[];
	readonly activeCoachingRank: number | null;
	readonly activeCoachingRegionId: string | null;
	readonly onSelectCoachingRank: (rank: number) => void;
	readonly visibleChartIds: readonly TelemetryChartId[];
	readonly samplingGaps: readonly LapSamplingGapResponse[];
	readonly fragment: LapFragmentPresentation | null;
}

export interface TelemetryComparisonChartProps
	extends TelemetryComparisonChartDataProps {
	readonly viewport: TelemetryViewport;
	readonly onViewportChange: (viewport: TelemetryViewport) => void;
	readonly selectedRegion: TrackRegionResponse | null;
	readonly presentation?: "desktop" | "compact";
}

const REVIEWED_LAP_COLOR = "#a3e635";
const SECOND_LAP_COLOR = "#a78bfa";
const IDEAL_LAP_COLOR = "#d4d4d8";
const GRID_LINE_COLOR = "#2b2f2c";
const AXIS_LINE_COLOR = "#3b403c";
const AXIS_LABEL_COLOR = "#7b807c";

interface TelemetryChartSection {
	readonly id: TelemetryChartId;
	readonly title: string;
	readonly details: string;
	readonly measurement: TelemetryChartMeasurement;
	readonly lines: readonly TelemetryChartLine[];
	readonly yAxis: {
		readonly min: number;
		readonly max: number;
		readonly interval?: number;
		readonly formatter?: (value: number) => string;
	};
}

interface TelemetryChartGridLayout {
	readonly topPercent: number;
	readonly heightPercent: number;
	readonly centerPercent: number;
}

export function TelemetryComparisonChart({
	status,
	series,
	reviewedLapNumber,
	reviewedLabel,
	secondLapNumber,
	idealLap,
	idealLapSeries,
	errorMessage,
	coachingMarkers,
	activeCoachingRank,
	onSelectCoachingRank,
	visibleChartIds,
	samplingGaps,
	fragment,
	viewport,
	onViewportChange,
	selectedRegion,
	presentation = "desktop",
}: TelemetryComparisonChartProps) {
	const model = useMemo(() => {
		if (series === null || reviewedLapNumber === null) {
			return null;
		}

		return createTelemetryChartModel(
			series,
			reviewedLapNumber,
			secondLapNumber,
			idealLapSeries,
			reviewedLabel,
		);
	}, [
		series,
		reviewedLapNumber,
		secondLapNumber,
		idealLapSeries,
		reviewedLabel,
	]);
	const chartSections = useMemo(
		() =>
			model === null
				? []
				: createVisibleChartSections(model, visibleChartIds, secondLapNumber),
		[model, visibleChartIds, secondLapNumber],
	);
	const chartLayout = useMemo(
		() => createChartGridLayout(chartSections.length),
		[chartSections.length],
	);

	return (
		<section
			className="relative h-full min-h-0 overflow-hidden rounded-[3px] border border-[#292d2a] bg-[#101311]"
			aria-label="Telemetry charts"
			style={{
				minHeight:
					presentation === "compact"
						? 360
						: Math.max(360, chartSections.length * 96),
			}}
		>
			<ChartChannelLabels
				sections={chartSections}
				layout={chartLayout}
				presentation={presentation}
			/>
			<TrackRegionSelectionOverlay
				region={selectedRegion}
				viewport={viewport}
			/>
			{status === "ready" &&
				model !== null &&
				reviewedLapNumber !== null &&
				fragment === null && (
					<TelemetryGapOverlays
						samplingGaps={samplingGaps}
						reviewedLapNumber={reviewedLapNumber}
						secondLapNumber={secondLapNumber}
						viewport={viewport}
					/>
				)}
			{status === "ready" && model !== null && fragment !== null ? (
				<FragmentCoverageOverlay fragment={fragment} viewport={viewport} />
			) : null}
			{status === "ready" && model !== null && (
				<CoachingChartMarkers
					markers={coachingMarkers}
					activeRank={activeCoachingRank}
					viewport={viewport}
					onSelectRank={onSelectCoachingRank}
				/>
			)}

			{status === "loading" && <ChartMessage message="Loading telemetry…" />}
			{status === "empty" && (
				<ChartMessage message="Select two racing laps to compare their telemetry." />
			)}
			{status === "error" && (
				<ChartMessage
					message={errorMessage ?? "This telemetry comparison is unavailable."}
					isError
				/>
			)}
			{status === "ready" && model === null && (
				<ChartMessage message="Telemetry data are not available for the selected lap." />
			)}
			{status === "ready" && model !== null && chartSections.length > 0 && (
				<TelemetryChartCanvas
					model={model}
					sections={chartSections}
					layout={chartLayout}
					viewport={viewport}
					onViewportChange={onViewportChange}
					idealLap={idealLap}
					presentation={presentation}
				/>
			)}
		</section>
	);
}

function TelemetryChartCanvas({
	model,
	sections,
	layout,
	viewport,
	onViewportChange,
	idealLap,
	presentation,
}: {
	readonly model: TelemetryChartModel;
	readonly sections: readonly TelemetryChartSection[];
	readonly layout: readonly TelemetryChartGridLayout[];
	readonly viewport: TelemetryViewport;
	readonly onViewportChange: (viewport: TelemetryViewport) => void;
	readonly idealLap: IdealLapDefinition | null;
	readonly presentation: "desktop" | "compact";
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<EChartsType | null>(null);
	const activeGridIndexRef = useRef(0);
	const viewportRef = useRef(viewport);
	// Rebuilding the chart option on every dataZoom frame interrupts a drag.
	// Track the chart-owned viewport so React only syncs external zoom changes.
	const chartViewportRef = useRef(viewport);
	viewportRef.current = viewport;

	useEffect(() => {
		const chartContainer = containerRef.current;
		if (!chartContainer) return;

		const updateActiveGridIndex = (event: PointerEvent): void => {
			const bounds = chartContainer.getBoundingClientRect();
			const normalizedY = (event.clientY - bounds.top) / bounds.height;
			activeGridIndexRef.current = findGridIndex(normalizedY, layout);
		};

		const chart = init(chartContainer, undefined, { renderer: "canvas" });
		chartRef.current = chart;
		let pendingHorizontalWheelDeltaPx = 0;
		let wheelAnimationFrameId: number | null = null;
		const updateViewport = (event: unknown): void => {
			const nextViewport = readDataZoomViewport(event);
			if (nextViewport === null) return;

			chartViewportRef.current = nextViewport;
			onViewportChange(nextViewport);
		};
		chart.on("datazoom", updateViewport);

		const flushHorizontalWheel = (): void => {
			wheelAnimationFrameId = null;
			const horizontalDeltaPx = pendingHorizontalWheelDeltaPx;
			pendingHorizontalWheelDeltaPx = 0;

			const currentViewport = chartViewportRef.current;
			const spanPercent =
				currentViewport.endPercent - currentViewport.startPercent;
			if (spanPercent >= 100) return;

			const containerWidthPx = Math.max(1, chartContainer.clientWidth);
			const nextViewport = moveTelemetryViewport(
				currentViewport,
				currentViewport.startPercent +
					(horizontalDeltaPx / containerWidthPx) * spanPercent,
			);
			if (areViewportsEqual(currentViewport, nextViewport)) return;

			// Advance the chart-owned value before React commits so every animation
			// frame starts exactly where the preceding trackpad frame ended.
			chartViewportRef.current = nextViewport;
			chart.dispatchAction({
				type: "dataZoom",
				dataZoomIndex: 0,
				startValue: nextViewport.startPercent,
				endValue: nextViewport.endPercent,
			});
		};

		const moveViewportFromHorizontalWheel = (event: WheelEvent): void => {
			if (event.ctrlKey) return;

			const horizontalDeltaPx = resolveTelemetryHorizontalWheelDelta({
				deltaX: event.deltaX,
				deltaY: event.deltaY,
				deltaMode: event.deltaMode,
				pageWidthPx: Math.max(1, chartContainer.clientWidth),
				shiftKey: event.shiftKey,
			});
			event.preventDefault();
			event.stopPropagation();
			if (horizontalDeltaPx === null) return;

			pendingHorizontalWheelDeltaPx += horizontalDeltaPx;
			wheelAnimationFrameId ??= requestAnimationFrame(flushHorizontalWheel);
		};

		chartContainer.addEventListener("wheel", moveViewportFromHorizontalWheel, {
			capture: true,
			passive: false,
		});
		chartContainer.addEventListener("pointermove", updateActiveGridIndex, {
			capture: true,
			passive: true,
		});

		const resizeObserver = new ResizeObserver(() => chart.resize());
		resizeObserver.observe(chartContainer);

		return () => {
			resizeObserver.disconnect();
			if (wheelAnimationFrameId !== null) {
				cancelAnimationFrame(wheelAnimationFrameId);
			}
			chartContainer.removeEventListener(
				"wheel",
				moveViewportFromHorizontalWheel,
				true,
			);
			chartContainer.removeEventListener(
				"pointermove",
				updateActiveGridIndex,
				true,
			);
			chart.off("datazoom", updateViewport);
			chart.dispose();
			chartRef.current = null;
		};
	}, [layout, onViewportChange]);

	useEffect(() => {
		const currentViewport = viewportRef.current;
		chartRef.current?.setOption(
			createTelemetryChartOption(
				sections,
				layout,
				currentViewport,
				() => activeGridIndexRef.current,
				idealLap,
				presentation,
			),
			{ notMerge: true },
		);
		chartViewportRef.current = currentViewport;
	}, [sections, layout, idealLap, presentation]);

	useEffect(() => {
		const chart = chartRef.current;
		if (
			chart === null ||
			areViewportsEqual(chartViewportRef.current, viewport)
		) {
			return;
		}

		chartViewportRef.current = viewport;
		chart.dispatchAction({
			type: "dataZoom",
			dataZoomIndex: 0,
			startValue: viewport.startPercent,
			endValue: viewport.endPercent,
		});
	}, [viewport]);

	const isZoomed = viewport.endPercent - viewport.startPercent < 100;

	return (
		<div
			ref={containerRef}
			className={`absolute inset-0 touch-pan-y select-none ${isZoomed ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"}`}
			role="img"
			aria-label={createAccessibleChartDescription(model, sections)}
			title={
				isZoomed ? "Drag left or right to move through the lap" : undefined
			}
		/>
	);
}

function areViewportsEqual(
	first: TelemetryViewport,
	second: TelemetryViewport,
): boolean {
	return (
		Math.abs(first.startPercent - second.startPercent) < 0.001 &&
		Math.abs(first.endPercent - second.endPercent) < 0.001
	);
}

function createVisibleChartSections(
	model: TelemetryChartModel,
	visibleChartIds: readonly TelemetryChartId[],
	secondLapNumber: number | null,
): readonly TelemetryChartSection[] {
	const sectionsById: Readonly<
		Record<TelemetryChartId, TelemetryChartSection | null>
	> = {
		"time-delta":
			model.timeDelta === null
				? null
				: {
						id: "time-delta",
						title: "TIME DELTA",
						details:
							secondLapNumber === null
								? "(s)"
								: `vs Lap ${secondLapNumber} (s)`,
						measurement: "time-delta",
						lines: [
							model.timeDelta,
							...(model.idealTimeDelta ? [model.idealTimeDelta] : []),
						],
						yAxis: {
							min: -Math.max(1.5, model.maximumAbsoluteTimeDeltaSeconds),
							max: Math.max(1.5, model.maximumAbsoluteTimeDeltaSeconds),
							interval: Math.max(1.5, model.maximumAbsoluteTimeDeltaSeconds),
							formatter: (value) =>
								`${value > 0 ? "+" : ""}${value.toFixed(1)}`,
						},
					},
		speed:
			model.speed === null
				? null
				: {
						id: "speed",
						title: "SPEED",
						details: "(km/h)",
						measurement: "speed",
						lines: model.speed,
						yAxis: {
							min: 0,
							max: Math.max(300, model.maximumSpeedKmh),
							interval: Math.max(300, model.maximumSpeedKmh) / 2,
						},
					},
		pedals:
			model.pedals === null
				? null
				: {
						id: "pedals",
						title: "PEDALS",
						details: "Throttle + · Brake − (%)",
						measurement: "pedal",
						lines: model.pedals,
						yAxis: { min: -100, max: 100, interval: 100 },
					},
		steering:
			model.steering === null
				? null
				: {
						id: "steering",
						title: "STEERING",
						details: "(°)",
						measurement: "steering",
						lines: model.steering,
						yAxis: {
							min: -Math.max(500, model.maximumAbsoluteSteeringDegrees),
							max: Math.max(500, model.maximumAbsoluteSteeringDegrees),
							interval: Math.max(500, model.maximumAbsoluteSteeringDegrees),
						},
					},
		gear:
			model.gear === null
				? null
				: {
						id: "gear",
						title: "GEAR",
						details: "Selected gear",
						measurement: "gear",
						lines: model.gear,
						yAxis: {
							min: -1,
							max: 8,
							interval: 3,
							formatter: (value) => (value === -1 ? "R" : value.toFixed(0)),
						},
					},
		rpm:
			model.rpm === null
				? null
				: {
						id: "rpm",
						title: "RPM",
						details: "Engine speed",
						measurement: "rpm",
						lines: model.rpm,
						yAxis: {
							min: 0,
							max: Math.max(1_000, model.maximumRpm),
							interval: Math.max(1_000, model.maximumRpm) / 2,
						},
					},
		"tyre-temperatures":
			model.tyreTemperatures === null
				? null
				: {
						id: "tyre-temperatures",
						title: "TYRE TEMPERATURES",
						details: "Core (°C)",
						measurement: "tyre-temperature",
						lines: model.tyreTemperatures,
						yAxis: {
							min: model.minimumTyreTemperatureC,
							max: Math.max(
								model.minimumTyreTemperatureC + 5,
								model.maximumTyreTemperatureC,
							),
						},
					},
	};

	return visibleChartIds.flatMap((chartId) => {
		const section = sectionsById[chartId];
		return section === null ? [] : [section];
	});
}

function createChartGridLayout(
	chartCount: number,
): readonly TelemetryChartGridLayout[] {
	if (chartCount === 0) return [];

	const topPercent = 3;
	const bottomPercent = 9;
	const gapPercent = chartCount === 1 ? 0 : Math.min(4, 12 / (chartCount - 1));
	const availableHeightPercent =
		100 - topPercent - bottomPercent - gapPercent * (chartCount - 1);
	const heightPercent = availableHeightPercent / chartCount;

	return Array.from({ length: chartCount }, (_, index) => {
		const gridTopPercent = index * (heightPercent + gapPercent) + topPercent;
		return {
			topPercent: gridTopPercent,
			heightPercent,
			centerPercent: gridTopPercent + heightPercent / 2,
		};
	});
}

function createTelemetryChartOption(
	sections: readonly TelemetryChartSection[],
	layout: readonly TelemetryChartGridLayout[],
	viewport: TelemetryViewport,
	getActiveGridIndex: () => number,
	idealLap: IdealLapDefinition | null,
	presentation: "desktop" | "compact",
): TelemetryChartOption {
	const gridIndexes = sections.map((_, gridIndex) => gridIndex);
	const lastGridIndex = sections.length - 1;
	const xAxes = sections.map((_, gridIndex) => ({
		type: "value" as const,
		gridIndex,
		min: 0,
		max: 100,
		interval: presentation === "compact" ? 20 : 10,
		axisPointer: {
			show: true,
			snap: true,
			label: {
				show: gridIndex === lastGridIndex,
				backgroundColor: "#222723",
				color: "#d4d4d4",
				fontSize: 10,
				precision: 1,
				formatter: "{value}%",
			},
		},
		axisLine: {
			show:
				sections[gridIndex]?.measurement === "pedal" ||
				gridIndex === lastGridIndex,
			onZero: sections[gridIndex]?.measurement === "pedal",
			lineStyle: { color: AXIS_LINE_COLOR },
		},
		axisTick: { show: false },
		axisLabel: {
			show: gridIndex === lastGridIndex,
			color: AXIS_LABEL_COLOR,
			fontSize: 10,
			formatter: (value: number) => `${Math.round(value)}%`,
		},
		name: gridIndex === lastGridIndex ? "TRACK POSITION" : undefined,
		nameLocation: "middle" as const,
		nameGap: presentation === "compact" ? 22 : 26,
		nameTextStyle: {
			color: "#737873",
			fontSize: 10,
		},
		splitLine: { show: false },
	}));

	return {
		animation: false,
		backgroundColor: "transparent",
		axisPointer: {
			show: true,
			type: "line",
			triggerEmphasis: true,
			link: [{ xAxisIndex: gridIndexes }],
			lineStyle: {
				color: "#d4d4d4",
				width: 1,
			},
		},
		dataZoom: [
			{
				type: "inside",
				xAxisIndex: gridIndexes,
				startValue: viewport.startPercent,
				endValue: viewport.endPercent,
				minSpan: 10,
				maxSpan: 100,
				filterMode: "none",
				// Mouse drag remains native to ECharts. Horizontal wheel movement is
				// applied proportionally above because ECharts quantizes trackpad deltas.
				zoomOnMouseWheel: false,
				moveOnMouseMove: true,
				moveOnMouseWheel: false,
				preventDefaultMouseMove: true,
				throttle: 16,
			},
		],
		grid: layout.map((grid) => ({
			left: presentation === "compact" ? 72 : 102,
			right: presentation === "compact" ? 12 : 18,
			top: `${grid.topPercent}%`,
			height: `${grid.heightPercent}%`,
		})),
		tooltip: {
			trigger: "axis",
			// Keep mouse, pen, and touch behavior identical across responsive
			// compositions. ECharts maps taps to click and pointer hover to mousemove.
			triggerOn: "mousemove|click|mousewheel",
			confine: true,
			backgroundColor: "rgba(17, 20, 18, 0.96)",
			borderColor: "#4b504c",
			borderWidth: 1,
			padding: [8, 10],
			textStyle: {
				color: "#e5e5e5",
				fontSize: 11,
			},
			axisPointer: {
				type: "line",
				lineStyle: {
					color: "#d4d4d4",
					width: 1,
				},
			},
			formatter: (parameters) =>
				formatTelemetryTooltip(
					parameters,
					getActiveGridIndex(),
					sections,
					idealLap,
				),
		},
		xAxis: xAxes,
		yAxis: sections.map((section, gridIndex) =>
			createValueAxis(gridIndex, section.yAxis),
		),
		series: sections.flatMap((section, gridIndex) =>
			section.lines.map((line) => createLineSeries(line, gridIndex)),
		),
	};
}

function readDataZoomViewport(event: unknown): TelemetryViewport | null {
	if (typeof event !== "object" || event === null) return null;

	const payload = readDataZoomPayload(event);
	if (payload === null) return null;

	const startPercent = readFiniteNumber(payload, "startValue", "start");
	const endPercent = readFiniteNumber(payload, "endValue", "end");
	if (startPercent === null || endPercent === null) return null;

	return {
		startPercent: Math.max(0, Math.min(100, startPercent)),
		endPercent: Math.max(0, Math.min(100, endPercent)),
	};
}

function readDataZoomPayload(event: object): object | null {
	if (!("batch" in event) || !Array.isArray(event.batch)) return event;

	const firstPayload = event.batch[0];
	return typeof firstPayload === "object" && firstPayload !== null
		? firstPayload
		: null;
}

function readFiniteNumber(
	payload: object,
	primaryKey: string,
	fallbackKey: string,
): number | null {
	const record = payload as Readonly<Record<string, unknown>>;
	const value = record[primaryKey] ?? record[fallbackKey];
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function createValueAxis(
	gridIndex: number,
	options: {
		readonly min: number;
		readonly max: number;
		readonly interval?: number;
		readonly formatter?: (value: number) => string;
	},
) {
	return {
		type: "value" as const,
		gridIndex,
		min: options.min,
		max: options.max,
		interval: options.interval,
		axisPointer: { show: true },
		axisLine: {
			show: true,
			lineStyle: { color: AXIS_LINE_COLOR },
		},
		axisTick: { show: false },
		axisLabel: {
			color: AXIS_LABEL_COLOR,
			fontSize: 10,
			formatter: options.formatter,
		},
		splitLine: {
			lineStyle: {
				color: GRID_LINE_COLOR,
				type: "dashed" as const,
			},
		},
	};
}

function createLineSeries(
	line: TelemetryChartLine,
	gridIndex: number,
): LineSeriesOption {
	const color = findTelemetryLineColor(line);

	return {
		id: line.id,
		name: line.name,
		type: "line",
		xAxisIndex: gridIndex,
		yAxisIndex: gridIndex,
		data: line.points.map(([position, value]) => [position, value]),
		showSymbol: false,
		connectNulls: false,
		silent: false,
		step: line.measurement === "gear" ? "end" : false,
		lineStyle: {
			color,
			width:
				line.role === "ideal"
					? 1.5
					: line.measurement === "time-delta"
						? 1.75
						: 1.5,
			type: line.lineStyle ?? "solid",
			opacity: line.opacity ?? 1,
		},
		itemStyle: { color, opacity: line.opacity ?? 1 },
		emphasis: { disabled: true },
		z: line.role === "ideal" ? 4 : 3,
	};
}

function findTelemetryLineColor(line: TelemetryChartLine): string {
	if (line.role === "reviewed") return REVIEWED_LAP_COLOR;
	if (line.role === "second") return SECOND_LAP_COLOR;
	return IDEAL_LAP_COLOR;
}

function formatTelemetryTooltip(
	parameters: TooltipComponentFormatterCallbackParams,
	activeGridIndex: number,
	sections: readonly TelemetryChartSection[],
	idealLap: IdealLapDefinition | null,
): string {
	const allSamples: readonly TelemetryTooltipSample[] = Array.isArray(
		parameters,
	)
		? parameters
		: [parameters];
	const samples = deduplicateTooltipSamples(
		allSamples.filter((sample) =>
			belongsToGrid(sample.seriesId, activeGridIndex, sections),
		),
	);
	const firstPoint = readTooltipPoint(samples[0]?.value);
	const positionLabel =
		firstPoint === null
			? "Track position"
			: `Track position ${firstPoint[0].toFixed(1)}%`;
	const sampleLabels = samples.map((sample) => {
		const point = readTooltipPoint(sample.value);
		const measurement = findMeasurementFromSeriesId(sample.seriesId);
		const valueLabel = formatTooltipValue(point?.[1] ?? null, measurement);
		const marker = typeof sample.marker === "string" ? sample.marker : "";
		const pedalLabel =
			measurement === "pedal"
				? findPedalSampleLabel(point?.[1] ?? null, samples)
				: "";

		const seriesLabel = createTooltipSeriesLabel(
			sample,
			point?.[0] ?? null,
			idealLap,
		);

		return `${marker}${seriesLabel}${pedalLabel}&nbsp;&nbsp;<strong>${valueLabel}</strong>`;
	});
	const measurementHeading = createTooltipMeasurementHeading(samples);

	return [positionLabel, measurementHeading, ...sampleLabels]
		.filter((label) => label.length > 0)
		.join("<br/>");
}

function createTooltipSeriesLabel(
	sample: TelemetryTooltipSample,
	positionPercent: number | null,
	idealLap: IdealLapDefinition | null,
): string {
	const defaultLabel = sample.seriesName ?? "Lap";
	if (
		idealLap === null ||
		positionPercent === null ||
		!sample.seriesId?.startsWith("ideal-")
	) {
		return defaultLabel;
	}

	const source = findIdealLapRegionSourceAtPosition(
		idealLap,
		positionPercent / 100,
	);
	return source === null
		? defaultLabel
		: `${defaultLabel} · ${source.region.id} from Lap ${source.sourceLapNumber}`;
}

function deduplicateTooltipSamples(
	samples: readonly TelemetryTooltipSample[],
): readonly TelemetryTooltipSample[] {
	const seenSeries = new Set<string | number>();

	return samples.filter((sample) => {
		const seriesIdentity = sample.seriesId ?? sample.seriesIndex;
		if (seriesIdentity === undefined) return true;
		if (seenSeries.has(seriesIdentity)) return false;

		seenSeries.add(seriesIdentity);
		return true;
	});
}

function belongsToGrid(
	seriesId: string | undefined,
	gridIndex: number,
	sections: readonly TelemetryChartSection[],
): boolean {
	return (
		findMeasurementFromSeriesId(seriesId) === sections[gridIndex]?.measurement
	);
}

function findGridIndex(
	normalizedY: number,
	layout: readonly TelemetryChartGridLayout[],
): number {
	const pointerPercent = normalizedY * 100;
	let nearestGridIndex = 0;
	let nearestDistance = Number.POSITIVE_INFINITY;

	for (const [gridIndex, grid] of layout.entries()) {
		const distance = Math.abs(pointerPercent - grid.centerPercent);
		if (distance < nearestDistance) {
			nearestGridIndex = gridIndex;
			nearestDistance = distance;
		}
	}

	return nearestGridIndex;
}

function findMeasurementFromSeriesId(
	seriesId: string | undefined,
): TelemetryChartMeasurement | null {
	if (seriesId?.endsWith("-time-delta")) return "time-delta";
	if (seriesId?.endsWith("-speed")) return "speed";
	if (seriesId?.endsWith("-pedal")) return "pedal";
	if (seriesId?.endsWith("-steering")) return "steering";
	if (seriesId?.endsWith("-gear")) return "gear";
	if (seriesId?.endsWith("-rpm")) return "rpm";
	if (seriesId?.includes("-tyre-temperature-")) return "tyre-temperature";
	return null;
}

function createTooltipMeasurementHeading(
	samples: readonly TelemetryTooltipSample[],
): string {
	if (
		!samples.some(
			(sample) => findMeasurementFromSeriesId(sample.seriesId) === "pedal",
		)
	) {
		return "";
	}

	const values = samples.map(
		(sample) => readTooltipPoint(sample.value)?.[1] ?? 0,
	);
	const hasBrake = values.some((value) => value < 0);
	const hasThrottle = values.some((value) => value > 0);
	if (hasBrake && hasThrottle) return "<strong>Pedals</strong>";
	return `<strong>${hasBrake ? "Brake" : "Throttle"}</strong>`;
}

function findPedalSampleLabel(
	value: number | null,
	samples: readonly TelemetryTooltipSample[],
): string {
	if (value === null) return "";

	const values = samples.map(
		(sample) => readTooltipPoint(sample.value)?.[1] ?? 0,
	);
	const hasBrake = values.some((sampleValue) => sampleValue < 0);
	const hasThrottle = values.some((sampleValue) => sampleValue > 0);
	if (!(hasBrake && hasThrottle)) return "";

	return value < 0 ? " brake" : " throttle";
}

function formatTooltipValue(
	value: number | null,
	measurement: TelemetryChartMeasurement | null,
): string {
	if (value === null) return "No data";

	switch (measurement) {
		case "time-delta":
			return `${value >= 0 ? "+" : ""}${value.toFixed(3)} s`;
		case "speed":
			return `${value.toFixed(1)} km/h`;
		case "pedal":
			return `${Math.abs(value).toFixed(0)}%`;
		case "steering":
			return `${value >= 0 ? "+" : ""}${value.toFixed(1)}°`;
		case "gear":
			return formatGear(value);
		case "rpm":
			return `${Math.round(value).toLocaleString("en-US")} rpm`;
		case "tyre-temperature":
			return `${value.toFixed(1)} °C`;
		default:
			return value.toFixed(1);
	}
}

function readTooltipPoint(
	value: unknown,
): readonly [number, number | null] | null {
	if (!Array.isArray(value)) return null;

	const position = value[0];
	const measurement = value[1];
	if (typeof position !== "number") return null;
	if (measurement !== null && typeof measurement !== "number") return null;

	return [position, measurement];
}

function formatGear(value: number): string {
	if (value === -1) return "Reverse";
	if (value === 0) return "Neutral";
	return `Gear ${Math.round(value)}`;
}

function createAccessibleChartDescription(
	model: TelemetryChartModel,
	sections: readonly TelemetryChartSection[],
): string {
	const chartNames = sections.map((section) => section.title.toLowerCase());
	const reviewedLapName = sections
		.flatMap((section) => section.lines)
		.find((line) => line.role === "reviewed")?.name;

	return model.timeDelta
		? `${chartNames.join(", ")} comparison for ${model.timeDelta.name}.`
		: `${chartNames.join(", ")} for ${reviewedLapName ?? "the selected lap"}.`;
}

function ChartChannelLabels({
	sections,
	layout,
	presentation,
}: {
	readonly sections: readonly TelemetryChartSection[];
	readonly layout: readonly TelemetryChartGridLayout[];
	readonly presentation: "desktop" | "compact";
}) {
	return (
		<div
			className="pointer-events-none absolute inset-0 z-10"
			aria-hidden="true"
		>
			{sections.map((section, index) => (
				<ChartChannelLabel
					key={section.id}
					top={`${layout[index]?.centerPercent ?? 50}%`}
					title={section.title}
					details={section.details}
					presentation={presentation}
				/>
			))}
		</div>
	);
}

function ChartChannelLabel({
	top,
	title,
	details,
	presentation,
}: {
	readonly top: string;
	readonly title: string;
	readonly details: string;
	readonly presentation: "desktop" | "compact";
}) {
	return (
		<div
			className={`absolute -translate-y-1/2 ${
				presentation === "compact" ? "left-2 w-[58px]" : "left-4 w-[72px]"
			}`}
			style={{ top }}
		>
			<h2
				className={`font-semibold text-neutral-200 ${
					presentation === "compact"
						? "text-[9px] leading-3 tracking-[0.02em]"
						: "text-[11px] tracking-[0.04em]"
				}`}
			>
				{title}
			</h2>
			<p className="mt-1 text-[10px] leading-4 text-neutral-500">{details}</p>
		</div>
	);
}

function ChartMessage({
	message,
	isError = false,
}: {
	readonly message: string;
	readonly isError?: boolean;
}) {
	return (
		<p
			className={`absolute inset-0 flex items-center justify-center px-8 text-center text-sm min-[1024px]:px-24 ${isError ? "text-red-300" : "text-neutral-500"}`}
			role={isError ? "alert" : "status"}
		>
			{message}
		</p>
	);
}
