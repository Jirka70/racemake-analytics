import { CheckCircle } from "@phosphor-icons/react";
import type { LapSamplingGapResponse } from "../../../../../src/http/contracts";
import {
	calculateLapTelemetryCoverageRatio,
	createSamplingGapPositionSegments,
	findVisibleSamplingGaps,
} from "../../../analysis/telemetry-gaps";
import { formatLapDeltaMs, formatLapTimeMs } from "./lap-time-format";

export interface LapPickerItemProps {
	readonly lapNumber: number;
	readonly lapTimeMs: number;
	readonly deltaToReferenceMs: number;
	readonly isSelected: boolean;
	readonly isReference: boolean;
	readonly isFastest: boolean;
	readonly isEligible: boolean;
	readonly samplingGaps: readonly LapSamplingGapResponse[];
	readonly onSelect: (lapNumber: number) => void;
}

export function LapPickerItem({
	lapNumber,
	lapTimeMs,
	deltaToReferenceMs,
	isSelected,
	isReference,
	isFastest,
	isEligible,
	samplingGaps,
	onSelect,
}: LapPickerItemProps) {
	const visibleSamplingGaps = findVisibleSamplingGaps(samplingGaps, [
		lapNumber,
	]);
	const hasVisibleSamplingGap = visibleSamplingGaps.length > 0;
	const telemetryCoveragePercent =
		calculateLapTelemetryCoverageRatio(samplingGaps) * 100;
	const stateClassName = !isEligible
		? "cursor-not-allowed border-[#2a2d2b] bg-[#0e100f] text-neutral-600"
		: isSelected
			? "border-lime-400 bg-lime-400/[0.04] text-lime-300"
			: isReference
				? "cursor-default border-violet-500/70 bg-violet-500/[0.04] text-violet-300"
				: "border-[#303431] bg-[#111412] text-neutral-300 hover:border-neutral-600";
	const stateLabel = !isEligible
		? "Excluded"
		: isSelected
			? "Reviewing"
			: isReference
				? "In charts"
				: isFastest
					? "Fastest"
					: formatLapDeltaMs(deltaToReferenceMs);
	const gapTitle = visibleSamplingGaps
		.map(
			(gap) =>
				`Missing telemetry from ${(gap.fromPosition * 100).toFixed(1)}% to ${(gap.toPosition * 100).toFixed(1)}% of Lap ${lapNumber}`,
		)
		.join(". ");

	return (
		<button
			data-review-card-key={`lap:${lapNumber}`}
			className={`relative flex h-[94px] w-[108px] shrink-0 flex-col rounded-[4px] border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400 ${stateClassName}`}
			type="button"
			aria-pressed={isSelected}
			aria-label={`Lap ${lapNumber}, ${formatLapTimeMs(lapTimeMs)}, ${stateLabel}${hasVisibleSamplingGap ? `, telemetry coverage ${telemetryCoveragePercent.toFixed(1)} percent` : ""}`}
			disabled={isReference || !isEligible}
			title={hasVisibleSamplingGap ? gapTitle : undefined}
			onClick={() => onSelect(lapNumber)}
		>
			<span className="text-xs font-medium">Lap {lapNumber}</span>

			{isSelected && (
				<CheckCircle
					className="absolute right-2 top-2 text-lime-400"
					aria-hidden="true"
					size={15}
					weight="fill"
				/>
			)}

			<span className="mt-1 text-sm font-semibold tabular-nums text-neutral-100">
				{formatLapTimeMs(lapTimeMs)}
			</span>

			{hasVisibleSamplingGap ? (
				<div className="mt-auto w-full">
					<div className="flex items-baseline justify-between gap-1 text-[9px] leading-3">
						<span className="font-medium text-amber-400">Data gap</span>
						<span className="tabular-nums text-neutral-500">
							{telemetryCoveragePercent.toFixed(1)}%
						</span>
					</div>
					<div
						className="relative mt-1 h-1.5 overflow-hidden rounded-[2px] border border-[#303431] bg-[#1d211e]"
						aria-hidden="true"
					>
						{visibleSamplingGaps.flatMap((gap) =>
							createSamplingGapPositionSegments(gap).map((segment) => (
								<span
									key={`${gap.gapStartTimestampMs}-${segment.startPercent}`}
									className="absolute inset-y-0 bg-amber-500/80"
									style={{
										left: `${segment.startPercent}%`,
										width: `${segment.endPercent - segment.startPercent}%`,
									}}
								/>
							)),
						)}
					</div>
				</div>
			) : (
				<span className="mt-auto text-[11px] tabular-nums text-neutral-400">
					{stateLabel}
				</span>
			)}
		</button>
	);
}
