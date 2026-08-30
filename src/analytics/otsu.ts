export interface OtsuDiagnostics {
  readonly separabilityRatio: number
  readonly lowerClassCount: number
  readonly upperClassCount: number
}

export type OtsuResult =
  | {
      readonly status: 'calculated'
      readonly threshold: number
      readonly diagnostics: OtsuDiagnostics
    }
  | {
      readonly status: 'unavailable'
      readonly reason: 'EMPTY_SAMPLE' | 'CONSTANT_SAMPLE'
      readonly sampleCount: number
    }

export function calculateOtsuThreshold(values: readonly number[]): OtsuResult {
  if (values.some((value) => !Number.isFinite(value))) throw new RangeError('Otsu sample must contain only finite values')
  if (values.length === 0) return { status: 'unavailable', reason: 'EMPTY_SAMPLE', sampleCount: 0 }

  const sortedValues = [...values].sort((left, right) => left - right)
  if (sortedValues[0] === sortedValues[sortedValues.length - 1]) {
    return { status: 'unavailable', reason: 'CONSTANT_SAMPLE', sampleCount: sortedValues.length }
  }

  const totalSum = requireFiniteResult(
    sortedValues.reduce((sum, value) => sum + value, 0),
    'otsu',
  )
  const totalMean = requireFiniteResult(totalSum / sortedValues.length, 'otsu')
  const totalVariance = calculateVariance(sortedValues, totalMean)
  let lowerSum = 0
  let bestSplitIndex = -1
  let bestBetweenClassVariance = -Infinity

  for (let splitIndex = 0; splitIndex < sortedValues.length - 1; splitIndex++) {
    lowerSum = requireFiniteResult(lowerSum + sortedValues[splitIndex], 'otsu')
    if (sortedValues[splitIndex] === sortedValues[splitIndex + 1]) continue

    const lowerClassCount = splitIndex + 1
    const upperClassCount = sortedValues.length - lowerClassCount
    const lowerClassMean = requireFiniteResult(lowerSum / lowerClassCount, 'otsu')
    const upperClassMean = requireFiniteResult((totalSum - lowerSum) / upperClassCount, 'otsu')
    const betweenClassVariance = requireFiniteResult(
      lowerClassCount / sortedValues.length
        * upperClassCount / sortedValues.length
        * (lowerClassMean - upperClassMean) ** 2,
      'otsu',
    )
    if (betweenClassVariance > bestBetweenClassVariance) {
      bestSplitIndex = splitIndex
      bestBetweenClassVariance = betweenClassVariance
    }
  }

  const lowerClassCount = bestSplitIndex + 1
  const upperClassCount = sortedValues.length - lowerClassCount
  const threshold = requireFiniteResult(
    sortedValues[bestSplitIndex] / 2 + sortedValues[bestSplitIndex + 1] / 2,
    'otsu',
  )
  const separabilityRatio = requireFiniteResult(
    bestBetweenClassVariance / totalVariance,
    'otsu',
  )
  return {
    status: 'calculated',
    threshold,
    diagnostics: {
      separabilityRatio: Math.min(1, Math.max(0, separabilityRatio)),
      lowerClassCount,
      upperClassCount,
    },
  }
}

function calculateVariance(values: readonly number[], mean: number): number {
  const squaredDeviationSum = requireFiniteResult(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0),
    'otsu',
  )
  return requireFiniteResult(squaredDeviationSum / values.length, 'otsu')
}
import { requireFiniteResult } from './util/require-finite-result'
