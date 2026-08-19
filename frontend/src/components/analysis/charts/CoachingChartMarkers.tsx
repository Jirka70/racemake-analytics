import { useState } from "react";
import type {
	CoachingChartMarker,
	CoachingPriorityLabel,
} from "../../../analysis/coaching-findings";
import type { TelemetryViewport } from "../../../analysis/telemetry-viewport";
import {
	TelemetryFloatingTooltip,
	TELEMETRY_TOOLTIP_PRIORITY,
} from "./TelemetryFloatingTooltip";

interface CoachingMarkerTheme {
	readonly color: string;
	readonly lineWidthPx: number;
	readonly lineOpacity: number;
	readonly bandOpacity: number;
	readonly stackOrder: number;
}

const COACHING_MARKER_THEMES: Readonly<
	Record<CoachingPriorityLabel, CoachingMarkerTheme>
> = {
	CRITICAL: {
		color: "#ff5c5c",
		lineWidthPx: 2,
		lineOpacity: 1,
		bandOpacity: 0.16,
		stackOrder: 4,
	},
	HIGH: {
		color: "#ff8a3d",
		lineWidthPx: 2,
		lineOpacity: 0.82,
		bandOpacity: 0.13,
		stackOrder: 3,
	},
	MODERATE: {
		color: "#f2b84b",
		lineWidthPx: 1.5,
		lineOpacity: 0.58,
		bandOpacity: 0.1,
		stackOrder: 2,
	},
	LOW: {
		color: "#8b949e",
		lineWidthPx: 1,
		lineOpacity: 0.38,
		bandOpacity: 0.06,
		stackOrder: 1,
	},
};

export interface CoachingChartMarkersProps {
	readonly markers: readonly CoachingChartMarker[];
	readonly activeRank: number | null;
	readonly viewport: TelemetryViewport;
	readonly onSelectRank: (rank: number) => void;
}

export function CoachingChartMarkers({
	markers,
	activeRank,
	viewport,
	onSelectRank,
}: CoachingChartMarkersProps) {
	const [tooltipRank, setTooltipRank] = useState<number | null>(null);
	const viewportSpan = viewport.endPercent - viewport.startPercent;
	const visibleMarkers = markers.filter(
		(marker) =>
			marker.positionPercent >= viewport.startPercent &&
			marker.positionPercent <= viewport.endPercent,
	);
	const tooltipMarker = visibleMarkers.find(
		(marker) => marker.rank === tooltipRank,
	);

	return (
		<>
			<div className="pointer-events-none absolute inset-0 z-20">
				{visibleMarkers.map((marker) => {
					const theme = COACHING_MARKER_THEMES[marker.priority];
					const relativePosition =
						(marker.positionPercent - viewport.startPercent) / viewportSpan;
					const isActive = marker.rank === activeRank;
					const isEmphasized = isActive || marker.rank === tooltipRank;
					const detailsId = `coaching-marker-tooltip-${marker.rank}`;

					return (
						<button
							key={marker.rank}
							type="button"
							className="group pointer-events-auto absolute inset-y-0 w-3 -translate-x-1/2 cursor-pointer focus-visible:outline-none"
							style={{
								left: `${relativePosition * 100}%`,
								zIndex: isEmphasized ? 10 : theme.stackOrder,
							}}
							onClick={() => onSelectRank(marker.rank)}
							onPointerEnter={() => setTooltipRank(marker.rank)}
							onPointerLeave={(event) => {
								if (document.activeElement !== event.currentTarget) {
									setTooltipRank(null);
								}
							}}
							onFocus={() => setTooltipRank(marker.rank)}
							onBlur={() => setTooltipRank(null)}
							aria-describedby={detailsId}
							aria-label={`${marker.priority} coaching finding in ${marker.regionName}, ${Math.round(marker.timeLossMs)} milliseconds lost at ${marker.positionPercent.toFixed(1)} percent of the lap`}
						>
							<span
								className="absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 transition-opacity"
								style={{
									backgroundColor: theme.color,
									opacity: isEmphasized
										? Math.min(theme.bandOpacity + 0.06, 0.24)
										: theme.bandOpacity,
								}}
							/>
							<span
								className="absolute inset-y-0 left-1/2 -translate-x-1/2 transition-opacity duration-150 motion-reduce:transition-none"
								style={{
									backgroundColor: theme.color,
									width: `${theme.lineWidthPx}px`,
									opacity: isEmphasized ? 1 : theme.lineOpacity,
								}}
							/>
						</button>
					);
				})}
			</div>
			{tooltipMarker ? (
				<div
					className="pointer-events-none absolute inset-0 z-[240] overflow-visible"
					data-telemetry-marker-tooltip
				>
					<TelemetryFloatingTooltip
						id={`coaching-marker-tooltip-${tooltipMarker.rank}`}
						anchor={{
							xRatio:
								(tooltipMarker.positionPercent - viewport.startPercent) /
								viewportSpan,
							yRatio: 0,
						}}
						priority={TELEMETRY_TOOLTIP_PRIORITY.coaching}
						className="min-w-44 max-w-[calc(100%-16px)] rounded-[3px] border border-[#4b504c] bg-[#111412]/97 p-2 text-left shadow-2xl backdrop-blur-sm"
					>
						<CoachingTooltipContent marker={tooltipMarker} />
					</TelemetryFloatingTooltip>
				</div>
			) : null}
		</>
	);
}

function CoachingTooltipContent({
	marker,
}: {
	readonly marker: CoachingChartMarker;
}) {
	const theme = COACHING_MARKER_THEMES[marker.priority];

	return (
		<>
			<span
				className="block text-[9px] font-semibold tracking-[0.06em]"
				style={{ color: theme.color }}
			>
				{marker.priority} PRIORITY
			</span>
			<span className="mt-1 block text-[11px] font-semibold text-neutral-100">
				{marker.title}
			</span>
			<span className="mt-1 block text-[10px] text-neutral-400">
				{marker.regionName} · {Math.round(marker.timeLossMs)} ms lost ·{" "}
				{marker.positionPercent.toFixed(1)}% lap position
			</span>
		</>
	);
}
