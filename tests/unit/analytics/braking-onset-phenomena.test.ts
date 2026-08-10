import { describe, expect, test } from 'bun:test'
import type { DetectedCorner } from '../../../src/analytics/corner-detect/create-detected-corner-metadata'
import type { CellAlignedRacingLap, CellAlignedRacingLapCell } from '../../../src/analytics/coach/cell-aligned-racing-telemetry-types'
import type { CornerTrackRegion } from '../../../src/analytics/coach/track-region-types'
import type { CoachingPhenomenonInput } from '../../../src/analytics/coach/phenomena/coaching-phenomenon-types'
import type { BrakeActivityThresholdResult } from '../../../src/analytics/coach/phenomena/braking/brake-activity-thresholds'
import { calculateBrakingOnsetDifferenceMs, classifyBrakingOnsetDifference, createBrakingOnsetDetector, findRelevantBrakeOnset } from '../../../src/analytics/coach/phenomena/braking/braking-onset-phenomena'

describe('findRelevantBrakeOnset', () => {
    test('finds the first new braking run in context order', () => {
        const cells = createCells(5)

        expect(findRelevantBrakeOnset(cells, [false, false, true, true, false], [0, 1, 2, 3, 4])).toEqual({
            status: 'found',
            boundary: {
                precedingInactiveCellIndex: 1,
                onsetCellIndex: 2,
            },
        })
    })

    test('keeps the first new braking run when a later run is longer', () => {
        const cells = createCells(7)

        expect(findRelevantBrakeOnset(cells, [false, true, false, true, true, true, false], [0, 1, 2, 3, 4, 5, 6])).toEqual({
            status: 'found',
            boundary: {
                precedingInactiveCellIndex: 0,
                onsetCellIndex: 1,
            },
        })
    })

    test('ignores a braking run truncated by the start of the context', () => {
        const cells = createCells(6)

        expect(findRelevantBrakeOnset(cells, [true, true, false, false, true, true], [0, 1, 2, 3, 4, 5])).toEqual({
            status: 'found',
            boundary: {
                precedingInactiveCellIndex: 3,
                onsetCellIndex: 4,
            },
        })
    })

    test('returns not found when no new braking run starts', () => {
        const cells = createCells(4)

        expect(findRelevantBrakeOnset(cells, [true, true, false, false], [0, 1, 2, 3])).toEqual({
            status: 'not-found',
            reason: 'NO_NEW_BRAKING_RUN_IN_CONTEXT',
        })
    })

    test('returns unavailable when the onset boundary crosses unreliable brake data', () => {
        const cells = createCells(3)
        cells[0] = createCell(0, { timelineContinuous: false })

        expect(findRelevantBrakeOnset(cells, [false, true, true], [0, 1, 2])).toEqual({
            status: 'unavailable',
            reason: 'UNRELIABLE_BRAKE_ONSET_BOUNDARY',
            boundaryCellIndexes: [0, 1],
        })
    })

    test('returns unavailable when brake data is missing at the onset boundary', () => {
        const cells = createCells(3)
        cells[0] = createCell(0, { brakeRatio: null })

        expect(findRelevantBrakeOnset(cells, [false, true, true], [0, 1, 2])).toEqual({
            status: 'unavailable',
            reason: 'UNRELIABLE_BRAKE_ONSET_BOUNDARY',
            boundaryCellIndexes: [0, 1],
        })
    })

    test('returns unavailable for a brake-channel discontinuity at the onset boundary', () => {
        const cells = createCells(3)
        cells[0] = createCell(0, { discontinuousChannels: ['brakeRatio'] })

        expect(findRelevantBrakeOnset(cells, [false, true, true], [0, 1, 2])).toEqual({
            status: 'unavailable',
            reason: 'UNRELIABLE_BRAKE_ONSET_BOUNDARY',
            boundaryCellIndexes: [0, 1],
        })
    })

    test('finds a later reliable boundary after unreliable inactive data', () => {
        const cells = createCells(4)
        cells[0] = createCell(0, { discontinuousChannels: ['brakeRatio'] })

        expect(findRelevantBrakeOnset(cells, [false, false, true, true], [0, 1, 2, 3])).toEqual({
            status: 'found',
            boundary: {
                precedingInactiveCellIndex: 1,
                onsetCellIndex: 2,
            },
        })
    })

    test('does not reject an onset for an unrelated channel discontinuity', () => {
        const cells = createCells(3)
        cells[0] = createCell(0, { discontinuousChannels: ['speedKmh'] })

        expect(findRelevantBrakeOnset(cells, [false, true, true], [0, 1, 2])).toEqual({
            status: 'found',
            boundary: {
                precedingInactiveCellIndex: 0,
                onsetCellIndex: 1,
            },
        })
    })

    test('follows context order across the finish line', () => {
        const cells = createCells(6)

        expect(findRelevantBrakeOnset(cells, [true, true, false, false, false, false], [4, 5, 0, 1])).toEqual({
            status: 'found',
            boundary: {
                precedingInactiveCellIndex: 5,
                onsetCellIndex: 0,
            },
        })
    })

    test('rejects a mask whose length does not match the lap grid', () => {
        expect(() => findRelevantBrakeOnset(createCells(2), [false], [0, 1]))
            .toThrow('Brake activity mask length must match the number of lap cells')
    })
})

describe('calculateBrakingOnsetDifferenceMs', () => {
    test('measures a later onset from benchmark travel time', () => {
        const fastestObservedLap = createLap([180, 190, 200, 190, 100])

        expect(calculateBrakingOnsetDifferenceMs(fastestObservedLap, 4, 0, [0, 1, 2, 3, 4])).toBe(760)
    })

    test('returns a negative benchmark travel time for an earlier onset', () => {
        const fastestObservedLap = createLap([180, 190, 200, 190, 100])

        expect(calculateBrakingOnsetDifferenceMs(fastestObservedLap, 0, 4, [0, 1, 2, 3, 4])).toBe(-760)
    })

    test('sums benchmark cells in context order across the finish line', () => {
        const fastestObservedLap = createLap([200, 100, 100, 100, 100, 300])

        expect(calculateBrakingOnsetDifferenceMs(fastestObservedLap, 1, 5, [4, 5, 0, 1])).toBe(500)
    })

    test('returns null when the benchmark interval crosses a timeline discontinuity', () => {
        const continuousLap = createLap([180, 190, 200])
        const discontinuousCell = createCell(1, { timelineContinuous: false })
        const cells = [...continuousLap.cells]
        cells[1] = {
            ...discontinuousCell,
            from: { ...discontinuousCell.from, lapElapsedMs: 180 },
            to: { ...discontinuousCell.to, lapElapsedMs: 370 },
        }
        const fastestObservedLap = { ...continuousLap, cells }

        expect(calculateBrakingOnsetDifferenceMs(fastestObservedLap, 2, 0, [0, 1, 2])).toBeNull()
    })
})

describe('classifyBrakingOnsetDifference', () => {
    test('classifies a difference at or above 250 ms as late braking', () => {
        expect(classifyBrakingOnsetDifference(250)).toBe('LATE_BRAKING')
        expect(classifyBrakingOnsetDifference(760)).toBe('LATE_BRAKING')
    })

    test('classifies a difference at or below -250 ms as early braking', () => {
        expect(classifyBrakingOnsetDifference(-250)).toBe('EARLY_BRAKING')
        expect(classifyBrakingOnsetDifference(-760)).toBe('EARLY_BRAKING')
    })

    test('does not classify a difference below the configured magnitude', () => {
        expect(classifyBrakingOnsetDifference(249)).toBeNull()
        expect(classifyBrakingOnsetDifference(-249)).toBeNull()
        expect(classifyBrakingOnsetDifference(0)).toBeNull()
    })

    test('accepts an explicit reporting sensitivity', () => {
        expect(classifyBrakingOnsetDifference(100, { minimumDifferenceMs: 100 })).toBe('LATE_BRAKING')
    })
})

describe('createBrakingOnsetDetector', () => {
    test('detects late braking through the complete mask-to-classification path', () => {
        const detector = createBrakingOnsetDetector(CALCULATED_BRAKE_THRESHOLDS)
        const input = createDetectorInput(
            [0, 0, 0, 0.6, 0.6],
            [0, 0.6, 0.6, 0, 0],
            150,
        )

        expect(detector.phenomena).toEqual(['LATE_BRAKING', 'EARLY_BRAKING'])
        expect(detector.find(input)).toMatchObject({
            status: 'detected',
            finding: {
                phenomenon: 'LATE_BRAKING',
                lapNumber: 2,
                comparedWithLapNumber: 1,
                analysisRegionId: 'C1-entry',
                occurredAtLapElapsedMs: 450,
                message: 'Braking started approximately 300 ms later than the fastest observed pass in lap 1.',
            },
        })
    })

    test('detects early braking through the same detector', () => {
        const detector = createBrakingOnsetDetector(CALCULATED_BRAKE_THRESHOLDS)
        const input = createDetectorInput(
            [0, 0.6, 0.6, 0, 0],
            [0, 0, 0, 0.6, 0.6],
            150,
        )

        expect(detector.find(input)).toMatchObject({
            status: 'detected',
            finding: {
                phenomenon: 'EARLY_BRAKING',
                occurredAtLapElapsedMs: 150,
                message: 'Braking started approximately 300 ms earlier than the fastest observed pass in lap 1.',
            },
        })
    })

    test('does not detect a braking-onset difference below 250 ms', () => {
        const detector = createBrakingOnsetDetector(CALCULATED_BRAKE_THRESHOLDS)
        const input = createDetectorInput(
            [0, 0, 0.6, 0.6],
            [0, 0.6, 0.6, 0],
            150,
        )

        expect(detector.find(input)).toEqual({
            status: 'not-detected',
            phenomenon: 'LATE_BRAKING',
            lapNumber: 2,
            comparedWithLapNumber: 1,
            analysisRegionId: 'C1-entry',
        })
    })

    test('reports the actual onset limitation instead of the former placeholder', () => {
        const detector = createBrakingOnsetDetector(CALCULATED_BRAKE_THRESHOLDS)
        const input = createDetectorInput(
            [0, 0, 0, 0],
            [0, 0.6, 0.6, 0],
            150,
        )

        expect(detector.find(input)).toEqual({
            status: 'unavailable',
            phenomenon: 'LATE_BRAKING',
            lapNumber: 2,
            comparedWithLapNumber: 1,
            analysisRegionId: 'C1-entry',
            limitations: [{
                code: 'BRAKE_ONSET_DETECTION_UNAVAILABLE',
                message: 'No new confirmed braking run starts in the compared lap region context.',
            }],
        })
    })
})

const CALCULATED_BRAKE_THRESHOLDS: BrakeActivityThresholdResult = {
    status: 'calculated',
    highThresholdRatio: 0.5,
    lowThresholdRatio: 0.1,
    lowerClassMedianRatio: 0,
    lowerClassSpreadRatio: 0.1,
    lowerClassSpreadSource: 'MAD',
    otsuDiagnostics: {
        separabilityRatio: 1,
        lowerClassCount: 5,
        upperClassCount: 5,
    },
}

interface CellOptions {
    readonly brakeRatio?: number | null
    readonly timelineContinuous?: boolean
    readonly discontinuousChannels?: CellAlignedRacingLapCell['quality']['discontinuousChannels']
}

function createCells(cellCount: number): CellAlignedRacingLapCell[] {
    return Array.from({ length: cellCount }, (_, cellIndex) => createCell(cellIndex))
}

function createLap(cellDurationsMs: readonly number[]): CellAlignedRacingLap {
    let lapElapsedMs = 0
    const cells = cellDurationsMs.map((durationMs, cellIndex) => {
        const cell = createCell(cellIndex)
        const fromLapElapsedMs = lapElapsedMs
        lapElapsedMs += durationMs
        return {
            ...cell,
            from: { ...cell.from, lapElapsedMs: fromLapElapsedMs },
            center: { ...cell.center, lapElapsedMs: fromLapElapsedMs + durationMs / 2 },
            to: { ...cell.to, lapElapsedMs },
        }
    })
    return { lapNumber: 1, lapTimeMs: lapElapsedMs, cells }
}

function createDetectorInput(comparedBrakeRatios: readonly number[], fastestObservedBrakeRatios: readonly number[], cellDurationMs: number): CoachingPhenomenonInput {
    if (comparedBrakeRatios.length !== fastestObservedBrakeRatios.length) throw new RangeError('Compared and fastest observed laps must use the same grid')

    const cellDurationsMs = comparedBrakeRatios.map(() => cellDurationMs)
    const comparedLap = createLapWithBrakeRatios(2, cellDurationsMs, comparedBrakeRatios)
    const fastestObservedLap = createLapWithBrakeRatios(1, cellDurationsMs, fastestObservedBrakeRatios)
    const corner: CornerTrackRegion = {
        type: 'corner',
        id: 'C1',
        corner: {} as DetectedCorner,
        cellIndexes: comparedBrakeRatios.map((_, cellIndex) => cellIndex),
        phases: [{ id: 'C1-entry', cornerId: 'C1', phase: 'entry', cellIndexes: [0, 1, 2] }],
    }
    return {
        comparison: {
            trackRegionId: 'C1',
            comparedLapNumber: 2,
            comparedLapRegionDurationMs: comparedLap.lapTimeMs,
            fastestObserved: { lapNumber: 1, regionDurationMs: fastestObservedLap.lapTimeMs, comparedLapMinusObservedPassMs: comparedLap.lapTimeMs - fastestObservedLap.lapTimeMs },
            slowestObserved: { lapNumber: 2, regionDurationMs: comparedLap.lapTimeMs, comparedLapMinusObservedPassMs: 0 },
        },
        regionContext: {
            previousTrackRegion: null,
            currentTrackRegion: corner,
            contextCellIndexes: corner.cellIndexes,
        },
        comparedLap,
        fastestObservedLap,
    }
}

function createLapWithBrakeRatios(lapNumber: number, cellDurationsMs: readonly number[], brakeRatios: readonly number[]): CellAlignedRacingLap {
    const lap = createLap(cellDurationsMs)
    const cells = lap.cells.map((cell, cellIndex) => ({
        ...cell,
        center: { ...cell.center, brakeRatio: brakeRatios[cellIndex] ?? null },
    }))
    return { ...lap, lapNumber, cells }
}

function createCell(cellIndex: number, options: CellOptions = {}): CellAlignedRacingLapCell {
    const brakeRatio = options.brakeRatio === undefined ? 0 : options.brakeRatio
    return {
        cellIndex,
        from: { normalizedTrackPosition: cellIndex, lapElapsedMs: cellIndex * 100 },
        center: {
            normalizedTrackPosition: cellIndex + 0.5,
            lapElapsedMs: cellIndex * 100 + 50,
            speedKmh: 200,
            brakeRatio,
            throttleRatio: 0,
            steeringDegrees: 0,
            gear: 5,
            engineRpm: 8_000,
            tyreCoreTemperatureC: { frontLeft: 80, frontRight: 80, rearLeft: 80, rearRight: 80 },
        },
        to: { normalizedTrackPosition: cellIndex + 1, lapElapsedMs: (cellIndex + 1) * 100 },
        quality: {
            timelineContinuous: options.timelineContinuous ?? true,
            discontinuousChannels: options.discontinuousChannels ?? [],
        },
    }
}
