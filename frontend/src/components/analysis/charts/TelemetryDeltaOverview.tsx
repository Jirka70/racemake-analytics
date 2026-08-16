import { LineChart, type LineSeriesOption } from "echarts/charts";
import { GridComponent, type GridComponentOption } from "echarts/components";
import { type ComposeOption, init, use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useMemo, useRef } from "react";
import type {
	AvailableIdealLapResponse,
	SeriesResponse,
	TrackRegionResponse,
} from "../../../../../src/http/contracts";
import { createTelemetryChartModel } from "../../../analysis/telemetry-chart";
import {
	createTrackRegionSegments,
	type TelemetryViewport,
} from "../../../analysis/telemetry-viewport";

use([LineChart, GridComponent, CanvasRenderer]);

type TelemetryDeltaOverviewOption = ComposeOption<
	LineSeriesOption | GridComponentOption
>;

export interface TelemetryDeltaOverviewProps {
	readonly status: "loading" | "ready" | "empty" | "error";
	readonly series: SeriesResponse | null;
	readonly reviewedLapNumber: number | null;
	readonly secondLapNumber: number | null;
	readonly idealLapSeries: AvailableIdealLapResponse | null;
	readonly viewport: TelemetryViewport;
	readonly selectedRegion: TrackRegionResponse | null;
}

const REVIEWED_LAP_COLOR = "#a3e635";
const SECOND_LAP_COLOR = "#a78bfa";
const IDEAL_LAP_COLOR = "#9ca3af";

export function TelemetryDeltaOverview({
	status,
	series,
	reviewedLapNumber,
	secondLapNumber,
	idealLapSeries,
	viewport,
	selectedRegion,
}: TelemetryDeltaOverviewProps) {
	const model = useMemo(() => {
		if (
			status !== "ready" ||
			series === null ||
			reviewedLapNumber === null ||
			secondLapNumber === null
		) {
			return null;
		}

		return createTelemetryChartModel(
			series,
			reviewedLapNumber,
			secondLapNumber,
			idealLapSeries,
		);
	}, [status, series, reviewedLapNumber, secondLapNumber, idealLapSeries]);
	const selectedRegionSegments = selectedRegion
		? createTrackRegionSegments([selectedRegion])
		: [];
	const viewportSpan = viewport.endPercent - viewport.startPercent;

	return (
		<figure
			className="relative h-10 min-w-0 overflow-hidden rounded-[2px] border border-[#242925] bg-[#0d100e]"
			aria-label="Full-lap time delta overview"
		>
			{model ? (
				<TelemetryDeltaOverviewCanvas
					points={model.timeDelta.points}
					idealPoints={model.idealTimeDelta?.points ?? null}
					maximumAbsoluteSeconds={model.maximumAbsoluteTimeDeltaSeconds}
				/>
			) : (
				<div className="absolute top-1/2 right-2 left-2 h-px bg-[#333834]" />
			)}

			{viewportSpan < 100 && (
				<span
					className="pointer-events-none absolute inset-y-0 z-[2] border-x border-neutral-300/50 bg-neutral-200/[0.04]"
					style={{
						left: `${viewport.startPercent}%`,
						width: `${viewportSpan}%`,
					}}
					aria-hidden="true"
				/>
			)}

			{selectedRegionSegments.map((segment) => (
				<span
					key={`${segment.id}-${segment.startPercent}-${segment.endPercent}`}
					className="pointer-events-none absolute inset-y-0 z-[3] border-x border-violet-400/30 bg-violet-400/15"
					style={{
						left: `${segment.startPercent}%`,
						width: `${segment.endPercent - segment.startPercent}%`,
					}}
					aria-hidden="true"
				/>
			))}

			<figcaption className="sr-only">
				Full-lap time difference. The outlined area is visible in the charts and
				the violet area is the selected region.
			</figcaption>
		</figure>
	);
}

function TelemetryDeltaOverviewCanvas({
	points,
	idealPoints,
	maximumAbsoluteSeconds,
}: {
	readonly points: readonly (readonly [number, number | null])[];
	readonly idealPoints: readonly (readonly [number, number | null])[] | null;
	readonly maximumAbsoluteSeconds: number;
}) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const chart = init(container, undefined, { renderer: "canvas" });
		chart.setOption(
			createTelemetryDeltaOverviewOption(
				points,
				idealPoints,
				maximumAbsoluteSeconds,
			),
		);
		const resizeObserver = new ResizeObserver(() => chart.resize());
		resizeObserver.observe(container);

		return () => {
			resizeObserver.disconnect();
			chart.dispose();
		};
	}, [points, idealPoints, maximumAbsoluteSeconds]);

	return (
		<div ref={containerRef} className="absolute inset-0" aria-hidden="true" />
	);
}

function createTelemetryDeltaOverviewOption(
	points: readonly (readonly [number, number | null])[],
	idealPoints: readonly (readonly [number, number | null])[] | null,
	maximumAbsoluteSeconds: number,
): TelemetryDeltaOverviewOption {
	const maximumRangeSeconds = Math.max(0.1, maximumAbsoluteSeconds);

	return {
		animation: false,
		backgroundColor: "transparent",
		grid: { left: 2, right: 2, top: 4, bottom: 4 },
		xAxis: {
			type: "value",
			min: 0,
			max: 100,
			show: false,
		},
		yAxis: {
			type: "value",
			min: -maximumRangeSeconds,
			max: maximumRangeSeconds,
			show: false,
		},
		series: [
			{
				id: "overview-reference-baseline",
				type: "line",
				data: [
					[0, 0],
					[100, 0],
				],
				showSymbol: false,
				silent: true,
				lineStyle: {
					color: SECOND_LAP_COLOR,
					width: 1,
					opacity: 0.65,
				},
			},
			{
				id: "overview-ideal-time-delta",
				type: "line",
				data: idealPoints?.map(([position, value]) => [position, value]) ?? [],
				showSymbol: false,
				connectNulls: false,
				silent: true,
				lineStyle: {
					color: IDEAL_LAP_COLOR,
					width: 1,
					type: "dotted",
					opacity: 0.8,
				},
			},
			{
				id: "overview-time-delta",
				type: "line",
				data: points.map(([position, value]) => [position, value]),
				showSymbol: false,
				connectNulls: false,
				silent: true,
				lineStyle: {
					color: REVIEWED_LAP_COLOR,
					width: 1.25,
				},
			},
		],
	};
}
