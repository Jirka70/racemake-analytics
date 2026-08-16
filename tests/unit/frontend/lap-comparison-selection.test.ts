import { describe, expect, test } from 'bun:test'
import {
  findAdjacentLapToReview,
  selectLapToCompareWith,
  selectLapToReview,
  swapComparedLaps,
  type LapComparisonSelection,
} from '../../../frontend/src/analysis/lap-comparison-selection'

const SELECTION: LapComparisonSelection = {
  comparedLapNumber: 4,
  referenceLapNumber: 2,
}

describe('lap comparison selection', () => {
  test('changes only the lap being reviewed', () => {
    expect(selectLapToReview(SELECTION, 3)).toEqual({
      comparedLapNumber: 3,
      referenceLapNumber: 2,
    })
  })

  test('never hides a swap behind selecting the comparison lap card', () => {
    expect(selectLapToReview(SELECTION, 2)).toBe(SELECTION)
  })

  test('changes only the explicitly selected comparison lap', () => {
    expect(selectLapToCompareWith(SELECTION, 3)).toEqual({
      comparedLapNumber: 4,
      referenceLapNumber: 3,
    })
    expect(selectLapToCompareWith(SELECTION, 4)).toBe(SELECTION)
  })

  test('swaps roles only through the explicit action', () => {
    expect(swapComparedLaps(SELECTION)).toEqual({
      comparedLapNumber: 2,
      referenceLapNumber: 4,
    })
  })

  test('finds the next reviewable lap without selecting the comparison lap', () => {
    const selection = {
      comparedLapNumber: 3,
      referenceLapNumber: 2,
    }

    expect(findAdjacentLapToReview(selection, [2, 3, 4], 'previous')).toBeNull()
    expect(findAdjacentLapToReview(selection, [2, 3, 4], 'next')).toBe(4)
  })

  test('skips the comparison lap when stepping through racing laps', () => {
    const selection = {
      comparedLapNumber: 4,
      referenceLapNumber: 3,
    }

    expect(findAdjacentLapToReview(selection, [2, 3, 4], 'previous')).toBe(2)
  })
})
