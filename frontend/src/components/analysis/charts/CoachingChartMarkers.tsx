import type {
	CoachingChartMarker,
	CoachingPriorityLabel,
} from "../../../analysis/coaching-findings";
import type { TelemetryViewport } from "../../../analysis/telemetry-viewport";

interface CoachingMarkerTheme {
	readonly color: string;
	readonly lineWidthPx: number;
	readonly bandOpacity: number;
}

const COACHING_MARKER_THEMES: Readonly<
	Record<CoachingPriorityLabel, CoachingMarkerTheme>
> = {
	CRITICAL: {
		color: "#ff5c5c",
		lineWidthPx: 2,
		bandOpacity: 0.16,
	},
	HIGH: {
		color: "#ff8a3d",
		lineWidthPx: 2,
		bandOpacity: 0.13,
	},
	MODERATE: {
		color: "#f2b84b",
		lineWidthPx: 1.5,
		bandOpacity: 0.1,
	},
	LOW: {
		color: "#8b949e",
		lineWidthPx: 1,
		bandOpacity: 0.06,
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
	const viewportSpan = viewport.endPercent - viewport.startPercent;
	const visibleMarkers = markers.filter(
		(marker) =>
			marker.positionPercent >= viewport.startPercent &&
			marker.positionPercent <= viewport.endPercent,
	);

	return (
		<div className="pointer-events-none absolute top-[16px] right-[12px] bottom-[36px] left-[58px] z-20 min-[1024px]:top-[18px] min-[1024px]:right-[18px] min-[1024px]:bottom-[38px] min-[1024px]:left-[102px]">
			{visibleMarkers.map((marker) => {
				const theme = COACHING_MARKER_THEMES[marker.priority];
				const relativePosition =
					(marker.positionPercent - viewport.startPercent) / viewportSpan;
				const isActive = marker.rank === activeRank;
				const opensToLeft = relativePosition > 0.72;

				return (
					<button
						key={marker.rank}
						type="button"
						className="group pointer-events-auto absolute inset-y-0 w-3 -translate-x-1/2 cursor-pointer focus-visible:outline-none"
						style={{ left: `${relativePosition * 100}%` }}
						onClick={() => onSelectRank(marker.rank)}
						aria-label={`${marker.priority} coaching finding in ${marker.regionName}, ${Math.round(marker.timeLossMs)} milliseconds lost at ${marker.positionPercent.toFixed(1)} percent of the lap`}
					>
						<span
							className="absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 transition-opacity"
							style={{
								backgroundColor: theme.color,
								opacity: isActive
									? Math.min(theme.bandOpacity + 0.06, 0.24)
									: theme.bandOpacity,
							}}
						/>
						<span
							className="absolute inset-y-0 left-1/2 -translate-x-1/2"
							style={{
								backgroundColor: theme.color,
								width: `${theme.lineWidthPx}px`,
							}}
						/>
						<span
							className={`absolute top-1 hidden min-w-44 rounded-[3px] border border-[#4b504c] bg-[#111412]/95 p-2 text-left shadow-xl group-hover:block group-focus-visible:block ${
								opensToLeft ? "right-3" : "left-3"
							}`}
						>
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
						</span>
					</button>
				);
			})}
		</div>
	);
}
