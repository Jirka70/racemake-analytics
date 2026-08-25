import { CheckCircle, Info } from "@phosphor-icons/react";
import type {
	LapCoverageResponse,
	LapQualityResponse,
	LapSamplingGapResponse,
	LapTimingResponse,
	LapUsageResponse,
} from "../../../../../src/http/contracts";
import { hasLimitedLapTime } from "../../../analysis/lap-data-quality";
import {
	calculateLapTelemetryCoverageRatio,
	createSamplingGapPositionSegments,
	findVisibleSamplingGaps,
} from "../../../analysis/telemetry-gaps";
import { LapCoachingAvailabilityInfo } from "./LapCoachingAvailabilityInfo";
import { formatLapDeltaMs, formatLapTimeMs } from "./lap-time-format";

export interface LapPickerItemProps {
	readonly lapNumber: number;
	readonly lapTimeMs: number;
	readonly deltaToReferenceMs: number;
	readonly isSelected: boolean;
	readonly isReference: boolean;
	readonly isFastest: boolean;
	readonly isReviewable: boolean;
	readonly isReferenceEligible: boolean;
	readonly isDetailsOpen: boolean;
	readonly timing: LapTimingResponse;
	readonly quality: LapQualityResponse;
	readonly usage: LapUsageResponse;
	readonly coverage: LapCoverageResponse;
	readonly samplingGaps: readonly LapSamplingGapResponse[];
	readonly onSelect: (lapNumber: number) => void;
	readonly onToggleDetails: (anchor: HTMLButtonElement) => void;
}

export function LapPickerItem(props: LapPickerItemProps) {
	const {
		lapNumber,
		lapTimeMs,
		deltaToReferenceMs,
		isSelected,
		isReference,
		isFastest,
		isReviewable,
		isReferenceEligible,
		isDetailsOpen,
		quality,
		usage,
		samplingGaps,
		onSelect,
		onToggleDetails,
	} = props;
	const visibleSamplingGaps = findVisibleSamplingGaps(samplingGaps, [
		lapNumber,
	]);
	const hasVisibleSamplingGap = visibleSamplingGaps.length > 0;
	const telemetryCoveragePercent =
		calculateLapTelemetryCoverageRatio(samplingGaps) * 100;
	const hasLimitedTime = hasLimitedLapTime(props);
	const stateClassName = hasLimitedTime
		? isSelected
			? "border-amber-500 bg-amber-500/[0.055] text-neutral-100"
			: "border-amber-500/80 bg-amber-500/[0.035] text-neutral-200 hover:border-amber-400"
		: !isReviewable
			? "border-[#2a2d2b] bg-[#0e100f] text-neutral-600"
			: isSelected
				? "border-lime-400 bg-lime-400/[0.04] text-lime-300"
				: isReference
					? "border-violet-500/70 bg-violet-500/[0.04] text-violet-300"
					: "border-[#303431] bg-[#111412] text-neutral-300 hover:border-neutral-600";
	const stateLabel = !isReviewable
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
	const timeLabel = `${hasLimitedTime ? "~" : ""}${formatLapTimeMs(lapTimeMs)}`;
	const cardSizeClassName = hasLimitedTime
		? "h-[142px] w-[250px]"
		: "h-[94px] w-[108px]";

	return (
		<div
			data-review-card-key={`lap:${lapNumber}`}
			className={`relative flex shrink-0 flex-col rounded-[4px] border px-3 py-2 text-left transition-colors ${cardSizeClassName} ${stateClassName}`}
			title={hasVisibleSamplingGap ? gapTitle : undefined}
		>
			{hasLimitedTime ? (
				<div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
					<span className="rounded-[3px] border border-amber-500/80 px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.05em] text-amber-400 uppercase">
						Limited data
					</span>
					{usage.coaching === "none" ? (
						<LapCoachingAvailabilityInfo
							lapNumber={lapNumber}
							reason={
								quality.status === "limited"
									? quality.summary
									: "Lap timing could not be verified."
							}
							onViewDetails={onToggleDetails}
						/>
					) : null}
				</div>
			) : null}
			<button
				className={`flex min-h-0 flex-1 flex-col text-left focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${hasLimitedTime ? "focus-visible:outline-amber-400" : "focus-visible:outline-lime-400"}`}
				type="button"
				aria-pressed={isSelected}
				aria-label={`Lap ${lapNumber}, ${timeLabel}, ${hasLimitedTime ? "limited data, time shown for review only and not ranked" : stateLabel}${hasVisibleSamplingGap ? `, telemetry coverage ${telemetryCoveragePercent.toFixed(1)} percent` : ""}`}
				disabled={isReference || !isReviewable}
				onClick={() => onSelect(lapNumber)}
			>
				<span className="flex w-full items-start justify-between gap-2">
					<span className="text-xs font-medium">Lap {lapNumber}</span>
				</span>

				{isSelected && !hasLimitedTime ? (
					<CheckCircle
						className="absolute top-2 right-2 text-lime-400"
						aria-hidden="true"
						size={15}
						weight="fill"
					/>
				) : null}

				<span className="mt-1 text-sm font-semibold tabular-nums text-neutral-100">
					{timeLabel}
				</span>

				{hasLimitedTime ? (
					<>
						<span className="mt-1 text-[10px] leading-3.5 font-medium text-amber-400">
							{quality.status === "limited"
								? quality.summary
								: "Lap time could not be verified."}
						</span>
						<span className="mt-auto text-[9px] leading-3 text-neutral-500">
							Reviewable · Not ranked
						</span>
					</>
				) : hasVisibleSamplingGap ? (
					<div className="mt-auto w-full">
						<div className="flex items-baseline justify-between gap-1 text-[9px] leading-3">
							<span className="font-medium text-amber-400">Data gap</span>
							<span className="tabular-nums text-neutral-500">
								{telemetryCoveragePercent.toFixed(1)}%
							</span>
						</div>
						<LapGapBar visibleSamplingGaps={visibleSamplingGaps} />
					</div>
				) : (
					<span className="mt-auto text-[11px] tabular-nums text-neutral-400">
						{stateLabel}
					</span>
				)}
			</button>

			{hasLimitedTime && quality.status === "limited" ? (
				<button
					className="mt-1 flex min-h-7 items-center gap-1.5 self-start text-[9px] font-semibold tracking-[0.06em] text-neutral-300 uppercase transition-colors hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
					type="button"
					aria-expanded={isDetailsOpen}
					aria-controls={`lap-${lapNumber}-data-details`}
					onClick={(event) => onToggleDetails(event.currentTarget)}
				>
					<Info aria-hidden="true" size={13} weight="bold" />
					Details
				</button>
			) : null}
			<span className="sr-only">
				{isReferenceEligible
					? "This lap can be used as a comparison reference."
					: "This lap cannot be used as a comparison reference."}
			</span>
		</div>
	);
}

function LapGapBar({
	visibleSamplingGaps,
}: {
	readonly visibleSamplingGaps: readonly LapSamplingGapResponse[];
}) {
	return (
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
	);
}
