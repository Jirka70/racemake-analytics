import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { createLapFragmentPresentations } from "../../../analysis/lap-fragment-presentation";
import type { LapPickerProps } from "../laps/LapPicker";
import { MobileLapComparisonPicker } from "./MobileLapComparisonPicker";

const navigationButtonClassName =
	"grid size-11 shrink-0 place-items-center rounded-[4px] border border-[#303431] bg-[#111412] text-neutral-100 transition-colors hover:border-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400 disabled:cursor-not-allowed disabled:text-neutral-700";

export function MobileLapSummary({
	status,
	laps,
	fragments,
	comparedLapNumber,
	referenceLapNumber,
	selectedFragmentIndex,
	errorMessage,
	onSelectComparedLap,
	onSelectReferenceLap,
	onSwapLaps,
	onSelectFragment,
}: LapPickerProps) {
	if (status !== "ready") {
		return (
			<section className="flex min-h-24 items-center justify-center border-b border-[#292d2a] px-4 text-center">
				<p
					className={`text-sm ${status === "error" ? "text-red-300" : "text-neutral-500"}`}
					role={status === "error" ? "alert" : "status"}
				>
					{status === "loading"
						? "Loading stint…"
						: status === "error"
							? (errorMessage ?? "We couldn’t load this stint.")
							: "No stint selected"}
				</p>
			</section>
		);
	}

	const fragmentPresentations = createLapFragmentPresentations(
		fragments,
		laps.map((lap) => lap.lapNumber),
	);
	const fragment = fragmentPresentations.find(
		({ fragmentIndex }) => fragmentIndex === selectedFragmentIndex,
	);
	const selectableLaps = laps.filter((lap) => lap.isEligible);
	const reviewTargets: readonly MobileReviewTarget[] = [
		...(fragmentPresentations[0]
			? [
					{
						type: "fragment" as const,
						fragmentIndex: fragmentPresentations[0].fragmentIndex,
					},
				]
			: []),
		...selectableLaps.map((lap) => ({
			type: "lap" as const,
			lapNumber: lap.lapNumber,
		})),
		...fragmentPresentations.slice(1).map((presentation) => ({
			type: "fragment" as const,
			fragmentIndex: presentation.fragmentIndex,
		})),
	];
	const activeTargetIndex = reviewTargets.findIndex((target) =>
		target.type === "fragment"
			? target.fragmentIndex === selectedFragmentIndex
			: selectedFragmentIndex === null &&
				target.lapNumber === comparedLapNumber,
	);
	const previousTarget =
		activeTargetIndex > 0 ? reviewTargets[activeTargetIndex - 1] : null;
	const nextTarget =
		activeTargetIndex >= 0 && activeTargetIndex < reviewTargets.length - 1
			? reviewTargets[activeTargetIndex + 1]
			: null;

	function selectReviewTarget(target: MobileReviewTarget | null): void {
		if (target === null) return;
		if (target.type === "fragment") {
			onSelectFragment(target.fragmentIndex);
			return;
		}

		if (target.lapNumber === referenceLapNumber) {
			if (comparedLapNumber !== null) {
				onSelectComparedLap(comparedLapNumber);
			}
			onSwapLaps();
			return;
		}

		onSelectComparedLap(target.lapNumber);
	}

	if (fragment) {
		return (
			<section className="border-b border-[#292d2a] px-3 py-2">
				<div className="mx-auto grid max-w-[820px] grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 text-center">
					<button
						className={navigationButtonClassName}
						type="button"
						aria-label="Review previous data segment"
						disabled={!previousTarget}
						onClick={() => selectReviewTarget(previousTarget)}
					>
						<CaretLeft aria-hidden="true" size={22} weight="bold" />
					</button>
					<div>
						<p className="text-xs font-semibold tracking-[0.06em] text-amber-400 uppercase">
							{fragment.label}
						</p>
						<p className="mt-1 text-xl font-semibold tabular-nums text-neutral-100">
							{(fragment.capturedRatio * 100).toFixed(1)}% captured
						</p>
						<p className="mt-1 text-xs tabular-nums text-neutral-500">
							{formatPosition(fragment.startPosition)} →{" "}
							{formatPosition(fragment.endPosition)}
						</p>
						<span className="mt-2 inline-flex rounded-[3px] border border-amber-400/70 px-2.5 py-1 text-[9px] font-semibold tracking-[0.06em] text-amber-300 uppercase">
							Partial telemetry
						</span>
					</div>
					<button
						className={navigationButtonClassName}
						type="button"
						aria-label="Review next data segment"
						disabled={!nextTarget}
						onClick={() => selectReviewTarget(nextTarget)}
					>
						<CaretRight aria-hidden="true" size={22} weight="bold" />
					</button>
				</div>
			</section>
		);
	}

	return (
		<MobileLapComparisonPicker
			laps={laps}
			comparedLapNumber={comparedLapNumber}
			referenceLapNumber={referenceLapNumber}
			onSelectComparedLap={onSelectComparedLap}
			onSelectReferenceLap={onSelectReferenceLap}
			onSwapLaps={onSwapLaps}
		/>
	);
}

type MobileReviewTarget =
	| { readonly type: "lap"; readonly lapNumber: number }
	| { readonly type: "fragment"; readonly fragmentIndex: number };

function formatPosition(position: number): string {
	return `${(position * 100).toFixed(1)}%`;
}
