import { describe, expect, test } from 'bun:test'
import { smoothWithSavitzkyGolay } from '../../../src/analytics/savitzky-golay'

describe('smoothWithSavitzkyGolay', () => {
  test('uses the quadratic five-point center coefficients and leaves unsupported edges null', () => {
    const values = [1, 2, 10, 4, 5]

    expect(smoothWithSavitzkyGolay(values, { polynomialOrder: 2, windowSize: 5 })).toEqual([
      null,
      null,
      6.4,
      null,
      null,
    ])
    expect(values).toEqual([1, 2, 10, 4, 5])
  })

  test('preserves a quadratic profile inside the complete window', () => {
    expect(smoothWithSavitzkyGolay([0, 1, 4, 9, 16], { polynomialOrder: 2, windowSize: 5 })[2]).toBeCloseTo(4)
  })

  test('rejects an even window and a polynomial that cannot fit the window', () => {
    expect(() => smoothWithSavitzkyGolay([1, 2, 3], { polynomialOrder: 2, windowSize: 4 })).toThrow(RangeError)
    expect(() => smoothWithSavitzkyGolay([1, 2, 3], { polynomialOrder: 3, windowSize: 3 })).toThrow(RangeError)
  })
})
