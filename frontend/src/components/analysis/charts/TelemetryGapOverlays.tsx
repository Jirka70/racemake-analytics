import { WarningCircle } from "@phosphor-icons/react";
import { Fragment, useState } from "react";
import type { LapSamplingGapResponse } from "../../../../../src/http/contracts";
import {
	createVisibleSamplingGapSegments,
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
	const [expandedSegmentKey, setExpandedSegmentKey] = useState<string | null>(
		null,
	);
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
		<div className="pointer-events-none absolute top-[16px] right-[12px] bottom-[36px] left-[58px] z-10 overflow-visible min-[1024px]:top-[18px] min-[1024px]:right-[18px] min-[1024px]:bottom-[38px] min-[1024px]:left-[102px]">
			{visibleSegments.map((segment) => {
				const widthPercent = segment.endPercent - segment.startPercent;
				const positionLabel = formatGapPosition(segment.gap);
				const durationSeconds = segment.gap.gapDurationMs / 1_000;
				const segmentKey = `${segment.gap.lapNumber}-${segment.gap.gapStartTimestampMs}-${segment.startPercent}`;
				const detailsId = `telemetry-gap-${segment.gap.lapNumber}-${segment.gap.gapStartTimestampMs}-${Math.round(segment.startPercent * 10)}`;
				const isExpanded = expandedSegmentKey === segmentKey;

				return (
					<Fragment key={segmentKey}>
						<button
							className="pointer-events-auto absolute inset-y-0 cursor-pointer overflow-hidden border-y-0 border-x border-dashed border-amber-500/80 bg-amber-500/[0.09] p-0 text-left focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-amber-400"
							style={{
								left: `${segment.startPercent}%`,
								width: `${widthPercent}%`,
							}}
							type="button"
							aria-label={`Show details for missing telemetry on Lap ${segment.gap.lapNumber}, track position ${positionLabel}`}
							aria-expanded={isExpanded}
							aria-controls={detailsId}
							title="Show missing telemetry details"
							onClick={() =>
								setExpandedSegmentKey(isExpanded ? null : segmentKey)
							}
						>
							<span className="pointer-events-none absolute top-2 left-1/2 inline-flex max-w-[calc(100%-4px)] -translate-x-1/2 items-center justify-center overflow-hidden rounded-[2px] border border-amber-400/70 bg-[#18160e] px-1 py-0.5 text-[8px] font-semibold tracking-[0.03em] text-amber-300">
								<span className="truncate">More</span>
							</span>
						</button>

						{isExpanded ? (
							<div
								id={detailsId}
								className="pointer-events-auto absolute top-4 left-1/2 z-30 w-56 -translate-x-1/2 rounded-[3px] border border-[#4b504c] bg-[#111412]/95 p-3 text-left shadow-xl"
								role="status"
							>
								<div className="flex items-center gap-2 text-[11px] font-semibold text-amber-400">
									<WarningCircle size={15} weight="bold" aria-hidden="true" />
									<span>Missing telemetry</span>
								</div>
								<p className="mt-2 text-[11px] font-medium text-neutral-200">
									Lap {segment.gap.lapNumber}
								</p>
								<p className="mt-1 text-[10px] text-neutral-400">
									Track position {positionLabel}
								</p>
								<p className="mt-1 text-[10px] text-neutral-400">
									Approximately {durationSeconds.toFixed(1)} s unavailable
								</p>
								<p className="mt-2 border-t border-[#303431] pt-2 text-[10px] leading-4 text-neutral-500">
									The chart does not connect values across this unsupported
									range.
								</p>
							</div>
						) : null}
					</Fragment>
				);
			})}
		</div>
	);
}

function formatGapPosition(gap: LapSamplingGapResponse): string {
	const fromPercent = (gap.fromPosition * 100).toFixed(1);
	const toPercent = (gap.toPosition * 100).toFixed(1);

	return gap.toPosition >= gap.fromPosition
		? `${fromPercent}–${toPercent}%`
		: `${fromPercent}–100% / 0–${toPercent}%`;
}
