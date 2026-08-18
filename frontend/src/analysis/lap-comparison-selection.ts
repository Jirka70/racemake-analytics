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
	racingLaps: readonly LapComparisonCandidate[],
	fastestLapNumber: number | null,
	requestedSelection: LapComparisonSelection | null,
): LapReviewPlan {
	const singleRacingLap = racingLaps.length === 1 ? racingLaps[0] : undefined;
	if (singleRacingLap !== undefined) {
		return {
			mode: "single-lap",
			selection: null,
			reviewedLapNumber: singleRacingLap.lapNumber,
			referenceLapNumber: null,
			seriesLapNumbers: [singleRacingLap.lapNumber],
		};
	}

	if (racingLaps.length < 2) {
		return {
			mode: "empty",
			selection: null,
			reviewedLapNumber: null,
			referenceLapNumber: null,
			seriesLapNumbers: null,
		};
	}

	const selection = isSelectionAvailable(requestedSelection, racingLaps)
		? requestedSelection
		: createDefaultLapComparisonSelection(racingLaps, fastestLapNumber);

	if (selection === null) {
		return {
			mode: "empty",
			selection: null,
			reviewedLapNumber: null,
			referenceLapNumber: null,
			seriesLapNumbers: null,
		};
	}

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

export function createDefaultLapComparisonSelection(
	racingLaps: readonly LapComparisonCandidate[],
	fastestLapNumber: number | null,
): LapComparisonSelection | null {
	if (racingLaps.length < 2) return null;

	const referenceLapNumber =
		fastestLapNumber ?? racingLaps[0]?.lapNumber ?? null;
	const comparedLapNumber =
		[...racingLaps]
			.filter((lap) => lap.lapNumber !== referenceLapNumber)
			.sort(
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
	racingLaps: readonly LapComparisonCandidate[],
): selection is LapComparisonSelection {
	if (
		selection === null ||
		selection.comparedLapNumber === selection.referenceLapNumber
	) {
		return false;
	}

	return (
		racingLaps.some((lap) => lap.lapNumber === selection.comparedLapNumber) &&
		racingLaps.some((lap) => lap.lapNumber === selection.referenceLapNumber)
	);
}
