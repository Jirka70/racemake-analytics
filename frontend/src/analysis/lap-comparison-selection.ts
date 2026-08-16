export interface LapComparisonSelection {
  readonly comparedLapNumber: number
  readonly referenceLapNumber: number
}

export type LapReviewDirection = 'previous' | 'next'

export function selectLapToReview(
  selection: LapComparisonSelection,
  lapNumber: number,
): LapComparisonSelection {
  if (
    lapNumber === selection.comparedLapNumber
    || lapNumber === selection.referenceLapNumber
  ) {
    return selection
  }

  return {
    ...selection,
    comparedLapNumber: lapNumber,
  }
}

export function selectLapToCompareWith(
  selection: LapComparisonSelection,
  lapNumber: number,
): LapComparisonSelection {
  if (
    lapNumber === selection.referenceLapNumber
    || lapNumber === selection.comparedLapNumber
  ) {
    return selection
  }

  return {
    ...selection,
    referenceLapNumber: lapNumber,
  }
}

export function swapComparedLaps(
  selection: LapComparisonSelection,
): LapComparisonSelection {
  return {
    comparedLapNumber: selection.referenceLapNumber,
    referenceLapNumber: selection.comparedLapNumber,
  }
}

export function findAdjacentLapToReview(
  selection: LapComparisonSelection,
  lapNumbers: readonly number[],
  direction: LapReviewDirection,
): number | null {
  const currentIndex = lapNumbers.indexOf(selection.comparedLapNumber)
  if (currentIndex === -1) return null

  const step = direction === 'previous' ? -1 : 1

  for (
    let candidateIndex = currentIndex + step;
    candidateIndex >= 0 && candidateIndex < lapNumbers.length;
    candidateIndex += step
  ) {
    const candidateLapNumber = lapNumbers[candidateIndex]
    if (
      candidateLapNumber !== undefined
      && candidateLapNumber !== selection.referenceLapNumber
    ) {
      return candidateLapNumber
    }
  }

  return null
}
