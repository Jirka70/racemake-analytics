import { useEffect, useRef, useState } from "react";
import type { TrackRegionResponse } from "../../../../src/http/contracts";
import { calculateTelemetryChartScrollTop } from "../../analysis/telemetry-chart-scroll";
import { FULL_LAP_TELEMETRY_VIEWPORT } from "../../analysis/telemetry-viewport";
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

interface TelemetryWorkspaceProps {
	readonly lapPicker: LapPickerProps;
	readonly telemetryChart: TelemetryComparisonChartDataProps;
	readonly trackRegionBand: Omit<
		TrackRegionBandProps,
		"viewport" | "selectedRegionId" | "onSelectRegion"
	>;
}

export function TelemetryWorkspace({
	lapPicker,
	telemetryChart,
	trackRegionBand,
}: TelemetryWorkspaceProps) {
	const [viewport, setViewport] = useState(FULL_LAP_TELEMETRY_VIEWPORT);
	const chartScrollContainerRef = useRef<HTMLDivElement>(null);
	const selectableRegions = trackRegionBand.regions.filter(
		(region) => region.type === "corner",
	);
	const [selectedRegionId, setSelectedRegionId] = useState<
		TrackRegionResponse["id"] | null
	>(null);
	const selectedRegion =
		selectableRegions.find((region) => region.id === selectedRegionId) ?? null;
	const selectedRegionIndex = selectedRegion
		? selectableRegions.indexOf(selectedRegion)
		: -1;

	useEffect(() => {
		const scrollContainer = chartScrollContainerRef.current;
		if (scrollContainer === null) return;
		const chartScroller: HTMLDivElement = scrollContainer;

		function scrollCharts(event: WheelEvent): void {
			if (event.ctrlKey || event.deltaY === 0) return;

			const currentScrollTop = chartScroller.scrollTop;
			const maximumScrollTop = Math.max(
				0,
				chartScroller.scrollHeight - chartScroller.clientHeight,
			);
			const nextScrollTop = calculateTelemetryChartScrollTop({
				currentScrollTop,
				maximumScrollTop,
				deltaY: event.deltaY,
				deltaMode: event.deltaMode,
				pageHeightPx: chartScroller.clientHeight,
			});

			if (nextScrollTop === currentScrollTop) return;

			// ECharts listens for wheel gestures on its canvas even when wheel zoom is
			// disabled. Handle vertical movement before it reaches the canvas so both
			// mouse wheels and high-resolution trackpads scroll the chart stack reliably.
			event.preventDefault();
			event.stopPropagation();
			chartScroller.scrollTop = nextScrollTop;
		}

		chartScroller.addEventListener("wheel", scrollCharts, {
			capture: true,
			passive: false,
		});

		return () => {
			chartScroller.removeEventListener("wheel", scrollCharts, true);
		};
	}, []);

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

	return (
		<section
			className="grid min-h-0 grid-rows-[108px_44px_minmax(0,1fr)_72px] gap-1.5 overflow-hidden"
			aria-label="Telemetry workspace"
		>
			<LapPicker {...lapPicker} />
			<TrackRegionBand
				{...trackRegionBand}
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
				deltaOverview={
					<TelemetryDeltaOverview
						status={telemetryChart.status}
						series={telemetryChart.series}
						reviewedLapNumber={telemetryChart.reviewedLapNumber}
						secondLapNumber={telemetryChart.secondLapNumber}
						idealLapSeries={telemetryChart.idealLapSeries}
						viewport={viewport}
						selectedRegion={selectedRegion}
					/>
				}
			/>
		</section>
	);
}
