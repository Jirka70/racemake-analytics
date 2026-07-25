import { describe, expect, test } from 'bun:test'
import {
  interquartileRange,
  median,
  medianAbsoluteDeviation,
  quantile,
  scaledMedianAbsoluteDeviation,
} from '../../../src/analytics/robust-statistics'

describe('median', () => {
  test('returns the middle value of an odd-sized unsorted sample', () => {
    expect(median([7, 1, 3])).toBe(3)
  })

  test('averages the two middle values of an even-sized sample', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})

describe('quantile', () => {
  test('linearly interpolates between neighboring sample values', () => {
    expect(quantile([0, 10, 20, 30], 0.25)).toBe(7.5)
    expect(quantile([0, 10, 20, 30], 0.75)).toBe(22.5)
  })

  test('supports endpoints without mutating the input sample', () => {
    const values = [30, 10, 20]

    expect(quantile(values, 0)).toBe(10)
    expect(quantile(values, 1)).toBe(30)
    expect(values).toEqual([30, 10, 20])
  })
})

describe('medianAbsoluteDeviation', () => {
  test('returns the median absolute distance from the median', () => {
    expect(medianAbsoluteDeviation([1, 2, 2, 3, 4])).toBe(1)
  })

  test('is resistant to one extreme value', () => {
    expect(medianAbsoluteDeviation([1, 2, 2, 3, 4, 4_000])).toBe(1)
  })
})

describe('scaledMedianAbsoluteDeviation', () => {
  test('converts MAD to the conventional robust scale', () => {
    expect(
      scaledMedianAbsoluteDeviation([1, 2, 2, 3, 4]),
    ).toBeCloseTo(1.4826)
  })
})

describe('interquartileRange', () => {
  test('returns the distance between interpolated quartiles', () => {
    expect(interquartileRange([0, 10, 20, 30])).toBe(15)
  })
})
