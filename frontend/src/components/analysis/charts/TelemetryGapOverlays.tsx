import { WarningCircle } from "@phosphor-icons/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { LapSamplingGapResponse } from "../../../../../src/http/contracts";
import {
	createVisibleSamplingGapSegments,
	findAvailableComparisonLapNumber,
	findVisibleSamplingGaps,
} from "../../../analysis/telemetry-gaps";
import type { TelemetryViewport } from "../../../analysis/telemetry-viewport";

export interface TelemetryGapOverlaysProps {
	readonly samplingGaps: readonly LapSamplingGapResponse[];
	readonly reviewedLapNumber: number;
	readonly secondLapNumber: number | null;
	readonly viewport: TelemetryViewport;
}

export function TelemetryGapOverlays({
	samplingGaps,
	reviewedLapNumber,
	secondLapNumber,
	viewport,
}: TelemetryGapOverlaysProps) {
	const selectedLapNumbers = [
		reviewedLapNumber,
		...(secondLapNumber === null ? [] : [secondLapNumber]),
	];
	const visibleGaps = findVisibleSamplingGaps(samplingGaps, selectedLapNumbers);
	const visibleSegments = createVisibleSamplingGapSegments(
		visibleGaps,
		viewport,
	);

	if (visibleSegments.length === 0) return null;

	return (
		<div className="pointer-events-none absolute top-[16px] right-[12px] bottom-[36px] left-[58px] z-10 overflow-visible hover:z-[100] focus-within:z-[100] min-[1024px]:top-[18px] min-[1024px]:right-[18px] min-[1024px]:bottom-[38px] min-[1024px]:left-[102px]">
			{visibleSegments.map((segment) => {
				const widthPercent = segment.endPercent - segment.startPercent;
				const positionLabel = formatGapPosition(segment.gap);
				const durationSeconds = segment.gap.gapDurationMs / 1_000;
				const segmentKey = `${segment.gap.lapNumber}-${segment.gap.gapStartTimestampMs}-${segment.startPercent}`;
				const detailsId = `telemetry-gap-${segment.gap.lapNumber}-${segment.gap.gapStartTimestampMs}-${Math.round(segment.startPercent * 10)}`;
				const availableComparisonLapNumber = findAvailableComparisonLapNumber(
					segment.gap,
					samplingGaps,
					selectedLapNumbers,
				);
				const openTooltipToLeft = segment.endPercent > 72;

				return (
					<div
						key={segmentKey}
						className="group pointer-events-none absolute inset-y-0 overflow-visible"
						style={{
							left: `${segment.startPercent}%`,
							width: `${widthPercent}%`,
						}}
					>
						<button
							className="pointer-events-auto absolute inset-0 cursor-help border-y-0 border-x border-dashed border-amber-500/80 bg-amber-500/[0.09] p-0 text-left focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-amber-400"
							type="button"
							aria-label={`Missing telemetry on Lap ${segment.gap.lapNumber}, track position ${positionLabel}`}
							aria-describedby={detailsId}
							onPointerDown={keepMouseHoverFromFocusingGap}
						>
							<span className="sr-only">Missing telemetry details</span>
						</button>

						<div
							id={detailsId}
							className={`pointer-events-none invisible absolute top-4 z-30 w-64 max-w-[calc(100vw-32px)] rounded-[4px] border border-[#4b504c] bg-[#111412]/95 p-3 text-left opacity-0 shadow-xl backdrop-blur-sm transition-[opacity,visibility] duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${
								openTooltipToLeft
									? "left-1/2 -translate-x-1/2 min-[1024px]:right-[calc(100%+12px)] min-[1024px]:left-auto min-[1024px]:translate-x-0"
									: "left-1/2 -translate-x-1/2 min-[1024px]:left-[calc(100%+12px)] min-[1024px]:translate-x-0"
							}`}
							role="tooltip"
						>
							<div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
								<WarningCircle size={16} weight="bold" aria-hidden="true" />
								<span>Missing telemetry</span>
							</div>
							<p className="mt-2 text-xs font-medium text-neutral-200">
								Lap {segment.gap.lapNumber}
							</p>
							<p className="mt-1 text-[11px] text-neutral-400">
								Track position {positionLabel}
							</p>
							<p className="mt-1 text-[11px] text-neutral-400">
								Approximately {durationSeconds.toFixed(1)} s unavailable
							</p>
							{availableComparisonLapNumber !== null ? (
								<p className="mt-2 text-[11px] font-medium text-violet-300">
									Lap {availableComparisonLapNumber} remains available here
								</p>
							) : null}
						</div>
					</div>
				);
			})}
		</div>
	);
}

function keepMouseHoverFromFocusingGap(
	event: ReactPointerEvent<HTMLButtonElement>,
): void {
	if (event.pointerType === "mouse") event.preventDefault();
}

function formatGapPosition(gap: LapSamplingGapResponse): string {
	const fromPercent = (gap.fromPosition * 100).toFixed(1);
	const toPercent = (gap.toPosition * 100).toFixed(1);

	return gap.toPosition >= gap.fromPosition
		? `${fromPercent}–${toPercent}%`
		: `${fromPercent}–100% / 0–${toPercent}%`;
}
