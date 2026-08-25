import type { TooltipComponentFormatterCallbackParams } from "echarts";
import { LineChart, type LineSeriesOption } from "echarts/charts";
import {
	AxisPointerComponent,
	type AxisPointerComponentOption,
	DataZoomComponent,
	type DataZoomComponentOption,
	GridComponent,
	type GridComponentOption,
	MarkPointComponent,
	type MarkPointComponentOption,
	TooltipComponent,
	type TooltipComponentOption,
} from "echarts/components";
import { type ComposeOption, type EChartsType, init, use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
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
import { resolveSelectedSeriesTelemetryStatus } from "../../../analysis/telemetry-gaps";
import {
	createTelemetryChartModel,
	type TelemetryChartLine,
	type TelemetryChartMeasurement,
	type TelemetryChartModel,
} from "../../../analysis/telemetry-chart";
import { readTelemetryChartCursorPosition } from "../../../analysis/telemetry-chart-cursor";
import {
	getTelemetryChartPlotInsets,
	type TelemetryChartPresentation,
} from "../../../analysis/telemetry-chart-layout";
import { resolveTelemetryHorizontalWheelDelta } from "../../../analysis/telemetry-chart-scroll";
import type { TelemetryChartId } from "../../../analysis/telemetry-chart-selection";
import type { TelemetryControlsGuideStepId } from "../../../analysis/telemetry-controls-guide";
import {
	createTelemetryGuideSelectionClick,
	createTelemetrySeriesSelection,
	findNearestTelemetrySeriesHit,
	findNearestTelemetrySeriesPoint,
	findStableTelemetrySeriesHoverHit,
	findTelemetrySeriesClickHit,
	type TelemetrySeriesClick,
	type TelemetrySeriesSelection,
} from "../../../analysis/telemetry-series-selection";
import {
	resolveTelemetryTooltipPosition,
	type TelemetryTooltipRectangle,
} from "../../../analysis/telemetry-tooltip-position";
import {
	moveTelemetryViewport,
	type TelemetryViewport,
} from "../../../analysis/telemetry-viewport";
import { CoachingChartMarkers } from "./CoachingChartMarkers";
import { FragmentCoverageOverlay } from "./FragmentCoverageOverlay";
import { SelectedTelemetrySeriesPanel } from "./SelectedTelemetrySeriesPanel";
import {
	readVisibleTelemetryTooltipObstacles,
	TELEMETRY_TOOLTIP_LAYOUT_EVENT,
	TELEMETRY_TOOLTIP_PRIORITY,
} from "./TelemetryFloatingTooltip";
import { TelemetryGapOverlays } from "./TelemetryGapOverlays";
import { TrackRegionSelectionOverlay } from "./TrackRegionSelectionOverlay";

use([
	LineChart,
	AxisPointerComponent,
	DataZoomComponent,
	GridComponent,
	MarkPointComponent,
	TooltipComponent,
	CanvasRenderer,
]);

type TelemetryChartOption = ComposeOption<
	| LineSeriesOption
	| AxisPointerComponentOption
	| DataZoomComponentOption
	| GridComponentOption
	| MarkPointComponentOption
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
	readonly reviewedLapIsLimited: boolean;
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
	readonly onCursorPositionChange: (positionPercent: number | null) => void;
	readonly selectedRegion: TrackRegionResponse | null;
	readonly presentation?: TelemetryChartPresentation;
	readonly controlsGuideStep?: TelemetryControlsGuideStepId | null;
}

const REVIEWED_LAP_COLOR = "#a3e635";
const LIMITED_REVIEWED_LAP_COLOR = "#f59e0b";
const SECOND_LAP_COLOR = "#a78bfa";
const IDEAL_LAP_COLOR = "#d4d4d8";
const GRID_LINE_COLOR = "#2b2f2c";
const AXIS_LINE_COLOR = "#3b403c";
const AXIS_LABEL_COLOR = "#7b807c";
const TELEMETRY_SERIES_HIT_RADIUS_PX = 18;
const TELEMETRY_SERIES_HOVER_SWITCH_ADVANTAGE_PX = 4;
const TELEMETRY_SERIES_HOVER_Z = 40;
const TELEMETRY_SERIES_SELECTED_Z = 50;

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
	reviewedLapIsLimited,
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
	onCursorPositionChange,
	selectedRegion,
	presentation = "desktop",
	controlsGuideStep = null,
}: TelemetryComparisonChartProps) {
	const interactionSurfaceRef = useRef<HTMLElement>(null);
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
	const plotInsets = getTelemetryChartPlotInsets(presentation);

	return (
		<section
			ref={interactionSurfaceRef}
			className="relative h-full min-h-0 overflow-hidden rounded-[3px] border border-[#292d2a] bg-[#101311]"
			aria-label="Telemetry charts"
			data-telemetry-chart-surface
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
			{reviewedLapIsLimited ? (
				<ApproximateTimeDeltaNotice
					sections={chartSections}
					layout={chartLayout}
					presentation={presentation}
				/>
			) : null}
			<div
				className="pointer-events-none absolute"
				style={{
					top: plotInsets.topPx,
					right: plotInsets.rightPx,
					bottom: plotInsets.bottomPx,
					left: plotInsets.leftPx,
				}}
				data-testid="telemetry-chart-plot-overlays"
			>
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
			</div>

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
					key={chartSections
						.flatMap((section) => section.lines)
						.map((line) => line.id)
						.join("|")}
					model={model}
					sections={chartSections}
					layout={chartLayout}
					viewport={viewport}
					onViewportChange={onViewportChange}
					onCursorPositionChange={onCursorPositionChange}
					idealLap={idealLap}
					presentation={presentation}
					interactionSurfaceRef={interactionSurfaceRef}
					samplingGaps={samplingGaps}
					reviewedLapNumber={reviewedLapNumber}
					secondLapNumber={secondLapNumber}
					reviewedLapIsLimited={reviewedLapIsLimited}
					isGuideInspectingSeries={controlsGuideStep === "inspect"}
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
	onCursorPositionChange,
	idealLap,
	presentation,
	interactionSurfaceRef,
	samplingGaps,
	reviewedLapNumber,
	secondLapNumber,
	reviewedLapIsLimited,
	isGuideInspectingSeries,
}: {
	readonly model: TelemetryChartModel;
	readonly sections: readonly TelemetryChartSection[];
	readonly layout: readonly TelemetryChartGridLayout[];
	readonly viewport: TelemetryViewport;
	readonly onViewportChange: (viewport: TelemetryViewport) => void;
	readonly onCursorPositionChange: (positionPercent: number | null) => void;
	readonly idealLap: IdealLapDefinition | null;
	readonly presentation: TelemetryChartPresentation;
	readonly interactionSurfaceRef: RefObject<HTMLElement | null>;
	readonly samplingGaps: readonly LapSamplingGapResponse[];
	readonly reviewedLapNumber: number | null;
	readonly secondLapNumber: number | null;
	readonly reviewedLapIsLimited: boolean;
	readonly isGuideInspectingSeries: boolean;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<EChartsType | null>(null);
	const activeGridIndexRef = useRef(0);
	const viewportRef = useRef(viewport);
	const sectionsRef = useRef(sections);
	const [selectedSeries, setSelectedSeries] =
		useState<TelemetrySeriesSelection | null>(null);
	const selectedSeriesRef = useRef(selectedSeries);
	const guideSelectedSeriesIdRef = useRef<string | null>(null);
	const highlightedSeriesIdRef = useRef<string | null>(null);
	// Rebuilding the chart option on every dataZoom frame interrupts a drag.
	// Track the chart-owned viewport so React only syncs external zoom changes.
	const chartViewportRef = useRef(viewport);
	viewportRef.current = viewport;
	sectionsRef.current = sections;
	selectedSeriesRef.current = selectedSeries;

	useEffect(() => {
		const chartContainer = containerRef.current;
		const interactionSurface = interactionSurfaceRef.current;
		if (!chartContainer || !interactionSurface) return;

		const updateActiveGridIndex = (event: PointerEvent): void => {
			const bounds = chartContainer.getBoundingClientRect();
			const normalizedY = (event.clientY - bounds.top) / bounds.height;
			activeGridIndexRef.current = findGridIndex(normalizedY, layout);
		};

		const chart = init(chartContainer, undefined, { renderer: "canvas" });
		chartRef.current = chart;
		let pendingHorizontalWheelDeltaPx = 0;
		let wheelAnimationFrameId: number | null = null;
		let wheelPointerClientX = 0;
		let wheelPointerClientY = 0;
		let lastPointerClientX: number | null = null;
		let lastPointerClientY: number | null = null;
		const updateViewport = (event: unknown): void => {
			const nextViewport = readDataZoomViewport(event);
			if (nextViewport === null) return;

			chartViewportRef.current = nextViewport;
			onViewportChange(nextViewport);
		};
		chart.on("datazoom", updateViewport);
		const selectTelemetrySeries = (click: TelemetrySeriesClick): void => {
			const selectedLine = sectionsRef.current
				.flatMap((section) => section.lines)
				.find((line) => line.id === click.seriesId);
			if (selectedLine === undefined || reviewedLapNumber === null) return;

			const nextSelection = createTelemetrySeriesSelection(
				sectionsRef.current.flatMap((section) => section.lines),
				click,
				resolveSelectedSeriesTelemetryStatus({
					gaps: samplingGaps,
					reviewedLapNumber,
					secondLapNumber,
					role: selectedLine.role,
					measurement: selectedLine.measurement,
				}),
			);
			if (nextSelection === null) return;

			// Clicking a selected line at another position moves its selection.
			// Closing remains an explicit outside click, close button, or Escape.
			setSelectedSeries(nextSelection);
		};
		const findSeriesAtPointer = (
			clientX: number,
			clientY: number,
			currentSeriesId: string | null = null,
			lockHighlightedSeries = false,
		): TelemetrySeriesClick | null => {
			const bounds = chartContainer.getBoundingClientRect();
			const chartX = clientX - bounds.left;
			const chartY = clientY - bounds.top;
			if (
				chartX < 0 ||
				chartX > bounds.width ||
				chartY < 0 ||
				chartY > bounds.height
			) {
				return null;
			}

			const gridIndex = findGridIndex(chartY / bounds.height, layout);
			const section = sectionsRef.current[gridIndex];
			if (section === undefined) return null;

			const chartPoint = readTooltipPoint(
				chart.convertFromPixel(
					{ xAxisIndex: gridIndex, yAxisIndex: gridIndex },
					[chartX, chartY],
				),
			);
			if (chartPoint === null) return null;

			const hits = section.lines.flatMap((line) => {
				const point = findNearestTelemetrySeriesPoint(
					line.points,
					chartPoint[0],
				);
				if (point === null || point[1] === null) return [];

				const pixelPoint = readTooltipPoint(
					chart.convertToPixel(
						{ xAxisIndex: gridIndex, yAxisIndex: gridIndex },
						[point[0], point[1]],
					),
				);
				if (pixelPoint === null || pixelPoint[1] === null) return [];

				return [
					{
						seriesId: line.id,
						positionPercent: point[0],
						pixelX: pixelPoint[0],
						pixelY: pixelPoint[1],
					},
				];
			});

			if (lockHighlightedSeries) {
				return findTelemetrySeriesClickHit(
					hits,
					chartX,
					chartY,
					TELEMETRY_SERIES_HIT_RADIUS_PX,
					currentSeriesId,
				);
			}

			return currentSeriesId === null
				? findNearestTelemetrySeriesHit(
						hits,
						chartX,
						chartY,
						TELEMETRY_SERIES_HIT_RADIUS_PX,
					)
				: findStableTelemetrySeriesHoverHit(
						hits,
						chartX,
						chartY,
						TELEMETRY_SERIES_HIT_RADIUS_PX,
						currentSeriesId,
						TELEMETRY_SERIES_HOVER_SWITCH_ADVANTAGE_PX,
					);
		};
		const updateHighlightedSeries = (
			clientX: number,
			clientY: number,
		): void => {
			if (selectedSeriesRef.current !== null) return;

			const highlightedSeriesId = highlightedSeriesIdRef.current;
			const nextSeriesId =
				findSeriesAtPointer(clientX, clientY, highlightedSeriesId)?.seriesId ??
				null;
			if (nextSeriesId === highlightedSeriesId) return;

			const layerUpdates: LineSeriesOption[] = [];
			if (highlightedSeriesId !== null) {
				const previousLine = findTelemetryLineById(
					sectionsRef.current,
					highlightedSeriesId,
				);
				if (previousLine !== null) {
					layerUpdates.push({
						id: previousLine.id,
						type: "line",
						z: getTelemetrySeriesBaseZ(previousLine),
					});
				}
			}
			if (nextSeriesId !== null) {
				layerUpdates.push({
					id: nextSeriesId,
					type: "line",
					z: TELEMETRY_SERIES_HOVER_Z,
				});
			}
			if (layerUpdates.length > 0) {
				chart.setOption({ series: layerUpdates });
			}

			if (highlightedSeriesId !== null) {
				chart.dispatchAction({
					type: "downplay",
					seriesId: highlightedSeriesId,
				});
			}
			if (nextSeriesId !== null) {
				chart.dispatchAction({ type: "highlight", seriesId: nextSeriesId });
			}
			highlightedSeriesIdRef.current = nextSeriesId;
		};
		const selectSeriesAtPointer = (event: MouseEvent): void => {
			const target = event.target;
			const isPanelClick =
				target instanceof Element &&
				target.closest("[data-telemetry-series-panel]") !== null;
			if (isPanelClick) return;

			const isCanvasClick =
				target instanceof Node && chartContainer.contains(target);
			const isClickThroughOverlay =
				target instanceof Element &&
				target.closest("[data-telemetry-series-click-through]") !== null;
			if (!isCanvasClick && !isClickThroughOverlay) {
				setSelectedSeries(null);
				return;
			}

			// The visible hover emphasis is the user's only valid click target. Never
			// fall back to a neighboring line when dense, fully zoomed-out traces
			// overlap within the same hit radius.
			const click = findSeriesAtPointer(
				event.clientX,
				event.clientY,
				highlightedSeriesIdRef.current,
				true,
			);
			if (click === null) {
				setSelectedSeries(null);
				return;
			}

			selectTelemetrySeries(click);
		};
		interactionSurface.addEventListener("click", selectSeriesAtPointer);
		const updateCursorPosition = (event: unknown): void => {
			onCursorPositionChange(readTelemetryChartCursorPosition(event));
		};
		chart.on("updateAxisPointer", updateCursorPosition);
		const clearCursorPosition = (): void => {
			lastPointerClientX = null;
			lastPointerClientY = null;
			const highlightedSeriesId = highlightedSeriesIdRef.current;
			if (highlightedSeriesId !== null) {
				const highlightedLine = findTelemetryLineById(
					sectionsRef.current,
					highlightedSeriesId,
				);
				if (highlightedLine !== null) {
					chart.setOption({
						series: [
							{
								id: highlightedLine.id,
								type: "line",
								z: getTelemetrySeriesBaseZ(highlightedLine),
							},
						],
					});
				}
				chart.dispatchAction({
					type: "downplay",
					seriesId: highlightedSeriesId,
				});
				highlightedSeriesIdRef.current = null;
			}
			chart.dispatchAction({ type: "hideTip" });
			chart.dispatchAction({
				type: "updateAxisPointer",
				currTrigger: "leave",
			});
			onCursorPositionChange(null);
		};
		const synchronizePointerAcrossOverlay = (event: PointerEvent): void => {
			lastPointerClientX = event.clientX;
			lastPointerClientY = event.clientY;
			updateActiveGridIndex(event);

			const eventTarget = event.target;
			if (
				eventTarget instanceof Element &&
				eventTarget.closest("[data-telemetry-series-panel]")
			) {
				chart.dispatchAction({ type: "hideTip" });
				onCursorPositionChange(null);
				return;
			}
			if (eventTarget instanceof Node && chartContainer.contains(eventTarget)) {
				updateHighlightedSeries(event.clientX, event.clientY);
				return;
			}

			const chartBounds = chartContainer.getBoundingClientRect();
			const chartX = event.clientX - chartBounds.left;
			const chartY = event.clientY - chartBounds.top;
			if (
				chartX < 0 ||
				chartX > chartBounds.width ||
				chartY < 0 ||
				chartY > chartBounds.height
			) {
				return;
			}

			// Sampling gaps and coaching markers sit above the ECharts canvas so
			// they can expose their own details. Forward the physical pointer to
			// ECharts as well, keeping the crosshair and all still-available series
			// readable while the pointer is inside one of those overlays.
			chart.dispatchAction({
				type: "updateAxisPointer",
				x: chartX,
				y: chartY,
			});
			updateHighlightedSeries(event.clientX, event.clientY);
		};
		const repositionCursorTooltip = (): void => {
			if (lastPointerClientX === null || lastPointerClientY === null) return;

			const chartBounds = chartContainer.getBoundingClientRect();
			chart.dispatchAction({
				type: "updateAxisPointer",
				x: lastPointerClientX - chartBounds.left,
				y: lastPointerClientY - chartBounds.top,
			});
		};

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

			const chartBounds = chartContainer.getBoundingClientRect();
			chart.dispatchAction({
				type: "updateAxisPointer",
				x: wheelPointerClientX - chartBounds.left,
				y: wheelPointerClientY - chartBounds.top,
			});
		};

		const moveViewportFromHorizontalWheel = (event: WheelEvent): void => {
			if (event.ctrlKey) return;
			if (
				event.target instanceof Element &&
				event.target.closest("[data-telemetry-series-panel]")
			) {
				return;
			}

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
			wheelPointerClientX = event.clientX;
			wheelPointerClientY = event.clientY;
			wheelAnimationFrameId ??= requestAnimationFrame(flushHorizontalWheel);
		};

		// The overlays are siblings of the ECharts canvas. Listening on their shared
		// surface keeps a trackpad gesture alive when a moving marker passes under
		// the stationary pointer and becomes the next wheel-event target.
		interactionSurface.addEventListener(
			"wheel",
			moveViewportFromHorizontalWheel,
			{
				capture: true,
				passive: false,
			},
		);
		interactionSurface.addEventListener("pointerleave", clearCursorPosition, {
			passive: true,
		});
		interactionSurface.addEventListener(
			"pointermove",
			synchronizePointerAcrossOverlay,
			{
				capture: true,
				passive: true,
			},
		);
		interactionSurface.addEventListener(
			TELEMETRY_TOOLTIP_LAYOUT_EVENT,
			repositionCursorTooltip,
		);

		const resizeObserver = new ResizeObserver(() => chart.resize());
		resizeObserver.observe(chartContainer);

		return () => {
			resizeObserver.disconnect();
			if (wheelAnimationFrameId !== null) {
				cancelAnimationFrame(wheelAnimationFrameId);
			}
			interactionSurface.removeEventListener(
				"wheel",
				moveViewportFromHorizontalWheel,
				true,
			);
			interactionSurface.removeEventListener(
				"pointerleave",
				clearCursorPosition,
			);
			interactionSurface.removeEventListener(
				"pointermove",
				synchronizePointerAcrossOverlay,
				true,
			);
			interactionSurface.removeEventListener(
				TELEMETRY_TOOLTIP_LAYOUT_EVENT,
				repositionCursorTooltip,
			);
			chart.off("datazoom", updateViewport);
			chart.off("updateAxisPointer", updateCursorPosition);
			interactionSurface.removeEventListener("click", selectSeriesAtPointer);
			onCursorPositionChange(null);
			chart.dispose();
			chartRef.current = null;
			highlightedSeriesIdRef.current = null;
		};
	}, [
		interactionSurfaceRef,
		layout,
		onCursorPositionChange,
		onViewportChange,
		reviewedLapNumber,
		samplingGaps,
		secondLapNumber,
	]);

	useEffect(() => {
		if (!isGuideInspectingSeries) {
			if (
				guideSelectedSeriesIdRef.current !== null &&
				selectedSeriesRef.current?.lineId === guideSelectedSeriesIdRef.current
			) {
				setSelectedSeries(null);
			}
			guideSelectedSeriesIdRef.current = null;
			return;
		}

		if (selectedSeriesRef.current !== null || reviewedLapNumber === null) {
			return;
		}

		const lines = sections.flatMap((section) => section.lines);
		const click = createTelemetryGuideSelectionClick(lines, viewport);
		if (click === null) return;

		const selectedLine = lines.find((line) => line.id === click.seriesId);
		if (selectedLine === undefined) return;

		const guideSelection = createTelemetrySeriesSelection(
			lines,
			click,
			resolveSelectedSeriesTelemetryStatus({
				gaps: samplingGaps,
				reviewedLapNumber,
				secondLapNumber,
				role: selectedLine.role,
				measurement: selectedLine.measurement,
			}),
		);
		if (guideSelection === null) return;

		guideSelectedSeriesIdRef.current = guideSelection.lineId;
		setSelectedSeries(guideSelection);
	}, [
		isGuideInspectingSeries,
		reviewedLapNumber,
		samplingGaps,
		secondLapNumber,
		sections,
		viewport,
	]);

	useEffect(() => {
		const chart = chartRef.current;
		const highlightedSeriesId = highlightedSeriesIdRef.current;
		if (chart !== null && highlightedSeriesId !== null) {
			// A click starts from the transient hover emphasis. Clear that ECharts
			// action before rendering the persistent selection so it cannot survive
			// after the details panel is later closed away from the line.
			chart.dispatchAction({
				type: "downplay",
				seriesId: highlightedSeriesId,
			});
		}
		highlightedSeriesIdRef.current = null;
		const currentViewport = viewportRef.current;
		chart?.setOption(
			createTelemetryChartOption(
				sections,
				layout,
				currentViewport,
				() => activeGridIndexRef.current,
				idealLap,
				presentation,
				selectedSeries,
				reviewedLapIsLimited,
				() =>
					readVisibleTooltipObstacles(
						containerRef.current,
						null,
						TELEMETRY_TOOLTIP_PRIORITY.cursorValues,
					),
			),
			{ notMerge: true },
		);
		chartViewportRef.current = currentViewport;
	}, [
		sections,
		layout,
		idealLap,
		presentation,
		selectedSeries,
		reviewedLapIsLimited,
	]);

	useEffect(() => {
		if (selectedSeries === null) return;

		const clearOnEscape = (event: KeyboardEvent): void => {
			if (event.key === "Escape") setSelectedSeries(null);
		};
		window.addEventListener("keydown", clearOnEscape);
		return () => window.removeEventListener("keydown", clearOnEscape);
	}, [selectedSeries]);

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
	const selectedPositionRatio = selectedSeries
		? (selectedSeries.positionPercent - viewport.startPercent) /
			(viewport.endPercent - viewport.startPercent)
		: null;
	const firstGrid = layout[0];
	const lastGrid = layout.at(-1);
	const plotInsets = getTelemetryChartPlotInsets(presentation);
	const selectedSeriesAnchor =
		selectedSeries === null
			? null
			: createSelectedSeriesAnchor(selectedSeries, sections, layout, viewport);

	return (
		<>
			<div
				ref={containerRef}
				className={`absolute inset-0 touch-pan-y select-none ${isZoomed ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"}`}
				role="img"
				aria-label={createAccessibleChartDescription(model, sections)}
				title={
					isZoomed
						? "Drag left or right to move through the lap"
						: "Click a telemetry line to select it"
				}
			/>
			{selectedPositionRatio !== null &&
			selectedPositionRatio >= 0 &&
			selectedPositionRatio <= 1 &&
			firstGrid &&
			lastGrid ? (
				<div
					className="pointer-events-none absolute z-[22]"
					style={{
						left: plotInsets.leftPx,
						right: plotInsets.rightPx,
						top: `${firstGrid.topPercent}%`,
						bottom: `${100 - (lastGrid.topPercent + lastGrid.heightPercent)}%`,
					}}
					aria-hidden="true"
				>
					<span
						className="absolute inset-y-0 border-l border-dashed border-neutral-200/85"
						style={{ left: `${selectedPositionRatio * 100}%` }}
					/>
				</div>
			) : null}
			{selectedSeries && selectedSeriesAnchor ? (
				<SelectedTelemetrySeriesPanel
					selection={selectedSeries}
					color={findTelemetryRoleColor(
						selectedSeries.role,
						reviewedLapIsLimited,
					)}
					presentation={presentation}
					anchor={selectedSeriesAnchor}
					plotInsets={plotInsets}
					getTooltipObstacles={(excludedElement) =>
						readVisibleTooltipObstacles(
							containerRef.current,
							excludedElement,
							TELEMETRY_TOOLTIP_PRIORITY.selectedSeries,
						)
					}
					onClear={() => setSelectedSeries(null)}
				/>
			) : null}
		</>
	);
}

function createSelectedSeriesAnchor(
	selection: TelemetrySeriesSelection,
	sections: readonly TelemetryChartSection[],
	layout: readonly TelemetryChartGridLayout[],
	viewport: TelemetryViewport,
): { readonly plotXRatio: number; readonly chartYRatio: number } | null {
	const gridIndex = sections.findIndex((section) =>
		section.lines.some((line) => line.id === selection.lineId),
	);
	const section = sections[gridIndex];
	const grid = layout[gridIndex];
	if (section === undefined || grid === undefined) return null;

	const viewportSpan = viewport.endPercent - viewport.startPercent;
	if (viewportSpan <= 0 || section.yAxis.max <= section.yAxis.min) return null;

	const plotXRatio = clampRatio(
		(selection.positionPercent - viewport.startPercent) / viewportSpan,
	);
	const valueRatio = clampRatio(
		(selection.value - section.yAxis.min) /
			(section.yAxis.max - section.yAxis.min),
	);

	return {
		plotXRatio,
		chartYRatio:
			(grid.topPercent + (1 - valueRatio) * grid.heightPercent) / 100,
	};
}

function clampRatio(value: number): number {
	return Math.min(1, Math.max(0, value));
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
	presentation: TelemetryChartPresentation,
	selectedSeries: TelemetrySeriesSelection | null,
	reviewedLapIsLimited: boolean,
	getTooltipObstacles: () => readonly TelemetryTooltipRectangle[],
): TelemetryChartOption {
	const plotInsets = getTelemetryChartPlotInsets(presentation);
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
			// Hover emphasis is controlled by the generous proximity hit test above.
			// Letting the axis pointer emphasize too would make close traces flicker.
			triggerEmphasis: false,
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
			left: plotInsets.leftPx,
			right: plotInsets.rightPx,
			top: `${grid.topPercent}%`,
			height: `${grid.heightPercent}%`,
		})),
		tooltip: {
			// Cursor values stay available while a series is selected. Marker details
			// are suppressed separately so the chart keeps one transient explanation.
			show: true,
			className: "telemetry-chart-value-tooltip",
			extraCssText: "z-index: 260 !important;",
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
			position: (point, _parameters, _element, _rectangle, size) =>
				resolveTelemetryTooltipPosition({
					anchorX: point[0],
					anchorY: point[1],
					tooltipWidth: size.contentSize[0],
					tooltipHeight: size.contentSize[1],
					viewWidth: size.viewSize[0],
					viewHeight: size.viewSize[1],
					obstacles: getTooltipObstacles(),
				}),
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
			section.lines.map((line) =>
				createLineSeries(
					line,
					gridIndex,
					selectedSeries,
					presentation,
					reviewedLapIsLimited,
				),
			),
		),
	};
}

function readVisibleTooltipObstacles(
	chartContainer: HTMLElement | null,
	excludedElement: HTMLElement | null = null,
	maximumPriorityExclusive: number = TELEMETRY_TOOLTIP_PRIORITY.cursorValues,
): readonly TelemetryTooltipRectangle[] {
	if (chartContainer === null) return [];
	const chartSurface = chartContainer.closest<HTMLElement>(
		"[data-telemetry-chart-surface]",
	);
	if (chartSurface === null) return [];

	return readVisibleTelemetryTooltipObstacles({
		chartSurface,
		coordinateElement: chartContainer,
		excludedElement,
		maximumPriorityExclusive,
	});
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
	selectedSeries: TelemetrySeriesSelection | null,
	presentation: TelemetryChartPresentation,
	reviewedLapIsLimited: boolean,
): LineSeriesOption {
	const color = findTelemetryLineColor(line, reviewedLapIsLimited);
	const isSelected = selectedSeries?.lineId === line.id;
	const isSiblingOfSelection =
		selectedSeries !== null &&
		selectedSeries.measurement === line.measurement &&
		!isSelected;
	const isBackgroundSeries =
		selectedSeries !== null && !isSelected && !isSiblingOfSelection;
	const baseWidth =
		line.role === "ideal"
			? 1.5
			: line.measurement === "time-delta"
				? 1.75
				: 1.5;
	const opacity = isSiblingOfSelection
		? 0.18
		: isBackgroundSeries
			? Math.min(line.opacity ?? 1, 0.35)
			: (line.opacity ?? 1);
	const baseZ = getTelemetrySeriesBaseZ(line);
	const hoverWidthIncrease = presentation === "desktop" ? 1 : 0.65;

	return {
		id: line.id,
		name: line.name,
		type: "line",
		xAxisIndex: gridIndex,
		yAxisIndex: gridIndex,
		data: line.points.map(([position, value]) => [position, value]),
		showSymbol: false,
		triggerEvent: "line",
		connectNulls: false,
		// Pointer proximity is resolved consistently by the generous shared hit
		// test. Prevent ECharts' narrow native line hit from emphasizing a different
		// overlapping trace than the one the subsequent click will select.
		silent: true,
		step: line.measurement === "gear" ? "end" : false,
		lineStyle: {
			color,
			width: isSelected ? baseWidth + 1 : baseWidth,
			type: line.lineStyle ?? "solid",
			opacity,
			shadowBlur: isSelected ? 4 : 0,
			shadowColor: isSelected ? color : "transparent",
		},
		itemStyle: { color, opacity },
		emphasis: {
			disabled: selectedSeries !== null,
			lineStyle: {
				width: baseWidth + hoverWidthIncrease,
				opacity: 1,
				shadowBlur: presentation === "desktop" ? 4 : 2,
				shadowColor: color,
			},
		},
		markPoint: isSelected
			? {
					silent: false,
					symbol: "circle",
					symbolSize: 13,
					label: { show: false },
					itemStyle: {
						color: "#f5f5f4",
						borderColor: color,
						borderWidth: 3,
						shadowBlur: 8,
						shadowColor: color,
					},
					data: [
						{
							name: "Selected telemetry point",
							coord: [selectedSeries.positionPercent, selectedSeries.value],
						},
					],
				}
			: undefined,
		z: isSelected ? TELEMETRY_SERIES_SELECTED_Z : baseZ,
	};
}

function findTelemetryLineById(
	sections: readonly TelemetryChartSection[],
	seriesId: string,
): TelemetryChartLine | null {
	for (const section of sections) {
		const line = section.lines.find((candidate) => candidate.id === seriesId);
		if (line !== undefined) return line;
	}
	return null;
}

function getTelemetrySeriesBaseZ(line: TelemetryChartLine): number {
	if (line.role === "reviewed") return 6;
	if (line.role === "second") return 5;
	return 4;
}

function findTelemetryLineColor(
	line: TelemetryChartLine,
	reviewedLapIsLimited: boolean,
): string {
	return findTelemetryRoleColor(line.role, reviewedLapIsLimited);
}

function findTelemetryRoleColor(
	role: TelemetryChartLine["role"],
	reviewedLapIsLimited: boolean,
): string {
	if (role === "reviewed") {
		return reviewedLapIsLimited
			? LIMITED_REVIEWED_LAP_COLOR
			: REVIEWED_LAP_COLOR;
	}
	if (role === "second") return SECOND_LAP_COLOR;
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

function ApproximateTimeDeltaNotice({
	sections,
	layout,
	presentation,
}: {
	readonly sections: readonly TelemetryChartSection[];
	readonly layout: readonly TelemetryChartGridLayout[];
	readonly presentation: "desktop" | "compact";
}) {
	const timeDeltaIndex = sections.findIndex(
		(section) => section.id === "time-delta",
	);
	const timeDeltaLayout = layout[timeDeltaIndex];
	if (timeDeltaLayout === undefined) return null;

	return (
		<div
			className={`pointer-events-none absolute z-20 flex items-center gap-2 ${
				presentation === "compact" ? "left-[76px]" : "left-[104px]"
			}`}
			style={{ top: `${timeDeltaLayout.topPercent + 1.5}%` }}
			role="status"
			aria-label="Time delta is approximate because boundary timing is uncertain"
		>
			<span className="rounded-[3px] border border-amber-500/80 bg-amber-500/[0.08] px-2 py-1 text-[9px] font-semibold tracking-[0.06em] text-amber-400 uppercase">
				Approximate
			</span>
			<span className="hidden text-[10px] text-neutral-500 min-[720px]:inline">
				Boundary timing is uncertain
			</span>
		</div>
	);
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
