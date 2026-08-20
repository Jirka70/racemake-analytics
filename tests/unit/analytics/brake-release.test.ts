import { describe, expect, test } from 'bun:test'
import type { DetectedCorner } from '../../../src/analytics/corner-detect/create-detected-corner-metadata'
import type { CellAlignedRacingLap, CellAlignedRacingLapCell } from '../../../src/analytics/coach/cell-aligned-racing-telemetry-types'
import type { CornerTrackRegion } from '../../../src/analytics/coach/track-region-types'
import type { CoachingPhenomenonInput } from '../../../src/analytics/coach/phenomena/coaching-phenomenon-types'
import type { BrakeActivityThresholdResult } from '../../../src/analytics/coach/phenomena/braking/brake-activity-thresholds'
import {
    calculateBrakeReleaseDifferenceMs,
    createBrakeReleaseDetector,
    createBrakeReleaseReportMessage,
    findBrakeRelease,
    findBrakeReleases,
    hasFasterEntry,
    hasLostTimeAfterFastestRelease,
    hasSlowerExit,
    isLateBrakeRelease,
    selectBrakeReleaseReportVariant,
    type BrakeReleaseEvidenceMargins,
    type BrakeReleaseReportFacts,
} from '../../../src/analytics/coach/phenomena/braking/brake-release'

describe('createBrakeReleaseDetector', () => {
    test('detects and reports a late brake release through the complete detector path', () => {
        const detector = createBrakeReleaseDetector(CALCULATED_BRAKE_THRESHOLDS)
        const input = createDetectorInput()

        expect(detector.find(input)).toMatchObject({
            status: 'detected',
            finding: {
                phenomenon: 'LATE_BRAKE_RELEASE',
                lapNumber: 2,
                comparedWithLapNumber: 1,
                analysisRegionId: 'C1',
                occurredAtLapElapsedMs: 850,
                message: 'On lap 2, you entered C1 10.0 km/h faster than on your quickest C1 pass, but kept braking for 300 ms longer. From the point where Lap 1 stopped braking to the C1 exit, you lost 150 ms and exited 10.0 km/h slower. The additional entry speed did not pay off — finish braking earlier and protect the exit.',
                metrics: [
                    {
                        kind: 'event-position',
                        role: 'evidence',
                        event: 'brake-release',
                        regionId: 'C1',
                        location: 'in-region',
                        analyzedPass: {
                            lapNumber: 2,
                            normalizedTrackPosition: 5,
                        },
                    },
                    {
                        kind: 'timing-difference',
                        role: 'evidence',
                        event: 'brake-release',
                        differenceMs: 300,
                    },
                    {
                        kind: 'speed',
                        role: 'related',
                        measurement: 'entry',
                        analyzedPass: {
                            lapNumber: 2,
                            speedKmh: 210,
                        },
                        fastestRegionPass: {
                            lapNumber: 1,
                            speedKmh: 200,
                        },
                    },
                    {
                        kind: 'speed',
                        role: 'related',
                        measurement: 'minimum',
                        analyzedPass: {
                            lapNumber: 2,
                            speedKmh: 185,
                        },
                        fastestRegionPass: {
                            lapNumber: 1,
                            speedKmh: 190,
                        },
                    },
                    {
                        kind: 'speed',
                        role: 'related',
                        measurement: 'exit',
                        analyzedPass: {
                            lapNumber: 2,
                            speedKmh: 190,
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
})

describe('brake release report facts', () => {
    test('recognizes a later brake release', () => {
        expect(isLateBrakeRelease(createReportFacts({ brakeReleaseDifferenceMs: 294 }))).toBeTrue()
        expect(isLateBrakeRelease(createReportFacts({ brakeReleaseDifferenceMs: 250 }))).toBeTrue()
        expect(isLateBrakeRelease(createReportFacts({ brakeReleaseDifferenceMs: 249 }))).toBeFalse()
        expect(isLateBrakeRelease(createReportFacts({ brakeReleaseDifferenceMs: 0 }))).toBeFalse()
        expect(isLateBrakeRelease(createReportFacts({ brakeReleaseDifferenceMs: -294 }))).toBeFalse()
    })

    test('accepts an explicit late-release reporting sensitivity', () => {
        expect(isLateBrakeRelease(
            createReportFacts({ brakeReleaseDifferenceMs: 100 }),
            { minimumDifferenceMs: 100 },
        )).toBeTrue()
    })

    test('recognizes a faster corner entry', () => {
        expect(hasFasterEntry(createReportFacts({ entrySpeedDifferenceKmh: 1 }), REPORT_MARGINS)).toBeTrue()
        expect(hasFasterEntry(createReportFacts({ entrySpeedDifferenceKmh: 0.9 }), REPORT_MARGINS)).toBeFalse()
        expect(hasFasterEntry(createReportFacts({ entrySpeedDifferenceKmh: -9.1 }), REPORT_MARGINS)).toBeFalse()
        expect(hasFasterEntry(createReportFacts({ entrySpeedDifferenceKmh: null }), REPORT_MARGINS)).toBeFalse()
    })

    test('recognizes time lost after the fastest-region release point', () => {
        expect(hasLostTimeAfterFastestRelease(createReportFacts({ timeLossFromFastestReleaseMs: 50 }), REPORT_MARGINS)).toBeTrue()
        expect(hasLostTimeAfterFastestRelease(createReportFacts({ timeLossFromFastestReleaseMs: 49 }), REPORT_MARGINS)).toBeFalse()
        expect(hasLostTimeAfterFastestRelease(createReportFacts({ timeLossFromFastestReleaseMs: -155 }), REPORT_MARGINS)).toBeFalse()
        expect(hasLostTimeAfterFastestRelease(createReportFacts({ timeLossFromFastestReleaseMs: null }), REPORT_MARGINS)).toBeFalse()
    })

    test('recognizes a slower corner exit', () => {
        expect(hasSlowerExit(createReportFacts({ exitSpeedDifferenceKmh: -1 }), REPORT_MARGINS)).toBeTrue()
        expect(hasSlowerExit(createReportFacts({ exitSpeedDifferenceKmh: -0.9 }), REPORT_MARGINS)).toBeFalse()
        expect(hasSlowerExit(createReportFacts({ exitSpeedDifferenceKmh: 4.7 }), REPORT_MARGINS)).toBeFalse()
        expect(hasSlowerExit(createReportFacts({ exitSpeedDifferenceKmh: null }), REPORT_MARGINS)).toBeFalse()
    })

    test('creates the complete late-release report from supported facts', () => {
        expect(createBrakeReleaseReportMessage(createReportFacts(), REPORT_MARGINS)).toBe(
            'On lap 8, you entered C6 7.5 km/h faster than on your quickest C6 pass, but kept braking for 320 ms longer. From the point where Lap 3 stopped braking to the C6 exit, you lost 140 ms and exited 3.2 km/h slower. The additional entry speed did not pay off — finish braking earlier and protect the exit.',
        )
    })

    test('creates a slower-exit report without claiming a faster entry', () => {
        const facts = createReportFacts({ entrySpeedDifferenceKmh: null })

        expect(selectBrakeReleaseReportVariant(facts, REPORT_MARGINS)).toBe('LATE_RELEASE_WITH_SLOWER_EXIT')
        expect(createBrakeReleaseReportMessage(facts, REPORT_MARGINS)).toBe(
            'On lap 8, you kept braking for 320 ms longer into C6 than on your quickest C6 pass. From the point where Lap 3 stopped braking to the C6 exit, you lost 140 ms and exited 3.2 km/h slower. Finish braking earlier and protect the exit.',
        )
    })

    test('creates a time-loss report without claiming a slower exit', () => {
        const facts = createReportFacts({ exitSpeedDifferenceKmh: null })

        expect(selectBrakeReleaseReportVariant(facts, REPORT_MARGINS)).toBe('LATE_RELEASE_WITH_TIME_LOSS')
        expect(createBrakeReleaseReportMessage(facts, REPORT_MARGINS)).toBe(
            'On lap 8, you kept braking for 320 ms longer into C6 than on your quickest C6 pass. From the point where Lap 3 stopped braking to the C6 exit, you lost 140 ms. Finish braking earlier through C6.',
        )
    })

    test.each([
        ['late brake release', { brakeReleaseDifferenceMs: 249 }],
        ['measured time loss', { timeLossFromFastestReleaseMs: 49 }],
    ] as const)('does not create a report without significant %s evidence', (_description, overrides) => {
        expect(createBrakeReleaseReportMessage(createReportFacts(overrides), REPORT_MARGINS)).toBeNull()
    })
})

describe('calculateBrakeReleaseDifferenceMs', () => {
    test('measures a later release from fastest-region travel time', () => {
        const fastestRegionPassLap = createLap([180, 190, 200, 190, 100])

        expect(calculateBrakeReleaseDifferenceMs(
            fastestRegionPassLap,
            4,
            0,
            [0, 1, 2, 3, 4],
        )).toBe(760)
    })

    test('returns a negative fastest-region travel time for an earlier release', () => {
        const fastestRegionPassLap = createLap([180, 190, 200, 190, 100])

        expect(calculateBrakeReleaseDifferenceMs(
            fastestRegionPassLap,
            0,
            4,
            [0, 1, 2, 3, 4],
        )).toBe(-760)
    })

    test('uses region order across the finish line', () => {
        const fastestRegionPassLap = createLap([200, 100, 100, 100, 100, 300])

        expect(calculateBrakeReleaseDifferenceMs(
            fastestRegionPassLap,
            1,
            5,
            [4, 5, 0, 1],
        )).toBe(500)
    })

    test('returns null when the fastest-region interval crosses a timeline discontinuity', () => {
        const continuousLap = createLap([180, 190, 200])
        const cells = [...continuousLap.cells]
        cells[1] = {
            ...cells[1]!,
            quality: {
                ...cells[1]!.quality,
                timelineContinuous: false,
            },
        }
        const fastestRegionPassLap = { ...continuousLap, cells }

        expect(calculateBrakeReleaseDifferenceMs(
            fastestRegionPassLap,
            2,
            0,
            [0, 1, 2],
        )).toBeNull()
    })
})

describe('findBrakeReleases', () => {
    test('finds releases for the compared and fastest regions', () => {
        const lapCells = createCells(5)

        expect(findBrakeReleases(
            {
                lapCells,
                brakingMask: [false, true, true, false, false],
                onsetCellIndex: 1,
            },
            {
                lapCells,
                brakingMask: [false, true, false, false, false],
                onsetCellIndex: 1,
            },
        )).toEqual({
            comparedRegionBrakeRelease: {
                status: 'found',
                boundary: {
                    lastActiveCellIndex: 2,
                    releaseCellIndex: 3,
                },
            },
            fastestRegionBrakeRelease: {
                status: 'found',
                boundary: {
                    lastActiveCellIndex: 1,
                    releaseCellIndex: 2,
                },
            },
        })
    })
})

describe('findBrakeRelease', () => {
    test('finds the first inactive cell after the braking onset', () => {
        expect(findBrakeRelease(
            createCells(5),
            [false, true, true, false, false],
            1,
        )).toEqual({
            status: 'found',
            boundary: {
                lastActiveCellIndex: 2,
                releaseCellIndex: 3,
            },
        })
    })

    test('finds the release of a one-cell braking run', () => {
        expect(findBrakeRelease(
            createCells(3),
            [false, true, false],
            1,
        )).toEqual({
            status: 'found',
            boundary: {
                lastActiveCellIndex: 1,
                releaseCellIndex: 2,
            },
        })
    })

    test('follows a braking run across the finish line', () => {
        expect(findBrakeRelease(
            createCells(4),
            [true, false, false, true],
            3,
        )).toEqual({
            status: 'found',
            boundary: {
                lastActiveCellIndex: 0,
                releaseCellIndex: 1,
            },
        })
    })

    test('returns not found when braking remains active around the complete lap', () => {
        expect(findBrakeRelease(
            createCells(3),
            [true, true, true],
            1,
        )).toEqual({
            status: 'not-found',
            reason: 'BRAKING_RUN_CONTINUES_TO_CONTEXT_END',
        })
    })

    test('does not interpret missing brake data as a release', () => {
        const cells = createCells(3)
        cells[2] = createCell(2, { brakeRatio: null })

        expect(findBrakeRelease(
            cells,
            [false, true, false],
            1,
        )).toEqual({
            status: 'unavailable',
            reason: 'UNRELIABLE_BRAKE_RELEASE_BOUNDARY',
            boundaryCellIndexes: [1, 2],
        })
    })

    test('does not interpret a brake-channel discontinuity as a release', () => {
        const cells = createCells(3)
        cells[2] = createCell(2, { discontinuousChannels: ['brakeRatio'] })

        expect(findBrakeRelease(
            cells,
            [false, true, false],
            1,
        )).toEqual({
            status: 'unavailable',
            reason: 'UNRELIABLE_BRAKE_RELEASE_BOUNDARY',
            boundaryCellIndexes: [1, 2],
        })
    })

    test('rejects an onset cell that is inactive in the mask', () => {
        expect(() => findBrakeRelease(
            createCells(2),
            [false, true],
            0,
        )).toThrow('Brake onset cell index 0 must be active in the brake activity mask')
    })
})

interface CellOptions {
    readonly brakeRatio?: number | null
    readonly discontinuousChannels?: CellAlignedRacingLapCell['quality']['discontinuousChannels']
}

const REPORT_MARGINS: BrakeReleaseEvidenceMargins = {
    minimumTimeLossMs: 50,
    minimumSpeedDifferenceKmh: 1,
}

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

function createDetectorInput(): CoachingPhenomenonInput {
    const comparedLap = createDetectorLap(
        2,
        [150, 150, 150, 200, 200, 200],
        [0, 0.6, 0.6, 0.6, 0.6, 0],
        [210, 200, 195, 190, 185, 190],
    )
    const fastestObservedLap = createDetectorLap(
        1,
        [150, 150, 150, 150, 150, 150],
        [0, 0.6, 0.6, 0, 0, 0],
        [200, 200, 195, 190, 190, 200],
    )
    const currentCorner: CornerTrackRegion = {
        type: 'corner',
        id: 'C1',
        corner: {} as DetectedCorner,
        cellIndexes: [0, 1, 2, 3, 4, 5],
        phases: [],
    }

    return {
        comparison: {
            trackRegionId: 'C1',
            comparedLapNumber: 2,
            comparedLapRegionDurationMs: comparedLap.lapTimeMs,
            fastestObserved: {
                lapNumber: 1,
                regionDurationMs: fastestObservedLap.lapTimeMs,
                comparedLapMinusObservedPassMs: comparedLap.lapTimeMs - fastestObservedLap.lapTimeMs,
            },
            slowestObserved: {
                lapNumber: 2,
                regionDurationMs: comparedLap.lapTimeMs,
                comparedLapMinusObservedPassMs: 0,
            },
        },
        regionContext: {
            previousTrackRegion: null,
            currentTrackRegion: currentCorner,
            contextCellIndexes: currentCorner.cellIndexes,
        },
        comparedLap,
        fastestObservedLap,
    }
}

function createDetectorLap(
    lapNumber: number,
    cellDurationsMs: readonly number[],
    brakeRatios: readonly number[],
    speedsKmh: readonly number[],
): CellAlignedRacingLap {
    const lap = createLap(cellDurationsMs)
    const cells = lap.cells.map((cell, cellIndex) => ({
        ...cell,
        center: {
            ...cell.center,
            brakeRatio: brakeRatios[cellIndex] ?? null,
            speedKmh: speedsKmh[cellIndex] ?? null,
        },
    }))
    return { ...lap, lapNumber, cells }
}

function createReportFacts(
    overrides: Partial<BrakeReleaseReportFacts> = {},
): BrakeReleaseReportFacts {
    return {
        lapNumber: 8,
        cornerId: 'C6',
        fastestRegionPassLapNumber: 3,
        brakeReleaseDifferenceMs: 320,
        entrySpeedDifferenceKmh: 7.5,
        timeLossFromFastestReleaseMs: 140,
        exitSpeedDifferenceKmh: -3.2,
        ...overrides,
    }
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
            timelineContinuous: true,
            discontinuousChannels: options.discontinuousChannels ?? [],
        },
    }
}
