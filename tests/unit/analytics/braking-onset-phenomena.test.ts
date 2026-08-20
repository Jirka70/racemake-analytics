import { describe, expect, test } from 'bun:test'
import type { DetectedCorner } from '../../../src/analytics/corner-detect/create-detected-corner-metadata'
import type { CellAlignedRacingLap, CellAlignedRacingLapCell } from '../../../src/analytics/coach/cell-aligned-racing-telemetry-types'
import type { CornerTrackRegion, StraightTrackRegion } from '../../../src/analytics/coach/track-region-types'
import type { CoachingEvidenceMargins, CoachingPhenomenonInput } from '../../../src/analytics/coach/phenomena/coaching-phenomenon-types'
import type { BrakeActivityThresholdResult } from '../../../src/analytics/coach/phenomena/braking/brake-activity-thresholds'
import {
    calculateBrakingOnsetDifferenceMs,
    classifyBrakingOnsetDifference,
    createBrakingOnsetDetector,
    createUnnecessaryBrakingReportMessage,
    findRelevantBrakeOnset,
    hasLowerEntrySpeed,
    hasLowerSteeringPeakSpeed,
    hasMeasuredBrakePressure,
    hasSignificantTimeLoss,
    hasSlowerExit,
    selectUnnecessaryBrakingReportVariant,
    type UnnecessaryBrakingReportFacts,
} from '../../../src/analytics/coach/phenomena/braking/braking-onset-phenomena'

describe('unnecessary braking report facts', () => {
    test('recognizes significant time loss at the configured boundary', () => {
        expect(hasSignificantTimeLoss(createUnnecessaryBrakingReportFacts({
            timeLossSinceBrakingStartedMs: 50,
        }), EVIDENCE_MARGINS)).toBeTrue()
        expect(hasSignificantTimeLoss(createUnnecessaryBrakingReportFacts({
            timeLossSinceBrakingStartedMs: 49,
        }), EVIDENCE_MARGINS)).toBeFalse()
    })

    test('recognizes lower entry, steering-peak, and exit speeds', () => {
        expect(hasLowerEntrySpeed(createUnnecessaryBrakingReportFacts({
            entrySpeedDifferenceKmh: -1,
        }), EVIDENCE_MARGINS)).toBeTrue()
        expect(hasLowerSteeringPeakSpeed(createUnnecessaryBrakingReportFacts({
            steeringPeakSpeedDifferenceKmh: -1,
        }), EVIDENCE_MARGINS)).toBeTrue()
        expect(hasSlowerExit(createUnnecessaryBrakingReportFacts({
            exitSpeedDifferenceKmh: -1,
        }), EVIDENCE_MARGINS)).toBeTrue()

        expect(hasLowerEntrySpeed(createUnnecessaryBrakingReportFacts({
            entrySpeedDifferenceKmh: -0.9,
        }), EVIDENCE_MARGINS)).toBeFalse()
        expect(hasLowerSteeringPeakSpeed(createUnnecessaryBrakingReportFacts({
            steeringPeakSpeedDifferenceKmh: null,
        }), EVIDENCE_MARGINS)).toBeFalse()
        expect(hasSlowerExit(createUnnecessaryBrakingReportFacts({
            exitSpeedDifferenceKmh: 2,
        }), EVIDENCE_MARGINS)).toBeFalse()
    })

    test('recognizes available measured brake pressure, including zero', () => {
        expect(hasMeasuredBrakePressure(createUnnecessaryBrakingReportFacts({
            maximumBrakeRatio: 0,
        }))).toBeTrue()
        expect(hasMeasuredBrakePressure(createUnnecessaryBrakingReportFacts({
            maximumBrakeRatio: null,
        }))).toBeFalse()
    })

    test('creates a corner-speed-cost report from synthetic evidence', () => {
        const facts = createUnnecessaryBrakingReportFacts()

        expect(selectUnnecessaryBrakingReportVariant(facts, EVIDENCE_MARGINS))
            .toBe('BRAKING_WITH_CORNER_SPEED_COST')
        expect(createUnnecessaryBrakingReportMessage(facts, EVIDENCE_MARGINS)).toBe(
            'On lap 7, you applied up to 36% brake before C5 entry, while your quickest C5 pass stayed off the brake. You entered 12.4 km/h slower and were 8.6 km/h slower in the part of C5 where you used the most steering. From the moment you started braking to the C5 exit, you lost 375 ms. Keep C5 brake-free and protect momentum through the corner.',
        )
    })

    test('adds a slower-exit consequence only when it exceeds the speed margin', () => {
        const facts = createUnnecessaryBrakingReportFacts({
            exitSpeedDifferenceKmh: -4.2,
        })

        expect(createUnnecessaryBrakingReportMessage(facts, EVIDENCE_MARGINS)).toContain(
            'You also exited 4.2 km/h slower.',
        )
    })

    test('creates a time-loss fallback without significant speed evidence', () => {
        const facts = createUnnecessaryBrakingReportFacts({
            maximumBrakeRatio: null,
            entrySpeedDifferenceKmh: null,
            steeringPeakSpeedDifferenceKmh: null,
        })

        expect(selectUnnecessaryBrakingReportVariant(facts, EVIDENCE_MARGINS))
            .toBe('BRAKING_WITH_TIME_LOSS')
        expect(createUnnecessaryBrakingReportMessage(facts, EVIDENCE_MARGINS)).toBe(
            'On lap 7, you applied the brake before C5 entry, while your quickest C5 pass stayed off the brake. From the moment you started braking to the C5 exit, you lost 375 ms. Use the brake-free pass as your reference through C5.',
        )
    })

    test('does not create a report below the time-loss margin', () => {
        const facts = createUnnecessaryBrakingReportFacts({
            timeLossSinceBrakingStartedMs: 49,
        })

        expect(selectUnnecessaryBrakingReportVariant(facts, EVIDENCE_MARGINS)).toBe('NONE')
        expect(createUnnecessaryBrakingReportMessage(facts, EVIDENCE_MARGINS)).toBeNull()
    })
})

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

        expect(detector.phenomena).toEqual(['LATE_BRAKING', 'EARLY_BRAKING', 'UNNECESSARY_BRAKING'])
        expect(detector.find(input)).toMatchObject({
            status: 'detected',
            finding: {
                phenomenon: 'LATE_BRAKING',
                lapNumber: 2,
                comparedWithLapNumber: 1,
                analysisRegionId: 'C1-entry',
                occurredAtLapElapsedMs: 450,
                message: 'On lap 2, you started braking for C1 approximately 300 ms later than on the quickest C1 pass (Lap 1).',
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
                message: 'On lap 2, you started braking for C1 approximately 300 ms earlier than on the quickest C1 pass (Lap 1).',
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

    test('detects unnecessary braking that starts on the straight before a corner', () => {
        const detector = createBrakingOnsetDetector(CALCULATED_BRAKE_THRESHOLDS)
        const input = createDetectorInputWithStraightBeforeCorner(
            [100, 150, 150, 150, 150],
            [100, 100, 100, 100, 100],
            [0, 0.6, 0.2, 0, 0],
            [0, 0, 0, 0, 0],
        )

        expect(detector.find(input)).toMatchObject({
            status: 'detected',
            finding: {
                phenomenon: 'UNNECESSARY_BRAKING',
                lapNumber: 2,
                comparedWithLapNumber: 1,
                analysisRegionId: 'C1-entry',
                occurredAtLapElapsedMs: 100,
                message: 'On lap 2, you applied up to 60% brake before C1 entry, while your quickest C1 pass stayed off the brake. From the moment you started braking to the C1 exit, you lost 200 ms. Use the brake-free pass as your reference through C1.',
                metrics: [
                    {
                        kind: 'event-position',
                        role: 'evidence',
                        event: 'braking-onset',
                        regionId: 'C1-entry',
                        location: 'before-region',
                        analyzedPass: {
                            lapNumber: 2,
                            normalizedTrackPosition: 1,
                        },
                    },
                    {
                        kind: 'brake-application',
                        role: 'evidence',
                        analyzedPass: {
                            lapNumber: 2,
                            maximumBrakeRatio: 0.6,
                        },
                        fastestRegionPass: {
                            lapNumber: 1,
                            maximumBrakeRatio: 0,
                        },
                    },
                    {
                        kind: 'speed',
                        role: 'related',
                        measurement: 'minimum',
                        analyzedPass: {
                            lapNumber: 2,
                            speedKmh: 200,
                        },
                        fastestRegionPass: {
                            lapNumber: 1,
                            speedKmh: 200,
                        },
                    },
                ],
            },
        })
    })

    test('does not report unnecessary braking when no time was lost after braking started', () => {
        const detector = createBrakingOnsetDetector(CALCULATED_BRAKE_THRESHOLDS)
        const input = createDetectorInputWithStraightBeforeCorner(
            [100, 100, 100, 100, 100],
            [100, 100, 100, 100, 100],
            [0, 0.6, 0.2, 0, 0],
            [0, 0, 0, 0, 0],
        )

        expect(detector.find(input)).toEqual({
            status: 'not-detected',
            phenomenon: 'UNNECESSARY_BRAKING',
            lapNumber: 2,
            comparedWithLapNumber: 1,
            analysisRegionId: 'C1-entry',
        })
    })

    test('does not interpret missing benchmark brake data as a brake-free region pass', () => {
        const detector = createBrakingOnsetDetector(CALCULATED_BRAKE_THRESHOLDS)
        const input = createDetectorInputWithStraightBeforeCorner(
            [100, 150, 150, 150, 150],
            [100, 100, 100, 100, 100],
            [0, 0.6, 0.2, 0, 0],
            [0, null, 0, 0, 0],
        )

        expect(detector.find(input)).toEqual({
            status: 'unavailable',
            phenomenon: 'UNNECESSARY_BRAKING',
            lapNumber: 2,
            comparedWithLapNumber: 1,
            analysisRegionId: 'C1-entry',
            limitations: [{
                code: 'UNRELIABLE_BENCHMARK_BRAKE_DATA',
                message: 'The fastest observed region pass does not have reliable brake data throughout the preceding straight and current corner.',
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

const EVIDENCE_MARGINS: CoachingEvidenceMargins = {
    minimumTimeLossMs: 50,
    minimumSpeedDifferenceKmh: 1,
}

function createUnnecessaryBrakingReportFacts(
    overrides: Partial<UnnecessaryBrakingReportFacts> = {},
): UnnecessaryBrakingReportFacts {
    return {
        lapNumber: 7,
        cornerId: 'C5',
        hasBrakingStartedBeforeCorner: true,
        maximumBrakeRatio: 0.36,
        timeLossSinceBrakingStartedMs: 375,
        entrySpeedDifferenceKmh: -12.4,
        steeringPeakSpeedDifferenceKmh: -8.6,
        exitSpeedDifferenceKmh: -0.2,
        ...overrides,
    }
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

function createDetectorInputWithStraightBeforeCorner(
    comparedCellDurationsMs: readonly number[],
    fastestObservedCellDurationsMs: readonly number[],
    comparedBrakeRatios: readonly (number | null)[],
    fastestObservedBrakeRatios: readonly (number | null)[],
): CoachingPhenomenonInput {
    const comparedLap = createLapWithBrakeRatios(2, comparedCellDurationsMs, comparedBrakeRatios)
    const fastestObservedLap = createLapWithBrakeRatios(1, fastestObservedCellDurationsMs, fastestObservedBrakeRatios)
    const straightBeforeCurrentCorner: StraightTrackRegion = {
        type: 'straight',
        id: 'C2-C1',
        previousCornerId: 'C2',
        nextCornerId: 'C1',
        cellIndexes: [0, 1],
    }
    const currentCorner: CornerTrackRegion = {
        type: 'corner',
        id: 'C1',
        corner: {} as DetectedCorner,
        cellIndexes: [2, 3, 4],
        phases: [
            { id: 'C1-entry', cornerId: 'C1', phase: 'entry', cellIndexes: [2] },
            { id: 'C1-apex-proxy', cornerId: 'C1', phase: 'apex-proxy', cellIndexes: [3] },
            { id: 'C1-exit', cornerId: 'C1', phase: 'exit', cellIndexes: [4] },
        ],
    }
    const comparedCornerDurationMs = sumCellDurations(comparedCellDurationsMs, currentCorner.cellIndexes)
    const fastestObservedCornerDurationMs = sumCellDurations(fastestObservedCellDurationsMs, currentCorner.cellIndexes)

    return {
        comparison: {
            trackRegionId: 'C1',
            comparedLapNumber: 2,
            comparedLapRegionDurationMs: comparedCornerDurationMs,
            fastestObserved: {
                lapNumber: 1,
                regionDurationMs: fastestObservedCornerDurationMs,
                comparedLapMinusObservedPassMs: comparedCornerDurationMs - fastestObservedCornerDurationMs,
            },
            slowestObserved: {
                lapNumber: 2,
                regionDurationMs: comparedCornerDurationMs,
                comparedLapMinusObservedPassMs: 0,
            },
        },
        regionContext: {
            previousTrackRegion: straightBeforeCurrentCorner,
            currentTrackRegion: currentCorner,
            contextCellIndexes: [...straightBeforeCurrentCorner.cellIndexes, ...currentCorner.cellIndexes],
        },
        comparedLap,
        fastestObservedLap,
    }
}

function sumCellDurations(cellDurationsMs: readonly number[], cellIndexes: readonly number[]): number {
    return cellIndexes.reduce((sum, cellIndex) => sum + (cellDurationsMs[cellIndex] ?? 0), 0)
}

function createLapWithBrakeRatios(lapNumber: number, cellDurationsMs: readonly number[], brakeRatios: readonly (number | null)[]): CellAlignedRacingLap {
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
