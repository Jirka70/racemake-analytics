import { describe, expect, test } from 'bun:test'
import { calculateOtsuThreshold } from '../../../src/analytics/otsu'
import { UnsafeTelemetryComputationError } from '../../../src/analytics/util/require-finite-result'

describe('calculateOtsuThreshold', () => {
  test('finds the split with maximum between-class variance without mutating the sample', () => {
    const values = [0, 0, 1, 1, 5, 5, 6, 6]

    expect(calculateOtsuThreshold(values)).toEqual({
      status: 'calculated',
      threshold: 3,
      diagnostics: {
        separabilityRatio: 6.25 / 6.5,
        lowerClassCount: 4,
        upperClassCount: 4,
      },
    })
    expect(values).toEqual([0, 0, 1, 1, 5, 5, 6, 6])
  })

  test('reports empty and constant samples as unavailable', () => {
    expect(calculateOtsuThreshold([])).toEqual({ status: 'unavailable', reason: 'EMPTY_SAMPLE', sampleCount: 0 })
    expect(calculateOtsuThreshold([2, 2, 2])).toEqual({ status: 'unavailable', reason: 'CONSTANT_SAMPLE', sampleCount: 3 })
  })

  test('rejects non-finite values', () => {
    expect(() => calculateOtsuThreshold([0, Number.NaN])).toThrow(RangeError)
    expect(() => calculateOtsuThreshold([0, Number.POSITIVE_INFINITY])).toThrow(RangeError)
  })

  test('rejects a non-finite variance derived from finite inputs', () => {
    expect(() => calculateOtsuThreshold([
      -Number.MAX_VALUE,
      Number.MAX_VALUE,
    ])).toThrow(UnsafeTelemetryComputationError)
  })
})
