import { WarningCircle } from "@phosphor-icons/react";
import { type PointerEvent as ReactPointerEvent, useState } from "react";
import type { LapSamplingGapResponse } from "../../../../../src/http/contracts";
import {
	createVisibleSamplingGapSegments,
	findAvailableComparisonLapNumber,
	findVisibleSamplingGaps,
	type VisibleSamplingGapSegment,
} from "../../../analysis/telemetry-gaps";
import type { TelemetryViewport } from "../../../analysis/telemetry-viewport";
import {
	TelemetryFloatingTooltip,
	TELEMETRY_TOOLTIP_PRIORITY,
} from "./TelemetryFloatingTooltip";

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
	const [activeSegmentKey, setActiveSegmentKey] = useState<string | null>(null);
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
	const activeSegment = visibleSegments.find(
		(segment) => createSegmentKey(segment) === activeSegmentKey,
	);

	return (
		<>
			<div className="pointer-events-none absolute inset-0 z-10 overflow-visible">
				{visibleSegments.map((segment) => {
					const widthPercent = segment.endPercent - segment.startPercent;
					const positionLabel = formatGapPosition(segment.gap);
					const segmentKey = createSegmentKey(segment);
					const detailsId = `telemetry-gap-${segment.gap.lapNumber}-${segment.gap.gapStartTimestampMs}-${Math.round(segment.startPercent * 10)}`;

					return (
						<div
							key={segmentKey}
							className="pointer-events-none absolute inset-y-0 overflow-visible"
							style={{
								left: `${segment.startPercent}%`,
								width: `${widthPercent}%`,
							}}
						>
							<button
								data-telemetry-series-click-through
								className="pointer-events-auto absolute inset-0 cursor-help border-y-0 border-x border-dashed border-amber-500/80 bg-amber-500/[0.09] p-0 text-left focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-amber-400"
								type="button"
								aria-label={`Missing telemetry on Lap ${segment.gap.lapNumber}, track position ${positionLabel}`}
								aria-describedby={detailsId}
								onPointerDown={keepMouseHoverFromFocusingGap}
								onPointerEnter={() => setActiveSegmentKey(segmentKey)}
								onPointerLeave={(event) => {
									if (document.activeElement !== event.currentTarget) {
										setActiveSegmentKey(null);
									}
								}}
								onFocus={() => setActiveSegmentKey(segmentKey)}
								onBlur={() => setActiveSegmentKey(null)}
							>
								<span className="sr-only">Missing telemetry details</span>
							</button>
						</div>
					);
				})}
			</div>
			{activeSegment ? (
				<div
					className="pointer-events-none absolute inset-0 z-[240] overflow-visible"
					data-telemetry-marker-tooltip
				>
					<TelemetryFloatingTooltip
						id={`telemetry-gap-${activeSegment.gap.lapNumber}-${activeSegment.gap.gapStartTimestampMs}-${Math.round(activeSegment.startPercent * 10)}`}
						anchor={{
							xRatio:
								(activeSegment.startPercent + activeSegment.endPercent) / 200,
							yRatio: 0,
						}}
						priority={TELEMETRY_TOOLTIP_PRIORITY.missingTelemetry}
						className="w-64 max-w-[calc(100%-16px)] rounded-[4px] border border-[#4b504c] bg-[#111412]/97 p-1.5 text-left shadow-2xl backdrop-blur-sm min-[520px]:p-3"
					>
						<MissingTelemetryTooltipContent
							segment={activeSegment}
							samplingGaps={samplingGaps}
							selectedLapNumbers={selectedLapNumbers}
						/>
					</TelemetryFloatingTooltip>
				</div>
			) : null}
		</>
	);
}

function MissingTelemetryTooltipContent({
	segment,
	samplingGaps,
	selectedLapNumbers,
}: {
	readonly segment: VisibleSamplingGapSegment;
	readonly samplingGaps: readonly LapSamplingGapResponse[];
	readonly selectedLapNumbers: readonly number[];
}) {
	const positionLabel = formatGapPosition(segment.gap);
	const durationSeconds = segment.gap.gapDurationMs / 1_000;
	const availableComparisonLapNumber = findAvailableComparisonLapNumber(
		segment.gap,
		samplingGaps,
		selectedLapNumbers,
	);

	return (
		<>
			<div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
				<WarningCircle size={16} weight="bold" aria-hidden="true" />
				<span>Missing telemetry</span>
			</div>
			<p className="mt-1 text-xs font-medium text-neutral-200 min-[520px]:mt-2">
				Lap {segment.gap.lapNumber}
			</p>
			<p className="mt-1 text-[11px] text-neutral-400">
				Track position {positionLabel}
			</p>
			<p className="mt-1 text-[11px] text-neutral-400">
				Approximately {durationSeconds.toFixed(1)} s unavailable
			</p>
			{availableComparisonLapNumber !== null ? (
				<p className="mt-1 text-[11px] font-medium text-violet-300 min-[520px]:mt-2">
					Lap {availableComparisonLapNumber} remains available here
				</p>
			) : null}
		</>
	);
}

function createSegmentKey(segment: VisibleSamplingGapSegment): string {
	return `${segment.gap.lapNumber}-${segment.gap.gapStartTimestampMs}-${segment.startPercent}`;
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
