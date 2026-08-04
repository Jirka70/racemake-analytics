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

  const totalSum = sortedValues.reduce((sum, value) => sum + value, 0)
  const totalVariance = calculateVariance(sortedValues)
  let lowerSum = 0
  let bestSplitIndex = -1
  let bestBetweenClassVariance = -Infinity

  for (let splitIndex = 0; splitIndex < sortedValues.length - 1; splitIndex++) {
    lowerSum += sortedValues[splitIndex]
    if (sortedValues[splitIndex] === sortedValues[splitIndex + 1]) continue

    const lowerClassCount = splitIndex + 1
    const upperClassCount = sortedValues.length - lowerClassCount
    const lowerClassMean = lowerSum / lowerClassCount
    const upperClassMean = (totalSum - lowerSum) / upperClassCount
    const betweenClassVariance = lowerClassCount / sortedValues.length * upperClassCount / sortedValues.length * (lowerClassMean - upperClassMean) ** 2
    if (betweenClassVariance > bestBetweenClassVariance) {
      bestSplitIndex = splitIndex
      bestBetweenClassVariance = betweenClassVariance
    }
  }

  const lowerClassCount = bestSplitIndex + 1
  const upperClassCount = sortedValues.length - lowerClassCount
  const threshold = sortedValues[bestSplitIndex] / 2 + sortedValues[bestSplitIndex + 1] / 2
  return {
    status: 'calculated',
    threshold,
    diagnostics: {
      separabilityRatio: Math.min(1, Math.max(0, bestBetweenClassVariance / totalVariance)),
      lowerClassCount,
      upperClassCount,
    },
  }
}

function calculateVariance(values: readonly number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
}
