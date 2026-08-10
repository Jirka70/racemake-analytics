import { describe, expect, test } from 'bun:test'
import type { CornerInterval, DetectedCorner } from '../../../src/analytics/corner-detect/create-detected-corner-metadata'
import { createTrackRegions } from '../../../src/analytics/coach/create-track-regions'

describe('createTrackRegions', () => {
    test('sorts corners by apex and inserts straights including across the finish line', () => {
        const secondCorner = createCorner([4, 5], 4, 10)
        const firstCorner = createCorner([8, 9, 0, 1], 0, 10)

        const regions = createTrackRegions([secondCorner, firstCorner], 10)

        expect(regions.map(({ type, id, cellIndexes }) => ({ type, id, cellIndexes }))).toEqual([
            { type: 'corner', id: 'C1', cellIndexes: [8, 9, 0, 1] },
            { type: 'straight', id: 'C1-C2', cellIndexes: [2, 3] },
            { type: 'corner', id: 'C2', cellIndexes: [4, 5] },
            { type: 'straight', id: 'C2-C1', cellIndexes: [6, 7] },
        ])
    })

    test('creates a circular C1-C1 straight around a single corner', () => {
        const regions = createTrackRegions([createCorner([2, 3], 2, 6)], 6)

        expect(regions.map(({ type, id, cellIndexes }) => ({ type, id, cellIndexes }))).toEqual([
            { type: 'corner', id: 'C1', cellIndexes: [2, 3] },
            { type: 'straight', id: 'C1-C1', cellIndexes: [4, 5, 0, 1] },
        ])
    })

    test('returns distinguishable entry, apex-proxy, and exit phases inside a corner region', () => {
        const entry = createCornerInterval([1, 2], 10)
        const apexProxy = createCornerInterval([3], 10)
        const exit = createCornerInterval([4, 5], 10)
        const corner: DetectedCorner = {
            startCellIndex: 1,
            endCellIndexExclusive: 6,
            cellIndexes: [1, 2, 3, 4, 5],
            entry,
            apexProxy: { ...apexProxy, peakCellIndex: 3, steeringStrengthThresholdDegrees: 10 },
            exit,
        }

        const region = createTrackRegions([corner], 10)[0]

        expect(region?.type).toBe('corner')
        if (region?.type !== 'corner') throw new Error('Expected a corner region')
        expect(region.phases).toEqual([
            { id: 'C1-entry', cornerId: 'C1', phase: 'entry', cellIndexes: [1, 2] },
            { id: 'C1-apex-proxy', cornerId: 'C1', phase: 'apex-proxy', cellIndexes: [3] },
            { id: 'C1-exit', cornerId: 'C1', phase: 'exit', cellIndexes: [4, 5] },
        ])
        expect(region.phases.flatMap(({ cellIndexes }) => [...cellIndexes])).toEqual([...region.cellIndexes])
    })

    test('returns the whole grid as unsupported when no corner was detected', () => {
        expect(createTrackRegions([], 4)).toEqual([
            { type: 'unsupported', id: 'U1', cellIndexes: [0, 1, 2, 3] },
        ])
    })
})

function createCorner(cellIndexes: readonly number[], peakCellIndex: number, cellCount: number): DetectedCorner {
    const startCellIndex = cellIndexes[0]!
    const endCellIndexExclusive = (cellIndexes[cellIndexes.length - 1]! + 1) % cellCount
    return {
        startCellIndex,
        endCellIndexExclusive,
        cellIndexes,
        entry: null,
        apexProxy: {
            startCellIndex: peakCellIndex,
            endCellIndexExclusive: (peakCellIndex + 1) % cellCount,
            cellIndexes: [peakCellIndex],
            startNormalizedPosition: peakCellIndex / cellCount,
            endNormalizedPosition: (peakCellIndex + 1) / cellCount,
            peakCellIndex,
            steeringStrengthThresholdDegrees: 10,
        },
        exit: null,
    }
}

function createCornerInterval(cellIndexes: readonly number[], cellCount: number): CornerInterval {
    const startCellIndex = cellIndexes[0]!
    const endCellIndexExclusive = (cellIndexes[cellIndexes.length - 1]! + 1) % cellCount
    return {
        startCellIndex,
        endCellIndexExclusive,
        cellIndexes,
        startNormalizedPosition: startCellIndex / cellCount,
        endNormalizedPosition: endCellIndexExclusive / cellCount,
    }
}
