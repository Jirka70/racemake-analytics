import type { DetectedLapGridCoverage, LapGridCoverage, LinearLapGrid } from './lap-detect-types'

export function createLinearizedLapCoverage(elapsedTimestampsMs: readonly (number | null)[], steeringDegrees: readonly (number | null)[], grid: LinearLapGrid): DetectedLapGridCoverage {
    const positionSupportMask = elapsedTimestampsMs.map((value) => value !== null)
    const steeringSupportMask = steeringDegrees.map((value) => value !== null)
    const positionCoverage = summarizeGridCoverage(positionSupportMask, grid)

    return { position: positionCoverage, elapsedTime: positionCoverage, steering: summarizeGridCoverage(steeringSupportMask, grid) }
}

function summarizeGridCoverage(supportMask: readonly boolean[], grid: LinearLapGrid): LapGridCoverage {
    const supportedGridPointCount = supportMask.filter(Boolean).length

    return {
        supportMask,
        supportedGridPointCount,
        coverageRatio: supportedGridPointCount / supportMask.length,
        longestUnsupportedNormalizedPositionSpan: calculateLongestUnsupportedPositionSpan(supportMask, grid.positionStep),
    }
}

function calculateLongestUnsupportedPositionSpan(supportMask: readonly boolean[], positionStep: number): number {
    let currentUnsupportedGridPointCount = 0
    let longestUnsupportedGridPointCount = 0

    for (const isSupported of supportMask) {
        currentUnsupportedGridPointCount = isSupported ? 0 : currentUnsupportedGridPointCount + 1
        longestUnsupportedGridPointCount = Math.max(longestUnsupportedGridPointCount, currentUnsupportedGridPointCount)
    }

    const unsupportedGridPointCountAfterStart = countUnsupportedGridPointsFromStart(supportMask)
    const unsupportedGridPointCountBeforeFinish = countUnsupportedGridPointsFromFinish(supportMask)
    const unsupportedGridPointCountAcrossStartFinish = unsupportedGridPointCountAfterStart > 0
        && unsupportedGridPointCountBeforeFinish > 0
        ? unsupportedGridPointCountAfterStart + unsupportedGridPointCountBeforeFinish - 1
        : 0

    return Math.min(
        1,
        Math.max(longestUnsupportedGridPointCount, unsupportedGridPointCountAcrossStartFinish) * positionStep,
    )
}

function countUnsupportedGridPointsFromStart(supportMask: readonly boolean[]): number {
    let count = 0
    while (count < supportMask.length && supportMask[count] === false) count++
    return count
}

function countUnsupportedGridPointsFromFinish(supportMask: readonly boolean[]): number {
    let count = 0
    while (count < supportMask.length && supportMask[supportMask.length - 1 - count] === false) count++
    return count
}
