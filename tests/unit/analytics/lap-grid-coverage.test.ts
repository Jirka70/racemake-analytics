import { describe, expect, test } from 'bun:test'
import { createLinearizedLapCoverage } from '../../../src/analytics/lap-detect/create-lap-grid-coverage'
import type { LinearLapGrid } from '../../../src/analytics/lap-detect/lap-detect-types'

const GRID: LinearLapGrid = {
    cellCount: 4,
    positionStep: 0.25,
    positions: [0, 0.25, 0.5, 0.75, 1],
    medianUsablePositionSampleCountPerLap: 4,
}

describe('createLinearizedLapCoverage', () => {
    test('joins one unsupported position span across the start-finish line', () => {
        const elapsedTimestampsMs = [null, null, 500, null, null]
        const coverage = createLinearizedLapCoverage(elapsedTimestampsMs, elapsedTimestampsMs, GRID)

        expect(coverage.position.supportMask).toEqual([false, false, true, false, false])
        expect(coverage.position.longestUnsupportedNormalizedPositionSpan).toBe(0.75)
    })

    test('counts the duplicated start-finish grid point only once', () => {
        const elapsedTimestampsMs = [null, 250, 500, 750, null]
        const coverage = createLinearizedLapCoverage(elapsedTimestampsMs, elapsedTimestampsMs, GRID)

        expect(coverage.position.longestUnsupportedNormalizedPositionSpan).toBe(0.25)
    })

    test('caps a completely unsupported lap at full track coverage', () => {
        const elapsedTimestampsMs = [null, null, null, null, null]
        const coverage = createLinearizedLapCoverage(elapsedTimestampsMs, elapsedTimestampsMs, GRID)

        expect(coverage.position.longestUnsupportedNormalizedPositionSpan).toBe(1)
    })
})
