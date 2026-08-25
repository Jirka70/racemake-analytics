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
	readonly reviewedLapIsLimited: boolean;
	readonly viewport: TelemetryViewport;
	readonly selectedRegion: TrackRegionResponse | null;
	readonly cursorPositionPercent: number | null;
}

const REVIEWED_LAP_COLOR = "#a3e635";
const LIMITED_REVIEWED_LAP_COLOR = "#f59e0b";
const SECOND_LAP_COLOR = "#a78bfa";
const IDEAL_LAP_COLOR = "#d4d4d8";

export function TelemetryDeltaOverview({
	status,
	series,
	reviewedLapNumber,
	secondLapNumber,
	idealLapSeries,
	reviewedLapIsLimited,
	viewport,
	selectedRegion,
	cursorPositionPercent,
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
			className="relative h-10 min-w-0 rounded-[2px] border border-[#242925] bg-[#0d100e]"
			aria-label="Full-lap time delta overview"
		>
			{model?.timeDelta ? (
				<TelemetryDeltaOverviewCanvas
					points={model.timeDelta.points}
					idealPoints={model.idealTimeDelta?.points ?? null}
					maximumAbsoluteSeconds={model.maximumAbsoluteTimeDeltaSeconds}
					reviewedLapIsLimited={reviewedLapIsLimited}
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

			{cursorPositionPercent !== null && (
				<CursorPositionIndicator positionPercent={cursorPositionPercent} />
			)}

			<figcaption className="sr-only">
				Full-lap time difference. The outlined area is visible in the charts and
				the violet area is the selected region.
			</figcaption>
		</figure>
	);
}

function CursorPositionIndicator({
	positionPercent,
}: {
	readonly positionPercent: number;
}) {
	const labelAlignment =
		positionPercent <= 8
			? "left-0"
			: positionPercent >= 92
				? "right-0"
				: "left-1/2 -translate-x-1/2";

	return (
		<span
			className="pointer-events-none absolute inset-y-0 z-20 w-px -translate-x-1/2 bg-neutral-100 shadow-[0_0_5px_rgba(255,255,255,0.3)]"
			style={{ left: `${positionPercent}%` }}
			aria-hidden="true"
		>
			<span className="absolute -top-[4px] left-1/2 size-2 -translate-x-1/2 rounded-full border border-[#111412] bg-neutral-100 shadow-[0_0_4px_rgba(255,255,255,0.45)]" />
			<span
				className={`absolute bottom-full mb-1 whitespace-nowrap rounded-[3px] border border-[#3b403c] bg-[#171a18] px-1.5 py-0.5 text-[9px] font-semibold leading-4 tabular-nums text-neutral-100 shadow-lg ${labelAlignment}`}
			>
				{positionPercent.toFixed(1)}%
			</span>
		</span>
	);
}

function TelemetryDeltaOverviewCanvas({
	points,
	idealPoints,
	maximumAbsoluteSeconds,
	reviewedLapIsLimited,
}: {
	readonly points: readonly (readonly [number, number | null])[];
	readonly idealPoints: readonly (readonly [number, number | null])[] | null;
	readonly maximumAbsoluteSeconds: number;
	readonly reviewedLapIsLimited: boolean;
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
				reviewedLapIsLimited,
			),
		);
		const resizeObserver = new ResizeObserver(() => chart.resize());
		resizeObserver.observe(container);

		return () => {
			resizeObserver.disconnect();
			chart.dispose();
		};
	}, [points, idealPoints, maximumAbsoluteSeconds, reviewedLapIsLimited]);

	return (
		<div ref={containerRef} className="absolute inset-0" aria-hidden="true" />
	);
}

function createTelemetryDeltaOverviewOption(
	points: readonly (readonly [number, number | null])[],
	idealPoints: readonly (readonly [number, number | null])[] | null,
	maximumAbsoluteSeconds: number,
	reviewedLapIsLimited: boolean,
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
					width: 1.5,
					type: "dotted",
					opacity: 0.9,
				},
				z: 3,
			},
			{
				id: "overview-time-delta",
				type: "line",
				data: points.map(([position, value]) => [position, value]),
				showSymbol: false,
				connectNulls: false,
				silent: true,
				lineStyle: {
					color: reviewedLapIsLimited
						? LIMITED_REVIEWED_LAP_COLOR
						: REVIEWED_LAP_COLOR,
					width: 1.25,
				},
			},
		],
	};
}
