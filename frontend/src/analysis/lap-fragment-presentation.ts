import type { LapFragmentResponse } from "../../../src/http/contracts";

export interface LapFragmentRange {
	readonly startPosition: number;
	readonly endPosition: number;
}

export interface LapFragmentPresentation {
	readonly key: string;
	readonly fragmentIndex: number;
	readonly lapNumber: number;
	readonly label: "Start fragment" | "End fragment" | "Lap fragment";
	readonly startPosition: number;
	readonly endPosition: number;
	readonly capturedRatio: number;
	readonly capturedRanges: readonly LapFragmentRange[];
}

export function createLapFragmentPresentations(
	fragments: readonly LapFragmentResponse[],
	lapNumbers: readonly number[],
): readonly LapFragmentPresentation[] {
	if (fragments.length === 0) return [];

	const firstLapNumber = findMinimum(lapNumbers) ?? 1;
	const lastLapNumber = findMaximum(lapNumbers) ?? firstLapNumber - 1;

	return fragments.map((fragment, index) => {
		const startPosition = clamp(fragment.startPosition, 0, 1);
		const endPosition = clamp(fragment.endPosition, 0, 1);
		const isOpeningFragment = index === 0 && endPosition === 1;
		const isClosingFragment =
			index === fragments.length - 1 && startPosition === 0;

		return {
			key: `${index}:${startPosition}:${endPosition}`,
			fragmentIndex: index,
			lapNumber: isOpeningFragment
				? Math.max(0, firstLapNumber - 1)
				: isClosingFragment
					? lastLapNumber + 1
					: lastLapNumber + index,
			label: isOpeningFragment
				? "Start fragment"
				: isClosingFragment
					? "End fragment"
					: "Lap fragment",
			startPosition,
			endPosition,
			capturedRatio: calculateForwardSpan(startPosition, endPosition),
			capturedRanges: createCapturedRanges(startPosition, endPosition),
		};
	});
}

function calculateForwardSpan(
	startPosition: number,
	endPosition: number,
): number {
	return endPosition >= startPosition
		? endPosition - startPosition
		: 1 - startPosition + endPosition;
}

function createCapturedRanges(
	startPosition: number,
	endPosition: number,
): readonly LapFragmentRange[] {
	if (endPosition >= startPosition) {
		return [{ startPosition, endPosition }];
	}

	return [
		{ startPosition, endPosition: 1 },
		{ startPosition: 0, endPosition },
	];
}

function findMinimum(values: readonly number[]): number | null {
	let minimum: number | null = null;
	for (const value of values) {
		if (minimum === null || value < minimum) minimum = value;
	}
	return minimum;
}

function findMaximum(values: readonly number[]): number | null {
	let maximum: number | null = null;
	for (const value of values) {
		if (maximum === null || value > maximum) maximum = value;
	}
	return maximum;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}
