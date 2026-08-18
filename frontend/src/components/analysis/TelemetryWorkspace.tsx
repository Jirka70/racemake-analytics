import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackRegionResponse } from "../../../../src/http/contracts";
import {
	resolveTelemetryWheelGestureAxis,
	resolveTelemetryWheelScrollTarget,
	TELEMETRY_WHEEL_GESTURE_IDLE_MS,
	type TelemetryWheelGestureAxis,
} from "../../analysis/telemetry-chart-scroll";
import type { TelemetryChartId } from "../../analysis/telemetry-chart-selection";
import { FULL_LAP_TELEMETRY_VIEWPORT } from "../../analysis/telemetry-viewport";
import { useCompactAnalysisLayout } from "../../hooks/use-compact-analysis-layout";
import {
	TelemetryComparisonChart,
	type TelemetryComparisonChartDataProps,
} from "./charts/TelemetryComparisonChart";
import { TelemetryDeltaOverview } from "./charts/TelemetryDeltaOverview";
import { TelemetryZoomControls } from "./charts/TelemetryZoomControls";
import {
	TrackRegionBand,
	type TrackRegionBandProps,
} from "./charts/TrackRegionBand";
import { LapPicker, type LapPickerProps } from "./laps/LapPicker";
import { MobileChartTabs } from "./mobile/MobileChartTabs";
import { MobileLapSummary } from "./mobile/MobileLapSummary";
import { MobileTrackRegionBand } from "./mobile/MobileTrackRegionBand";

export interface MobileTelemetryChartControls {
	readonly activeChartId: TelemetryChartId;
	readonly availableChartIds: readonly TelemetryChartId[];
	readonly onSelectChart: (chartId: TelemetryChartId) => void;
}

interface TelemetryWorkspaceProps {
	readonly lapPicker: LapPickerProps;
	readonly telemetryChart: TelemetryComparisonChartDataProps;
	readonly trackRegionBand: Omit<
		TrackRegionBandProps,
		"viewport" | "selectedRegionId" | "onSelectRegion"
	>;
	readonly mobileChart: MobileTelemetryChartControls;
}

export function TelemetryWorkspace({
	lapPicker,
	telemetryChart,
	trackRegionBand,
	mobileChart,
}: TelemetryWorkspaceProps) {
	const isCompact = useCompactAnalysisLayout();
	const [viewport, setViewport] = useState(FULL_LAP_TELEMETRY_VIEWPORT);
	const workspaceScrollContainerRef = useRef<HTMLElement>(null);
	const chartScrollContainerRef = useRef<HTMLDivElement>(null);
	const compactVisibleChartIds = useMemo<readonly TelemetryChartId[]>(
		() => [mobileChart.activeChartId],
		[mobileChart.activeChartId],
	);
	const selectableRegions = useMemo(
		() => trackRegionBand.regions.filter((region) => region.type === "corner"),
		[trackRegionBand.regions],
	);
	const [selectedRegionId, setSelectedRegionId] = useState<
		TrackRegionResponse["id"] | null
	>(null);
	const selectedRegion =
		selectableRegions.find((region) => region.id === selectedRegionId) ?? null;
	const selectedRegionIndex = selectedRegion
		? selectableRegions.indexOf(selectedRegion)
		: -1;
	const fragment = telemetryChart.fragment;
	const activeReviewKey = fragment
		? `fragment:${fragment.key}`
		: `lap:${telemetryChart.reviewedLapNumber ?? "none"}`;
	const previousReviewKeyRef = useRef(activeReviewKey);
	const activeCoachingFocusKey =
		fragment === null &&
		telemetryChart.activeCoachingRank !== null &&
		telemetryChart.activeCoachingRegionId !== null
			? `${telemetryChart.reviewedLapNumber ?? "none"}:${telemetryChart.activeCoachingRank}:${telemetryChart.activeCoachingRegionId}`
			: null;
	const previousCoachingFocusKeyRef = useRef<string | null>(null);

	useEffect(() => {
		if (previousReviewKeyRef.current === activeReviewKey) return;
		previousReviewKeyRef.current = activeReviewKey;
		setViewport(FULL_LAP_TELEMETRY_VIEWPORT);
		setSelectedRegionId(null);
	}, [activeReviewKey]);

	useEffect(() => {
		if (activeCoachingFocusKey === null) {
			previousCoachingFocusKeyRef.current = null;
			return;
		}

		if (previousCoachingFocusKeyRef.current === activeCoachingFocusKey) {
			return;
		}

		const activeRegion = selectableRegions.find(
			(region) => region.id === telemetryChart.activeCoachingRegionId,
		);
		if (!activeRegion) return;

		previousCoachingFocusKeyRef.current = activeCoachingFocusKey;
		setSelectedRegionId(activeRegion.id);
	}, [
		activeCoachingFocusKey,
		selectableRegions,
		telemetryChart.activeCoachingRegionId,
	]);

	useEffect(() => {
		const scrollContainer = chartScrollContainerRef.current;
		if (scrollContainer === null) return;
		const chartScroller: HTMLDivElement = scrollContainer;
		let gestureAxis: TelemetryWheelGestureAxis | null = null;
		let lastWheelEventTimestampMs = Number.NEGATIVE_INFINITY;

		function scrollCharts(event: WheelEvent): void {
			if (event.ctrlKey) return;

			const continuesGesture =
				event.timeStamp - lastWheelEventTimestampMs <=
				TELEMETRY_WHEEL_GESTURE_IDLE_MS;
			const nextGestureAxis = resolveTelemetryWheelGestureAxis({
				deltaX: event.deltaX,
				deltaY: event.deltaY,
				shiftKey: event.shiftKey,
				lockedAxis: continuesGesture ? gestureAxis : null,
			});
			if (nextGestureAxis === null) return;

			gestureAxis = nextGestureAxis;
			lastWheelEventTimestampMs = event.timeStamp;

			// The chart canvas owns horizontal panning for every responsive
			// composition. This listener only keeps vertical scrolling out of it.
			if (gestureAxis === "horizontal") return;

			event.stopPropagation();

			const workspaceScroller = workspaceScrollContainerRef.current;
			const update = resolveTelemetryWheelScrollTarget({
				isCompact,
				chart: {
					currentScrollTop: chartScroller.scrollTop,
					maximumScrollTop: Math.max(
						0,
						chartScroller.scrollHeight - chartScroller.clientHeight,
					),
					pageHeightPx: chartScroller.clientHeight,
				},
				workspace: workspaceScroller
					? {
							currentScrollTop: workspaceScroller.scrollTop,
							maximumScrollTop: Math.max(
								0,
								workspaceScroller.scrollHeight - workspaceScroller.clientHeight,
							),
							pageHeightPx: workspaceScroller.clientHeight,
						}
					: null,
				deltaY: event.deltaY,
				deltaMode: event.deltaMode,
			});

			if (update === null) return;

			// ECharts listens for wheel gestures on its canvas even when wheel zoom is
			// disabled. Handle vertical movement before it reaches the canvas so both
			// mouse wheels and high-resolution trackpads scroll the chart stack reliably.
			event.preventDefault();
			if (update.target === "workspace" && workspaceScroller) {
				workspaceScroller.scrollTop = update.nextScrollTop;
				return;
			}
			chartScroller.scrollTop = update.nextScrollTop;
		}

		chartScroller.addEventListener("wheel", scrollCharts, {
			capture: true,
			passive: false,
		});

		return () => {
			chartScroller.removeEventListener("wheel", scrollCharts, true);
		};
	}, [isCompact]);

	function selectAdjacentRegion(direction: -1 | 1): void {
		if (selectedRegionIndex < 0) return;

		const nextRegion = selectableRegions[selectedRegionIndex + direction];
		if (nextRegion) setSelectedRegionId(nextRegion.id);
	}

	function toggleSelectedRegion(regionId: TrackRegionResponse["id"]): void {
		setSelectedRegionId((currentRegionId) =>
			currentRegionId === regionId ? null : regionId,
		);
	}

	const deltaOverview = (
		<TelemetryDeltaOverview
			status={telemetryChart.status}
			series={telemetryChart.series}
			reviewedLapNumber={telemetryChart.reviewedLapNumber}
			secondLapNumber={telemetryChart.secondLapNumber}
			idealLapSeries={telemetryChart.idealLapSeries}
			viewport={viewport}
			selectedRegion={selectedRegion}
		/>
	);

	if (isCompact) {
		return (
			<section
				ref={workspaceScrollContainerRef}
				className="h-full min-h-0 touch-pan-y overflow-y-auto overscroll-contain px-3 pt-2 pb-[calc(88px+env(safe-area-inset-bottom))]"
				aria-label="Telemetry workspace"
			>
				<MobileLapSummary {...lapPicker} />
				<div className="mt-2">
					<MobileTrackRegionBand
						{...trackRegionBand}
						fragment={fragment}
						viewport={viewport}
						selectedRegionId={selectedRegionId}
						onSelectRegion={toggleSelectedRegion}
					/>
				</div>
				<div className="mt-2">
					<MobileChartTabs
						chartIds={mobileChart.availableChartIds}
						activeChartId={mobileChart.activeChartId}
						onSelectChart={mobileChart.onSelectChart}
					/>
				</div>
				<div
					ref={chartScrollContainerRef}
					className="mt-2 h-[390px] min-h-[390px]"
					data-testid="telemetry-chart-scroll"
				>
					<TelemetryComparisonChart
						{...telemetryChart}
						visibleChartIds={compactVisibleChartIds}
						viewport={viewport}
						onViewportChange={setViewport}
						selectedRegion={selectedRegion}
						presentation="compact"
					/>
				</div>
				<div className="mt-2">
					<TelemetryZoomControls
						presentation="compact"
						viewLabel={fragment ? "Full fragment" : "Full lap"}
						viewport={viewport}
						onViewportChange={setViewport}
						selectedRegion={selectedRegion}
						onSelectPreviousRegion={() => selectAdjacentRegion(-1)}
						onSelectNextRegion={() => selectAdjacentRegion(1)}
						canSelectPreviousRegion={selectedRegionIndex > 0}
						canSelectNextRegion={
							selectedRegionIndex >= 0 &&
							selectedRegionIndex < selectableRegions.length - 1
						}
						showComparisonControls={telemetryChart.secondLapNumber !== null}
						deltaOverview={deltaOverview}
					/>
				</div>
			</section>
		);
	}

	return (
		<section
			className="grid min-h-0 grid-rows-[124px_44px_minmax(0,1fr)_72px] gap-1.5 overflow-hidden"
			aria-label="Telemetry workspace"
		>
			<LapPicker {...lapPicker} />
			<TrackRegionBand
				{...trackRegionBand}
				fragment={fragment}
				viewport={viewport}
				selectedRegionId={selectedRegionId}
				onSelectRegion={toggleSelectedRegion}
			/>
			<div
				ref={chartScrollContainerRef}
				className="min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
				data-testid="telemetry-chart-scroll"
			>
				<TelemetryComparisonChart
					{...telemetryChart}
					viewport={viewport}
					onViewportChange={setViewport}
					selectedRegion={selectedRegion}
				/>
			</div>
			<TelemetryZoomControls
				viewLabel={fragment ? "Full fragment" : "Full lap"}
				viewport={viewport}
				onViewportChange={setViewport}
				selectedRegion={selectedRegion}
				onSelectPreviousRegion={() => selectAdjacentRegion(-1)}
				onSelectNextRegion={() => selectAdjacentRegion(1)}
				canSelectPreviousRegion={selectedRegionIndex > 0}
				canSelectNextRegion={
					selectedRegionIndex >= 0 &&
					selectedRegionIndex < selectableRegions.length - 1
				}
				showComparisonControls={telemetryChart.secondLapNumber !== null}
				deltaOverview={deltaOverview}
			/>
		</section>
	);
}
