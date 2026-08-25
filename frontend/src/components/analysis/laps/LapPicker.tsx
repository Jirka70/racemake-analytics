import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import type {
	LapCoverageResponse,
	LapFragmentResponse,
	LapQualityResponse,
	LapSamplingGapResponse,
	LapTimingResponse,
	LapUsageResponse,
} from "../../../../../src/http/contracts";
import type { IdealLapDefinition } from "../../../analysis/ideal-lap";
import { createLapDataDetails } from "../../../analysis/lap-data-quality";
import { createLapFragmentPresentations } from "../../../analysis/lap-fragment-presentation";
import { FragmentTelemetryLegend } from "../charts/FragmentTelemetryLegend";
import { LapComparisonLegend } from "../charts/LapComparisonLegend";
import { ComparisonLapSelect } from "./ComparisonLapSelect";
import { LapDataDetailsPopover } from "./LapDataDetailsPopover";
import { LapFragmentPickerItem } from "./LapFragmentPickerItem";
import { LapPickerItem } from "./LapPickerItem";
import { formatLapTimeMs } from "./lap-time-format";

export interface LapPickerLap {
	readonly lapNumber: number;
	readonly lapTimeMs: number;
	readonly deltaToReferenceMs: number;
	readonly isFastest: boolean;
	readonly isReviewable: boolean;
	readonly isReferenceEligible: boolean;
	readonly timing: LapTimingResponse;
	readonly quality: LapQualityResponse;
	readonly usage: LapUsageResponse;
	readonly coverage: LapCoverageResponse;
	readonly samplingGaps: readonly LapSamplingGapResponse[];
}

export interface LapPickerProps {
	readonly status: "loading" | "ready" | "empty" | "error";
	readonly laps: readonly LapPickerLap[];
	readonly fragments: readonly LapFragmentResponse[];
	readonly idealLap: IdealLapDefinition | null;
	readonly comparedLapNumber: number | null;
	readonly referenceLapNumber: number | null;
	readonly selectedFragmentIndex: number | null;
	readonly errorMessage: string | null;
	readonly onSelectComparedLap: (lapNumber: number) => void;
	readonly onSelectReferenceLap: (lapNumber: number) => void;
	readonly onSwapLaps: () => void;
	readonly onSelectFragment: (fragmentIndex: number) => void;
	readonly chartControls?: ReactNode;
}

export function LapPicker({
	status,
	laps,
	fragments,
	idealLap,
	comparedLapNumber,
	referenceLapNumber,
	selectedFragmentIndex,
	errorMessage,
	onSelectComparedLap,
	onSelectReferenceLap,
	onSwapLaps,
	onSelectFragment,
	chartControls,
}: LapPickerProps) {
	const cardStripRef = useRef<HTMLDivElement>(null);
	const [canScrollLeft, setCanScrollLeft] = useState(false);
	const [canScrollRight, setCanScrollRight] = useState(false);
	const [openDetails, setOpenDetails] = useState<{
		readonly lap: LapPickerLap;
		readonly anchor: HTMLButtonElement;
	} | null>(null);
	const referenceLaps = laps.filter((lap) => lap.isReferenceEligible);
	const comparedLap = laps.find((lap) => lap.lapNumber === comparedLapNumber);
	const referenceLap = referenceLaps.find(
		(lap) => lap.lapNumber === referenceLapNumber,
	);
	const fragmentPresentations = createLapFragmentPresentations(
		fragments,
		laps.map((lap) => lap.lapNumber),
	);
	const openingFragment = fragmentPresentations[0] ?? null;
	const remainingFragments = fragmentPresentations.slice(1);
	const selectedFragment =
		fragmentPresentations.find(
			(fragment) => fragment.fragmentIndex === selectedFragmentIndex,
		) ?? null;
	const selectedReviewCardKey =
		selectedFragmentIndex === null
			? comparedLapNumber === null
				? null
				: `lap:${comparedLapNumber}`
			: `fragment:${selectedFragmentIndex}`;
	const updateScrollControls = useCallback((): void => {
		const strip = cardStripRef.current;
		if (!strip) return;

		const tolerancePx = 2;
		setCanScrollLeft(strip.scrollLeft > tolerancePx);
		setCanScrollRight(
			strip.scrollLeft + strip.clientWidth < strip.scrollWidth - tolerancePx,
		);
	}, []);

	useEffect(() => {
		const strip = cardStripRef.current;
		if (!strip) return;

		const resizeObserver = new ResizeObserver(updateScrollControls);
		const mutationObserver = new MutationObserver(updateScrollControls);
		resizeObserver.observe(strip);
		mutationObserver.observe(strip, { childList: true, subtree: true });
		strip.addEventListener("scroll", updateScrollControls, { passive: true });
		updateScrollControls();

		return () => {
			resizeObserver.disconnect();
			mutationObserver.disconnect();
			strip.removeEventListener("scroll", updateScrollControls);
		};
	}, [updateScrollControls]);

	useEffect(() => {
		const strip = cardStripRef.current;
		if (!strip) return;

		const frameId = window.requestAnimationFrame(() => {
			if (selectedReviewCardKey !== null) {
				strip
					.querySelector<HTMLElement>(
						`[data-review-card-key="${selectedReviewCardKey}"]`,
					)
					?.scrollIntoView({
						behavior: "smooth",
						block: "nearest",
						inline: "center",
					});
			}
			updateScrollControls();
		});

		return () => window.cancelAnimationFrame(frameId);
	}, [selectedReviewCardKey, updateScrollControls]);

	function scrollCards(direction: -1 | 1): void {
		const strip = cardStripRef.current;
		if (!strip) return;

		strip.scrollBy({
			left: direction * strip.clientWidth,
			behavior: "smooth",
		});
	}

	const openDetailsAnchor = openDetails?.anchor ?? null;
	const closeDetails = useCallback(
		(restoreFocus: boolean): void => {
			if (restoreFocus) openDetailsAnchor?.focus();
			setOpenDetails(null);
		},
		[openDetailsAnchor],
	);

	function toggleDetails(lap: LapPickerLap, anchor: HTMLButtonElement): void {
		if (openDetails?.lap.lapNumber === lap.lapNumber) {
			setOpenDetails(null);
			return;
		}

		anchor.closest<HTMLElement>("[data-review-card-key]")?.scrollIntoView({
			behavior: "auto",
			block: "nearest",
			inline: "center",
		});
		setOpenDetails({ lap, anchor });
	}

	const openDetailsPresentation = openDetails
		? createLapDataDetails(
				openDetails.lap,
				formatLapTimeMs(openDetails.lap.lapTimeMs),
			)
		: null;

	return (
		<>
			<section className="flex min-w-0 rounded-[3px] border border-[#292d2a] bg-[#101311]">
				<div className="w-[272px] shrink-0 px-4 py-3">
					<h2 className="m-0 text-[11px] font-semibold tracking-[0.04em] text-neutral-300">
						CHOOSE DATA TO REVIEW
					</h2>
					<p className="mt-0.5 text-[11px] text-neutral-500">
						{selectedFragmentIndex === null
							? "Select a lap card"
							: "Fragment review"}
					</p>

					{status === "ready" && selectedFragmentIndex === null && (
						<ComparisonLapSelect
							laps={referenceLaps}
							comparedLapNumber={comparedLapNumber}
							referenceLapNumber={referenceLapNumber}
							canSwap={comparedLap?.isReferenceEligible === true}
							onSelect={onSelectReferenceLap}
							onSwap={onSwapLaps}
						/>
					)}
					{status === "ready" && selectedFragmentIndex !== null ? (
						<p className="mt-2 max-w-[224px] text-[11px] leading-4 text-neutral-500">
							Comparison is not available for partial telemetry.
						</p>
					) : null}
				</div>

				<div className="flex min-w-0 flex-1">
					<div className="relative min-w-0 flex-1">
						<div
							ref={cardStripRef}
							className="flex h-full min-w-0 items-center justify-start gap-2 overflow-x-auto px-1 py-3"
						>
							{status === "loading" && (
								<p className="text-sm text-neutral-400" aria-live="polite">
									Loading stint…
								</p>
							)}

							{status === "empty" && (
								<div aria-live="polite">
									<p className="text-sm font-medium text-neutral-200">
										No stint selected
									</p>
									<p className="mt-1 text-xs text-neutral-500">
										Open a stint to start comparing laps.
									</p>
								</div>
							)}

							{status === "error" && (
								<div className="max-w-md" role="alert">
									<p className="text-sm font-medium text-red-300">
										We couldn’t load this stint
									</p>
									<p className="mt-1 text-xs text-neutral-400">
										{errorMessage ?? "Try opening it again."}
									</p>
								</div>
							)}

							{status === "ready" && openingFragment !== null && (
								<LapFragmentPickerItem
									fragment={openingFragment}
									isSelected={
										openingFragment.fragmentIndex === selectedFragmentIndex
									}
									onSelect={onSelectFragment}
								/>
							)}

							{status === "ready" &&
								laps.map((lap) => (
									<LapPickerItem
										key={lap.lapNumber}
										{...lap}
										isSelected={
											selectedFragmentIndex === null &&
											lap.lapNumber === comparedLapNumber
										}
										isReference={lap.lapNumber === referenceLapNumber}
										isDetailsOpen={openDetails?.lap.lapNumber === lap.lapNumber}
										onSelect={onSelectComparedLap}
										onToggleDetails={(anchor) => toggleDetails(lap, anchor)}
									/>
								))}

							{status === "ready" &&
								remainingFragments.map((fragment) => (
									<LapFragmentPickerItem
										key={fragment.key}
										fragment={fragment}
										isSelected={
											fragment.fragmentIndex === selectedFragmentIndex
										}
										onSelect={onSelectFragment}
									/>
								))}

							{status === "ready" &&
								selectedFragmentIndex === null &&
								idealLap !== null && (
									<div
										className="flex h-[94px] w-[108px] shrink-0 flex-col rounded-[4px] border border-[#303431] bg-[#111412] px-3 py-2"
										title="Theoretical time composed from the fastest observed pass through each region"
									>
										<span className="text-xs font-medium text-neutral-300">
											Ideal
										</span>
										<span className="mt-1 text-sm font-semibold tabular-nums text-neutral-100">
											{formatLapTimeMs(idealLap.durationMs)}
										</span>
										<span className="mt-auto whitespace-nowrap text-[11px] text-neutral-500">
											Best sections
										</span>
									</div>
								)}

							{status === "ready" && referenceLaps.length === 0 && (
								<p className="text-sm text-neutral-400">
									No racing laps are available for comparison.
								</p>
							)}
						</div>

						{canScrollLeft ? (
							<CardStripScrollControl
								direction="left"
								onClick={() => scrollCards(-1)}
							/>
						) : null}
						{canScrollRight ? (
							<CardStripScrollControl
								direction="right"
								onClick={() => scrollCards(1)}
							/>
						) : null}
					</div>

					{status === "ready" && selectedFragment !== null && (
						<div className="ml-auto flex h-[94px] shrink-0 border-l border-[#292d2a]">
							<FragmentTelemetryLegend fragment={selectedFragment} />
							{chartControls}
						</div>
					)}

					{status === "ready" &&
						selectedFragment === null &&
						comparedLap &&
						referenceLap && (
							<div className="ml-auto flex h-[94px] shrink-0 border-l border-[#292d2a]">
								<LapComparisonLegend
									comparedLap={comparedLap}
									referenceLap={referenceLap}
									idealLap={idealLap}
								/>
								{chartControls}
							</div>
						)}
				</div>
			</section>
			{openDetails && openDetailsPresentation ? (
				<LapDataDetailsPopover
					lapNumber={openDetails.lap.lapNumber}
					details={openDetailsPresentation}
					anchor={openDetails.anchor}
					onClose={closeDetails}
				/>
			) : null}
		</>
	);
}

function CardStripScrollControl({
	direction,
	onClick,
}: {
	readonly direction: "left" | "right";
	readonly onClick: () => void;
}) {
	const isLeft = direction === "left";
	const label = isLeft ? "Show previous lap cards" : "Show more lap cards";

	return (
		<div
			className={`pointer-events-none absolute inset-y-0 z-10 flex w-11 items-center ${
				isLeft
					? "left-0 justify-start bg-gradient-to-r from-[#101311] via-[#101311]/90 to-transparent pl-1"
					: "right-0 justify-end bg-gradient-to-l from-[#101311] via-[#101311]/90 to-transparent pr-1"
			}`}
		>
			<button
				type="button"
				className="pointer-events-auto grid size-7 place-items-center rounded-full border border-[#4a504b] bg-[#111412] text-neutral-200 shadow-lg transition-colors hover:border-lime-500 hover:text-lime-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-lime-400"
				aria-label={label}
				title={label}
				onClick={onClick}
			>
				{isLeft ? (
					<CaretLeft aria-hidden="true" size={14} weight="bold" />
				) : (
					<CaretRight aria-hidden="true" size={14} weight="bold" />
				)}
			</button>
		</div>
	);
}
