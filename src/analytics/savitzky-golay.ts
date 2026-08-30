export interface SavitzkyGolayOptions {
  readonly polynomialOrder: number
  readonly windowSize: number
}

export function smoothWithSavitzkyGolay(values: readonly number[], options: SavitzkyGolayOptions): readonly (number | null)[] {
  if (values.some((value) => !Number.isFinite(value))) throw new RangeError('Savitzky-Golay values must be finite')

  const halfWindowSize = Math.floor(options.windowSize / 2)
  const smoothWindow = createSavitzkyGolayWindowSmoother(options)
  return values.map((_, index) => {
    if (index < halfWindowSize || index >= values.length - halfWindowSize) return null
    return smoothWindow(values.slice(index - halfWindowSize, index + halfWindowSize + 1))
  })
}

export function createSavitzkyGolayWindowSmoother(options: SavitzkyGolayOptions): (windowValues: readonly number[]) => number {
  validateOptions(options)
  const weights = calculateCenterWeights(options)
  return (windowValues) => {
    if (windowValues.length !== options.windowSize) throw new RangeError('Savitzky-Golay window must match the configured window size')
    if (windowValues.some((value) => !Number.isFinite(value))) throw new RangeError('Savitzky-Golay values must be finite')
    return requireFiniteResult(
      windowValues.reduce((smoothedValue, value, index) => smoothedValue + weights[index] * value, 0),
      'savitzky-golay',
    )
  }
}

function calculateCenterWeights({ polynomialOrder, windowSize }: SavitzkyGolayOptions): number[] {
  const halfWindow = Math.floor(windowSize / 2)
  const coefficientCount = polynomialOrder + 1
  const normalMatrix = Array.from({ length: coefficientCount }, (_, row) =>
    Array.from({ length: coefficientCount }, (_, column) => sumIntegerPowers(halfWindow, row + column)),
  )
  const centerSelector = Array.from({ length: coefficientCount }, (_, index) => index === 0 ? 1 : 0)
  const centerPolynomial = solveLinearSystem(normalMatrix, centerSelector)
  return Array.from({ length: windowSize }, (_, index) => {
    const position = index - halfWindow
    return centerPolynomial.reduce((weight, coefficient, power) => weight + coefficient * position ** power, 0)
  })
}

function sumIntegerPowers(halfWindow: number, power: number): number {
  let sum = 0
  for (let position = -halfWindow; position <= halfWindow; position++) sum += position ** power
  return sum
}

function solveLinearSystem(matrix: readonly (readonly number[])[], values: readonly number[]): number[] {
  const rows = matrix.map((row, index) => [...row, values[index]])
  for (let pivotIndex = 0; pivotIndex < rows.length; pivotIndex++) {
    const pivotRowIndex = rows.findIndex((row, index) => index >= pivotIndex && Math.abs(row[pivotIndex]) > Number.EPSILON)
    if (pivotRowIndex < 0) throw new RangeError('Savitzky-Golay polynomial fit is singular')
    const pivotRow = rows[pivotIndex]
    rows[pivotIndex] = rows[pivotRowIndex]
    rows[pivotRowIndex] = pivotRow

    const pivot = rows[pivotIndex][pivotIndex]
    for (let column = pivotIndex; column <= rows.length; column++) rows[pivotIndex][column] /= pivot
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      if (rowIndex === pivotIndex) continue
      const factor = rows[rowIndex][pivotIndex]
      for (let column = pivotIndex; column <= rows.length; column++) rows[rowIndex][column] -= factor * rows[pivotIndex][column]
    }
  }
  return rows.map((row) => row[rows.length])
}

function validateOptions({ polynomialOrder, windowSize }: SavitzkyGolayOptions): void {
  if (!Number.isInteger(windowSize) || windowSize < 1 || windowSize % 2 === 0) throw new RangeError('Savitzky-Golay window size must be a positive odd integer')
  if (!Number.isInteger(polynomialOrder) || polynomialOrder < 0 || polynomialOrder >= windowSize) throw new RangeError('Savitzky-Golay polynomial order must be a non-negative integer below the window size')
}
import { requireFiniteResult } from './util/require-finite-result'
