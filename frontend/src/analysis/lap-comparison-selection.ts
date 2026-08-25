export interface LapComparisonSelection {
	readonly comparedLapNumber: number;
	readonly referenceLapNumber: number;
}

export type LapReviewDirection = "previous" | "next";

interface LapComparisonCandidate {
	readonly lapNumber: number;
	readonly lapTimeMs: number;
}

export interface LapReviewPlan {
	readonly mode: "empty" | "single-lap" | "comparison";
	readonly selection: LapComparisonSelection | null;
	readonly reviewedLapNumber: number | null;
	readonly referenceLapNumber: number | null;
	readonly seriesLapNumbers: readonly number[] | null;
}

export function createLapReviewPlan(
	reviewableLaps: readonly LapComparisonCandidate[],
	referenceLaps: readonly LapComparisonCandidate[],
	fastestLapNumber: number | null,
	requestedSelection: LapComparisonSelection | null,
): LapReviewPlan {
	const selection = isSelectionAvailable(
		requestedSelection,
		reviewableLaps,
		referenceLaps,
	)
		? requestedSelection
		: createDefaultLapComparisonSelection(
				reviewableLaps,
				referenceLaps,
				fastestLapNumber,
			);

	if (selection !== null) {
		return {
			mode: "comparison",
			selection,
			reviewedLapNumber: selection.comparedLapNumber,
			referenceLapNumber: selection.referenceLapNumber,
			seriesLapNumbers: [
				selection.comparedLapNumber,
				selection.referenceLapNumber,
			],
		};
	}

	const singleReviewableLap =
		reviewableLaps.length === 1 ? reviewableLaps[0] : undefined;
	if (singleReviewableLap !== undefined) {
		return {
			mode: "single-lap",
			selection: null,
			reviewedLapNumber: singleReviewableLap.lapNumber,
			referenceLapNumber: null,
			seriesLapNumbers: [singleReviewableLap.lapNumber],
		};
	}

	return {
		mode: "empty",
		selection: null,
		reviewedLapNumber: null,
		referenceLapNumber: null,
		seriesLapNumbers: null,
	};
}

export function createDefaultLapComparisonSelection(
	reviewableLaps: readonly LapComparisonCandidate[],
	referenceLaps: readonly LapComparisonCandidate[],
	fastestLapNumber: number | null,
): LapComparisonSelection | null {
	if (referenceLaps.length === 0) return null;

	const referenceLapNumber = referenceLaps.some(
		(lap) => lap.lapNumber === fastestLapNumber,
	)
		? fastestLapNumber
		: (referenceLaps[0]?.lapNumber ?? null);
	const verifiedReviewedCandidates = referenceLaps.filter(
		(lap) => lap.lapNumber !== referenceLapNumber,
	);
	const reviewedCandidates =
		verifiedReviewedCandidates.length > 0
			? verifiedReviewedCandidates
			: reviewableLaps.filter((lap) => lap.lapNumber !== referenceLapNumber);
	const comparedLapNumber =
		[...reviewedCandidates].sort(
			(first, second) =>
				second.lapTimeMs - first.lapTimeMs ||
				first.lapNumber - second.lapNumber,
		)[0]?.lapNumber ?? null;

	if (comparedLapNumber === null || referenceLapNumber === null) {
		return null;
	}

	return {
		comparedLapNumber,
		referenceLapNumber,
	};
}

export function selectLapToReview(
	selection: LapComparisonSelection,
	lapNumber: number,
): LapComparisonSelection {
	if (
		lapNumber === selection.comparedLapNumber ||
		lapNumber === selection.referenceLapNumber
	) {
		return selection;
	}

	return {
		...selection,
		comparedLapNumber: lapNumber,
	};
}

export function selectLapToCompareWith(
	selection: LapComparisonSelection,
	lapNumber: number,
): LapComparisonSelection {
	if (
		lapNumber === selection.referenceLapNumber ||
		lapNumber === selection.comparedLapNumber
	) {
		return selection;
	}

	return {
		...selection,
		referenceLapNumber: lapNumber,
	};
}

export function swapComparedLaps(
	selection: LapComparisonSelection,
): LapComparisonSelection {
	return {
		comparedLapNumber: selection.referenceLapNumber,
		referenceLapNumber: selection.comparedLapNumber,
	};
}

export function areComparedLapRolesSwapped(
	previousSelection: LapComparisonSelection,
	nextSelection: LapComparisonSelection,
): boolean {
	return (
		previousSelection.comparedLapNumber === nextSelection.referenceLapNumber &&
		previousSelection.referenceLapNumber === nextSelection.comparedLapNumber
	);
}

export function findAdjacentLapToReview(
	selection: LapComparisonSelection,
	lapNumbers: readonly number[],
	direction: LapReviewDirection,
): number | null {
	const currentIndex = lapNumbers.indexOf(selection.comparedLapNumber);
	if (currentIndex === -1) return null;

	const step = direction === "previous" ? -1 : 1;

	for (
		let candidateIndex = currentIndex + step;
		candidateIndex >= 0 && candidateIndex < lapNumbers.length;
		candidateIndex += step
	) {
		const candidateLapNumber = lapNumbers[candidateIndex];
		if (
			candidateLapNumber !== undefined &&
			candidateLapNumber !== selection.referenceLapNumber
		) {
			return candidateLapNumber;
		}
	}

	return null;
}

function isSelectionAvailable(
	selection: LapComparisonSelection | null,
	reviewableLaps: readonly LapComparisonCandidate[],
	referenceLaps: readonly LapComparisonCandidate[],
): selection is LapComparisonSelection {
	if (
		selection === null ||
		selection.comparedLapNumber === selection.referenceLapNumber
	) {
		return false;
	}

	return (
		reviewableLaps.some(
			(lap) => lap.lapNumber === selection.comparedLapNumber,
		) &&
		referenceLaps.some((lap) => lap.lapNumber === selection.referenceLapNumber)
	);
}
