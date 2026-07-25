const NORMAL_DISTRIBUTION_MAD_SCALE_FACTOR = 1.4826

function sortFiniteSample(values: readonly number[]): number[] {
  if (values.length === 0) {
    throw new RangeError('A statistical sample must not be empty')
  }

  if (values.some((value) => !Number.isFinite(value))) {
    throw new RangeError('A statistical sample must contain only finite values')
  }

  return [...values].sort((left, right) => left - right)
}

function quantileFromSortedSample(
  sortedValues: readonly number[],
  probability: number,
): number {
  const position = (sortedValues.length - 1) * probability
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const lowerValue = sortedValues[lowerIndex]
  const upperValue = sortedValues[upperIndex]

  if (lowerIndex === upperIndex) {
    return lowerValue
  }

  return lowerValue + (position - lowerIndex) * (upperValue - lowerValue)
}

/**
 * Returns the middle of a finite sample without mutating the input.
 * For an even-sized sample, it averages the two middle values.
 */
export function median(values: readonly number[]): number {
  return quantileFromSortedSample(sortFiniteSample(values), 0.5)
}

/**
 * Returns a linearly interpolated quantile using position `(n - 1) * p`.
 * The probability must be between zero and one, inclusive.
 */
export function quantile(
  values: readonly number[],
  probability: number,
): number {
  if (
    !Number.isFinite(probability) ||
    probability < 0 ||
    probability > 1
  ) {
    throw new RangeError('Quantile probability must be between 0 and 1')
  }

  return quantileFromSortedSample(
    sortFiniteSample(values),
    probability,
  )
}

/**
 * Measures the typical absolute distance from the sample median. Unlike
 * variance, a small number of extreme values has little influence on it.
 */
export function medianAbsoluteDeviation(
  values: readonly number[],
): number {
  const center = median(values)
  const absoluteDeviations = values.map((value) =>
    Math.abs(value - center),
  )

  return median(absoluteDeviations)
}

/**
 * Scales MAD by 1 / Φ⁻¹(0.75), making it comparable to standard deviation for
 * normally distributed data while retaining MAD's robustness to outliers.
 */
export function scaledMedianAbsoluteDeviation(
  values: readonly number[],
): number {
  return (
    NORMAL_DISTRIBUTION_MAD_SCALE_FACTOR *
    medianAbsoluteDeviation(values)
  )
}

/**
 * Returns the distance between the 25th and 75th percentiles. It is a robust
 * fallback spread measure when MAD is zero.
 */
export function interquartileRange(
  values: readonly number[],
): number {
  const sortedValues = sortFiniteSample(values)

  return (
    quantileFromSortedSample(sortedValues, 0.75) -
    quantileFromSortedSample(sortedValues, 0.25)
  )
}
