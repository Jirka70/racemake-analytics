import { describe, expect, test } from 'bun:test'
import { calculateSteeringStrengthOtsu } from '../../../src/analytics/corner-detect/calculate-steering-strength-otsu'
import { computeProfileResidualRequirement } from '../../../src/analytics/corner-detect/compute-profile-residual-requirement'
import { calculateCornerCandidateConfidence, collectCornerCandidateConfidenceData, confirmCornerCandidates } from '../../../src/analytics/corner-detect/confirm-corner-candidates'
import { findGridCellCenters } from '../../../src/analytics/corner-detect/create-cell-aligned-steering'
import { calculateApexProxyThreshold, createDetectedCornerMetadata } from '../../../src/analytics/corner-detect/create-detected-corner-metadata'
import { createDetectedCorners } from '../../../src/analytics/corner-detect/create-detected-corners'
import { createLogSteeringStrengthProfile } from '../../../src/analytics/corner-detect/create-log-steering-strength-profile'
import { createSteeringStrengthProfile } from '../../../src/analytics/corner-detect/create-steering-strength-profile'
import { createTrackSteeringProfile } from '../../../src/analytics/corner-detect/create-track-steering-profile'
import { deriveSteeringStrengthThresholds } from '../../../src/analytics/corner-detect/derive-steering-strength-thresholds'
import { findCornerCandidates } from '../../../src/analytics/corner-detect/find-corner-candidates'
import { findInnerCornersInCandidates, isValleyWideEnough } from '../../../src/analytics/corner-detect/find-inner-corners-in-candidates'
import { calculateValleyVotes, computeValleysInRacingLaps, confirmValleysAcrossRacingLaps, createPeakValleyPeaksInRacingLaps, findLapPeakValleyPeakReferencesInRacingLaps } from '../../../src/analytics/corner-detect/find-lap-peak-valley-peak-references'
import { smoothTrackSteeringProfile } from '../../../src/analytics/corner-detect/smooth-track-steering-profile'
import type { LinearLapGrid } from '../../../src/analytics/lap-detect/lap-detect-types'

describe('findGridCellCenters', () => {
    test('returns one midpoint for every grid cell without duplicating start-finish', () => {
        const grid: LinearLapGrid = {
            cellCount: 4,
            positionStep: 0.25,
            positions: [0, 0.25, 0.5, 0.75, 1],
            medianUsablePositionSampleCountPerLap: 4,
        }

        expect(findGridCellCenters(grid)).toEqual([0.125, 0.375, 0.625, 0.875])
    })
})

describe('calculateApexProxyThreshold', () => {
    test('returns the half-prominence strength between the low threshold and peak', () => {
        expect(calculateApexProxyThreshold(2, 10)).toBe(6)
    })

    test('creates one contiguous apex proxy around the peak across start-finish', () => {
        const corner = { startCellIndex: 6, endCellIndexExclusive: 3, cellIndexes: [6, 7, 0, 1, 2] }
        const result = createDetectedCornerMetadata([corner], createStrengthProfile([10, 6, 2, 0, 0, 0, 2, 7]), 2)

        expect(result).toEqual([{
            ...corner,
            entry: {
                startCellIndex: 6,
                endCellIndexExclusive: 7,
                cellIndexes: [6],
                startNormalizedPosition: 6 / 8,
                endNormalizedPosition: 7 / 8,
            },
            apexProxy: {
                peakCellIndex: 0,
                steeringStrengthThresholdDegrees: 6,
                startCellIndex: 7,
                endCellIndexExclusive: 2,
                cellIndexes: [7, 0, 1],
                startNormalizedPosition: 7 / 8,
                endNormalizedPosition: 2 / 8,
            },
            exit: {
                startCellIndex: 2,
                endCellIndexExclusive: 3,
                cellIndexes: [2],
                startNormalizedPosition: 2 / 8,
                endNormalizedPosition: 3 / 8,
            },
        }])
    })

    test('returns null entry and exit when the apex proxy covers the whole corner', () => {
        const corner = { startCellIndex: 0, endCellIndexExclusive: 2, cellIndexes: [0, 1] }

        expect(createDetectedCornerMetadata([corner], createStrengthProfile([10, 10]), 0)).toEqual([{
            ...corner,
            entry: null,
            apexProxy: {
                peakCellIndex: 1,
                steeringStrengthThresholdDegrees: 5,
                startCellIndex: 0,
                endCellIndexExclusive: 0,
                cellIndexes: [0, 1],
                startNormalizedPosition: 0,
                endNormalizedPosition: 0,
            },
            exit: null,
        }])
    })
})

describe('createTrackSteeringProfile', () => {
    test('calculates signed and unsigned pointwise medians without null votes', () => {
        const profile = createTrackSteeringProfile({
            cellCenters: [0.25, 0.75],
            laps: [
                { lapNumber: 1, contribution: 'whole-track', steeringDegreesByCell: [12, null], cornerDetectionSupportedCellMask: [true, false] },
                { lapNumber: 2, contribution: 'whole-track', steeringDegreesByCell: [11, -4], cornerDetectionSupportedCellMask: [true, true] },
                { lapNumber: 3, contribution: 'supported-cells', steeringDegreesByCell: [-13, -6], cornerDetectionSupportedCellMask: [true, true] },
            ],
        }, [])

        expect(profile.cells).toEqual([
            { cellCenter: 0.25, signedMedianSteeringDegrees: 11, unsignedMedianSteeringDegrees: 12, lapSupportCount: 3, lapSupportFraction: 1 },
            { cellCenter: 0.75, signedMedianSteeringDegrees: -5, unsignedMedianSteeringDegrees: 5, lapSupportCount: 2, lapSupportFraction: 2 / 3 },
        ])
    })
})

describe('smoothTrackSteeringProfile', () => {
    test('smooths every cell through one circular pass', () => {
        const profile = createSteeringProfile([10, 0, 0, 0, 0])
        const result = smoothTrackSteeringProfile(profile, { polynomialOrder: 2, windowSize: 5, minimumLapSupport: 2 })
        const values = result.cells.map(({ smoothedSignedSteeringDegrees }) => smoothedSignedSteeringDegrees)

        expect(values[0]).toBeCloseTo(170 / 35)
        expect(values[1]).toBeCloseTo(120 / 35)
        expect(values[2]).toBeCloseTo(-30 / 35)
        expect(values[3]).toBeCloseTo(-30 / 35)
        expect(values[4]).toBeCloseTo(120 / 35)
    })

    test('never smooths a window containing null', () => {
        const profile = createSteeringProfile([null, 1, 1, 1, 1, 1])
        const result = smoothTrackSteeringProfile(profile, { polynomialOrder: 2, windowSize: 5, minimumLapSupport: 2 })
        const values = result.cells.map(({ smoothedSignedSteeringDegrees }) => smoothedSignedSteeringDegrees)

        expect(values.filter((value) => value !== null)).toHaveLength(1)
        expect(values[3]).toBeCloseTo(1)
    })
})

describe('computeProfileResidualRequirement', () => {
    test('returns the median log residual plus the scaled MAD contribution', () => {
        const profile = createSteeringProfile([0, Math.expm1(1), Math.expm1(2)])
        const smoothedProfile = createSmoothedSteeringProfile([0, 0, 0])

        expect(computeProfileResidualRequirement(profile, smoothedProfile, 2)).toBeCloseTo(1 + 2 * 1.4826)
    })

    test('uses scaled IQR when MAD is zero and excludes null cells', () => {
        const profile = createSteeringProfile([null, 0, 0, 0, Math.expm1(1), Math.expm1(1)])
        const smoothedProfile = createSmoothedSteeringProfile([0, 0, 0, 0, 0, 0])

        expect(computeProfileResidualRequirement(profile, smoothedProfile, 2)).toBeCloseTo(2 / 1.349)
    })
})

describe('createSteeringStrengthProfile', () => {
    test('keeps signed steering and derives strength without replacing null', () => {
        const result = createSteeringStrengthProfile({
            polynomialOrder: 2,
            windowSize: 5,
            minimumLapSupport: 2,
            cells: [
                { cellCenter: 0.1, smoothedSignedSteeringDegrees: -4 },
                { cellCenter: 0.2, smoothedSignedSteeringDegrees: 0 },
                { cellCenter: 0.3, smoothedSignedSteeringDegrees: null },
            ],
        })

        expect(result.cells).toEqual([
            { cellCenter: 0.1, signedSteeringDegrees: -4, steeringStrengthDegrees: 4 },
            { cellCenter: 0.2, signedSteeringDegrees: 0, steeringStrengthDegrees: 0 },
            { cellCenter: 0.3, signedSteeringDegrees: null, steeringStrengthDegrees: null },
        ])
    })
})

describe('createLogSteeringStrengthProfile', () => {
    test('transforms available strengths and preserves cell centers and nulls', () => {
        const result = createLogSteeringStrengthProfile(createStrengthProfile([0, Math.E - 1, null]))

        expect(result.cells[0]).toEqual({ cellCenter: 1 / 6, logSteeringStrength: 0 })
        expect(result.cells[1]?.cellCenter).toBe(0.5)
        expect(result.cells[1]?.logSteeringStrength).toBeCloseTo(1)
        expect(result.cells[2]).toEqual({ cellCenter: 5 / 6, logSteeringStrength: null })
    })
})

describe('calculateSteeringStrengthOtsu', () => {
    test('excludes null strength values before calculating Otsu', () => {
        const profile = createLogSteeringStrengthProfile(createStrengthProfile([0, 0, 1, 1, null, 5, 5, 6, 6]))
        const result = calculateSteeringStrengthOtsu(profile)

        expect(result.status).toBe('calculated')
        if (result.status !== 'calculated') throw new Error('Expected a log steering-strength Otsu threshold')
        expect(result.threshold).toBeCloseTo((Math.log1p(1) + Math.log1p(5)) / 2)
        expect(result.diagnostics).toMatchObject({ lowerClassCount: 4, upperClassCount: 4 })
    })

    test('propagates unavailable Otsu results', () => {
        expect(calculateSteeringStrengthOtsu(createLogSteeringStrengthProfile(createStrengthProfile([null, null])))).toEqual({
            status: 'unavailable',
            reason: 'EMPTY_SAMPLE',
            sampleCount: 0,
        })
    })
})

describe('deriveSteeringStrengthThresholds', () => {
    test('derives the low threshold from the lower-class median and MAD', () => {
        const profile = createStrengthProfile([0, 0, 1, 1, 5, 5, 6, 6])
        const result = deriveSteeringStrengthThresholds(profile, calculateSteeringStrengthOtsu(createLogSteeringStrengthProfile(profile)))

        expect(result).toMatchObject({
            status: 'calculated',
            lowThresholdDegrees: 1,
            lowerClassMedianDegrees: 0.5,
            lowerClassSpreadDegrees: 0.5,
            lowerClassSpreadSource: 'MAD',
            otsuDiagnostics: { lowerClassCount: 4, upperClassCount: 4 },
        })
        if (result.status !== 'calculated') throw new Error('Expected steering-strength thresholds')
        expect(result.highThresholdDegrees).toBeCloseTo(Math.sqrt(12) - 1)
    })

    test('falls back to half IQR and disables hysteresis for zero spread', () => {
        const iqrProfile = createStrengthProfile([0, 0, 0, 1, 1, 5, 5])
        const zeroProfile = createStrengthProfile([0, 0, 0, 5, 5])

        expect(deriveSteeringStrengthThresholds(iqrProfile, calculateSteeringStrengthOtsu(createLogSteeringStrengthProfile(iqrProfile)))).toMatchObject({
            status: 'calculated',
            lowThresholdDegrees: 0.5,
            lowerClassSpreadDegrees: 0.5,
            lowerClassSpreadSource: 'HALF_IQR',
        })
        const zeroResult = deriveSteeringStrengthThresholds(zeroProfile, calculateSteeringStrengthOtsu(createLogSteeringStrengthProfile(zeroProfile)))
        expect(zeroResult).toMatchObject({
            status: 'calculated',
            lowerClassSpreadDegrees: 0,
            lowerClassSpreadSource: 'ZERO_SPREAD',
        })
        if (zeroResult.status !== 'calculated') throw new Error('Expected steering-strength thresholds')
        expect(zeroResult.highThresholdDegrees).toBeCloseTo(Math.sqrt(6) - 1)
        expect(zeroResult.lowThresholdDegrees).toBeCloseTo(zeroResult.highThresholdDegrees)
    })

    test('propagates unavailable Otsu results', () => {
        const profile = createStrengthProfile([null])
        expect(deriveSteeringStrengthThresholds(profile, calculateSteeringStrengthOtsu(createLogSteeringStrengthProfile(profile)))).toEqual({
            status: 'unavailable',
            reason: 'EMPTY_SAMPLE',
            sampleCount: 0,
        })
    })
})

describe('findCornerCandidates', () => {
    test('enters at the high threshold and exits below the low threshold', () => {
        expect(findCornerCandidates(createStrengthProfile([0, 2, 4, 3, 2, 0]), createThresholds(2, 4))).toEqual([
            { startCellIndex: 2, endCellIndexExclusive: 5, cellIndexes: [2, 3, 4] },
        ])
    })

    test('continues a candidate across the start-finish boundary', () => {
        expect(findCornerCandidates(createStrengthProfile([3, 2, 0, 0, 4, 3]), createThresholds(2, 4))).toEqual([
            { startCellIndex: 4, endCellIndexExclusive: 2, cellIndexes: [4, 5, 0, 1] },
        ])
    })

    test('never continues through a null cell', () => {
        expect(findCornerCandidates(createStrengthProfile([4, 3, null, 3]), createThresholds(2, 4))).toEqual([
            { startCellIndex: 0, endCellIndexExclusive: 2, cellIndexes: [0, 1] },
        ])
    })

    test('returns every separate candidate in track order', () => {
        expect(findCornerCandidates(createStrengthProfile([0, 4, 2, 0, 5, 0]), createThresholds(2, 4))).toEqual([
            { startCellIndex: 1, endCellIndexExclusive: 3, cellIndexes: [1, 2] },
            { startCellIndex: 4, endCellIndexExclusive: 5, cellIndexes: [4] },
        ])
    })
})

describe('calculateCornerCandidateConfidence', () => {
    test('calculates one racing lap contribution', () => {
        expect(calculateCornerCandidateConfidence(0.8, 0.75, 5)).toBeCloseTo(0.12)
    })

    test('returns zero confidence without racing laps', () => {
        expect(calculateCornerCandidateConfidence(0.8, 0.75, 0)).toBe(0)
    })
})

describe('collectCornerCandidateConfidenceData', () => {
    test('collects candidate coverage and per-lap hysteresis overlap', () => {
        const candidate = { startCellIndex: 1, endCellIndexExclusive: 4, cellIndexes: [1, 2, 3] }
        const result = collectCornerCandidateConfidenceData([candidate], {
            cellCenters: [1, 2, 3, 4, 5, 6].map((value) => value / 6),
            laps: [
                createAlignedLap(1, [0, 4, 3, 2, 0, 0]),
                createAlignedLap(2, [0, 4, null, 2, 0, 0]),
            ],
        }, createThresholds(2, 4))

        expect(result).toEqual([{
            candidate,
            racingLapCount: 2,
            laps: [
                { lapNumber: 1, dataCoverage: 1, steeringOverlap: 1 },
                { lapNumber: 2, dataCoverage: 2 / 3, steeringOverlap: 0.5 },
            ],
        }])
    })

    test('keeps only candidates above the minimum confidence', () => {
        const candidate = { startCellIndex: 1, endCellIndexExclusive: 4, cellIndexes: [1, 2, 3] }
        const alignedSteering = {
            cellCenters: [1, 2, 3, 4, 5, 6].map((value) => value / 6),
            laps: [
                createAlignedLap(1, [0, 4, 3, 2, 0, 0]),
                createAlignedLap(2, [0, 4, null, 2, 0, 0]),
            ],
        }

        expect(confirmCornerCandidates([candidate], alignedSteering, createThresholds(2, 4), 0.5)).toEqual([
            { ...candidate, confidence: 2 / 3 },
        ])
        expect(confirmCornerCandidates([candidate], alignedSteering, createThresholds(2, 4), 2 / 3)).toEqual([])
    })
})

describe('findInnerCornersInCandidates', () => {
    test('alternates between local maxima and local minima inside a candidate', () => {
        const candidate = createConfirmedCandidate([1, 2, 3, 4, 5, 6])
        const result = findInnerCorners([candidate], [0, 2, 5, 3, 1, 4, 2, 0])
        const leftPeak = { cellIndex: 2, cellCenter: 2.5 / 8, steeringStrengthDegrees: 5 }
        const valley = { cellIndex: 4, cellCenter: 4.5 / 8, steeringStrengthDegrees: 1 }
        const rightPeak = { cellIndex: 5, cellCenter: 5.5 / 8, steeringStrengthDegrees: 4 }
        const peakValleyPeak = { leftPeak, valley, rightPeak }
        const valleyDepth = {
            peakValleyPeak,
            weakerPeakSide: 'right' as const,
            weakerPeakStrengthDegrees: 4,
            depthDegrees: 3,
            depthLog: Math.log1p(4) - Math.log1p(1),
            halfDepthStrengthDegrees: Math.expm1((Math.log1p(4) + Math.log1p(1)) / 2),
            halfDepthLog: (Math.log1p(4) + Math.log1p(1)) / 2,
        }

        expect(result).toEqual([{
            candidate,
            peaks: [leftPeak, rightPeak],
            valleys: [valley],
            peakValleyPeaks: [peakValleyPeak],
            valleyDepths: [valleyDepth],
            profileResidualRequirementLog: 0,
            deepValleyDepths: [valleyDepth],
            valleyWidths: [{
                valleyDepth,
                startCellIndex: 4,
                endCellIndexExclusive: 5,
                cellIndexes: [4],
                cellCount: 1,
                normalizedPositionSpan: 1 / 8,
                minimumRecognizableCellCount: 5,
            }],
            profileValidatedValleys: [],
        }])
    })

    test('keeps only valleys deeper than the profile residual requirement', () => {
        const values = [0, 2, 5, 4, 5, 1, 8, 2, 0]
        const candidate = createConfirmedCandidate([1, 2, 3, 4, 5, 6, 7])
        const residualProfile = createSteeringProfile(values.map(() => Math.expm1(0.5)))
        const smoothedProfile = createSmoothedSteeringProfile(values.map(() => 0))
        const result = findInnerCornersInCandidates([candidate], createStrengthProfile(values), residualProfile, smoothedProfile, 3)

        expect(result[0]?.profileResidualRequirementLog).toBeCloseTo(0.5)
        expect(result[0]?.deepValleyDepths.map(({ peakValleyPeak }) => peakValleyPeak.valley.cellIndex)).toEqual([5])
    })

    test('measures one continuous half-depth valley span across the start-finish boundary', () => {
        const candidate = createConfirmedCandidate([5, 6, 7, 0, 1, 2, 3])
        const result = findInnerCorners([candidate], [1, 2, 6, 2, 0, 2, 5, 2])

        expect(result[0]?.valleyWidths).toEqual([{
            valleyDepth: result[0]?.deepValleyDepths[0],
            startCellIndex: 7,
            endCellIndexExclusive: 2,
            cellIndexes: [7, 0, 1],
            cellCount: 3,
            normalizedPositionSpan: 3 / 8,
            minimumRecognizableCellCount: 5,
        }])
        expect(isValleyWideEnough(result[0]!.valleyWidths[0]!)).toBeFalse()
        expect(isValleyWideEnough({ ...result[0]!.valleyWidths[0]!, cellCount: 5 })).toBeTrue()
        expect(result[0]?.profileValidatedValleys).toEqual([])
    })

    test('profile-validates a valley that is both deep and at least one SG window wide', () => {
        const values = [0, 5, 2, 2, 1, 2, 2, 6, 0]
        const candidate = createConfirmedCandidate(values.map((_, cellIndex) => cellIndex))
        const result = findInnerCorners([candidate], values)

        expect(result[0]?.profileValidatedValleys).toHaveLength(1)
        expect(result[0]?.profileValidatedValleys[0]).toMatchObject({
            startCellIndex: 2,
            endCellIndexExclusive: 7,
            cellIndexes: [2, 3, 4, 5, 6],
            cellCount: 5,
            minimumRecognizableCellCount: 5,
        })
    })

    test('reports equal neighboring peaks without choosing an arbitrary weaker side', () => {
        const candidate = createConfirmedCandidate([1, 2, 3, 4, 5])
        const result = findInnerCorners([candidate], [0, 2, 5, 1, 5, 2, 0])

        expect(result[0]?.valleyDepths[0]).toMatchObject({
            weakerPeakSide: 'equal',
            weakerPeakStrengthDegrees: 5,
            depthDegrees: 4,
        })
        expect(result[0]?.valleyDepths[0]?.depthLog).toBeCloseTo(Math.log1p(5) - Math.log1p(1))
        expect(result[0]?.valleyDepths[0]?.halfDepthStrengthDegrees).toBeCloseTo(Math.expm1((Math.log1p(5) + Math.log1p(1)) / 2))
    })

    test('returns an independent shape for every confirmed candidate', () => {
        const candidates = [createConfirmedCandidate([1, 2, 3]), createConfirmedCandidate([6, 7, 8])]
        const result = findInnerCorners(candidates, [0, 1, 4, 1, 0, 0, 2, 5, 2, 0])

        expect(result.map(({ peaks }) => peaks)).toEqual([
            [{ cellIndex: 2, cellCenter: 0.25, steeringStrengthDegrees: 4 }],
            [{ cellIndex: 7, cellCenter: 0.75, steeringStrengthDegrees: 5 }],
        ])
    })

    test('follows candidate cell order across the start-finish boundary', () => {
        const candidate = createConfirmedCandidate([5, 6, 0, 1])
        const result = findInnerCorners([candidate], [5, 3, 0, 0, 0, 2, 6])

        expect(result[0]?.peaks).toEqual([{ cellIndex: 6, cellCenter: 6.5 / 7, steeringStrengthDegrees: 6 }])
        expect(result[0]?.valleys).toEqual([])
        expect(result[0]?.peakValleyPeaks).toEqual([])
        expect(result[0]?.valleyDepths).toEqual([])
        expect(result[0]?.deepValleyDepths).toEqual([])
        expect(result[0]?.valleyWidths).toEqual([])
        expect(result[0]?.profileValidatedValleys).toEqual([])
    })
})

describe('findLapPeakValleyPeakReferencesInRacingLaps', () => {
    test('finds per-lap extrema around the shared profile reference indexes with circular wrapping', () => {
        const peakValleyPeak = {
            leftPeak: { cellIndex: 7, cellCenter: 0.75, steeringStrengthDegrees: 5 },
            valley: { cellIndex: 0, cellCenter: 0.05, steeringStrengthDegrees: 1 },
            rightPeak: { cellIndex: 4, cellCenter: 0.45, steeringStrengthDegrees: 6 },
        }
        const racingLaps = [
            createAlignedLap(2, [1, 3, 2, 4, 6, 8, 2, 7]),
            createAlignedLap(3, [2, 1, 4, null, null, 5, 9, 3]),
        ]

        expect(findLapPeakValleyPeakReferencesInRacingLaps(peakValleyPeak, racingLaps, 3)).toEqual([
            { lapNumber: 2, leftPeakCellIndex: 7, valleyCellIndex: 0, rightPeakCellIndex: 5 },
            { lapNumber: 3, leftPeakCellIndex: 6, valleyCellIndex: 1, rightPeakCellIndex: 5 },
        ])
    })

    test('creates steering-strength peak-valley-peaks and keeps an unconfirmed lap as null', () => {
        const peakValleyPeak = {
            leftPeak: { cellIndex: 0, cellCenter: 1 / 6, steeringStrengthDegrees: 8 },
            valley: { cellIndex: 1, cellCenter: 0.5, steeringStrengthDegrees: 2 },
            rightPeak: { cellIndex: 2, cellCenter: 5 / 6, steeringStrengthDegrees: 10 },
        }
        const cellAlignedSteering = {
            cellCenters: [1 / 6, 0.5, 5 / 6],
            laps: [
                createAlignedLap(2, [-8, -2, -10]),
                createAlignedLap(3, [-7, null, -9]),
            ],
        }

        expect(createPeakValleyPeaksInRacingLaps(peakValleyPeak, cellAlignedSteering, 1)).toEqual([
            { lapNumber: 2, peakValleyPeak },
            { lapNumber: 3, peakValleyPeak: null },
        ])
    })

    test('computes per-lap depth and one continuous half-depth mask across start-finish', () => {
        const cellCenters = Array.from({ length: 8 }, (_, cellIndex) => (cellIndex + 0.5) / 8)
        const peakValleyPeak = {
            leftPeak: { cellIndex: 6, cellCenter: cellCenters[6]!, steeringStrengthDegrees: 8 },
            valley: { cellIndex: 0, cellCenter: cellCenters[0]!, steeringStrengthDegrees: 1 },
            rightPeak: { cellIndex: 2, cellCenter: cellCenters[2]!, steeringStrengthDegrees: 9 },
        }
        const cellAlignedSteering = {
            cellCenters,
            laps: [
                createAlignedLap(2, [1, 2, 9, 8, 8, 2, 8, 2]),
                createAlignedLap(3, [null, 2, 9, 8, 8, 2, 8, 2]),
            ],
        }
        const racingLapPeakValleyPeaks = createPeakValleyPeaksInRacingLaps(peakValleyPeak, cellAlignedSteering, 1)
        const result = computeValleysInRacingLaps(racingLapPeakValleyPeaks, cellAlignedSteering)

        expect(result[0]?.depthLog).toBeCloseTo(Math.log1p(8) - Math.log1p(1))
        expect(result[0]?.halfDepthStrengthDegrees).toBeCloseTo(Math.expm1((Math.log1p(8) + Math.log1p(1)) / 2))
        expect(result[0]).toMatchObject({ lapNumber: 2, valleyWidthCellCount: 3, valleyCellMask: [true, true, false, false, false, false, false, true] })
        expect(result[1]).toEqual({ lapNumber: 3, peakValleyPeak: null, depthLog: null, halfDepthStrengthDegrees: null, valleyWidthCellCount: 0, valleyCellMask: [false, false, false, false, false, false, false, false] })
    })

    test('returns the racing laps whose valley depth exceeds the profile requirement', () => {
        const peakValleyPeak = {
            leftPeak: { cellIndex: 0, cellCenter: 0.1, steeringStrengthDegrees: 8 },
            valley: { cellIndex: 1, cellCenter: 0.2, steeringStrengthDegrees: 1 },
            rightPeak: { cellIndex: 2, cellCenter: 0.3, steeringStrengthDegrees: 9 },
        }
        const supportedValley = { lapNumber: 2, peakValleyPeak, depthLog: 0.8, halfDepthStrengthDegrees: 3, valleyWidthCellCount: 1, valleyCellMask: [false, true, false] }
        const shallowValley = { ...supportedValley, lapNumber: 3, depthLog: 0.2 }
        const missingValley = { lapNumber: 4, peakValleyPeak: null, depthLog: null, halfDepthStrengthDegrees: null, valleyWidthCellCount: 0, valleyCellMask: [false, false, false] }

        expect(confirmValleysAcrossRacingLaps(peakValleyPeak, [supportedValley, shallowValley, missingValley], 0.5)).toEqual({
            peakValleyPeak,
            lapSupport: [{ lapNumber: 2, peakValleyPeak, valleyCellMask: [false, true, false] }],
        })
    })

    test('counts only per-lap confidence above one half as a vote for the valley', () => {
        const peakValleyPeak = {
            leftPeak: { cellIndex: 0, cellCenter: 0.1, steeringStrengthDegrees: 8 },
            valley: { cellIndex: 1, cellCenter: 0.2, steeringStrengthDegrees: 1 },
            rightPeak: { cellIndex: 2, cellCenter: 0.3, steeringStrengthDegrees: 9 },
        }
        const cellAlignedSteering = {
            cellCenters: [0.1, 0.2],
            laps: [createAlignedLap(1, [1, 1]), createAlignedLap(2, [1, 1]), createAlignedLap(3, [1, 1])],
        }
        const result = calculateValleyVotes({
            peakValleyPeak,
            lapSupport: [
                { lapNumber: 1, peakValleyPeak, valleyCellMask: [true, true] },
                { lapNumber: 2, peakValleyPeak, valleyCellMask: [true, false] },
            ],
        }, [0, 1], cellAlignedSteering)

        expect(result.lapVotes).toEqual([
            { lapNumber: 1, confidence: 1, isVoteFor: true },
            { lapNumber: 2, confidence: 0.5, isVoteFor: false },
            { lapNumber: 3, confidence: 0, isVoteFor: false },
        ])
        expect(result).toMatchObject({ voteCount: 1, racingLapCount: 3, confirmed: false })
    })
})

describe('createDetectedCorners', () => {
    test('splits a candidate at a valley confirmed by a majority of racing laps', () => {
        const values = [0, 5, 2, 2, 1, 2, 2, 6, 0]
        const candidate = createConfirmedCandidate(values.map((_, cellIndex) => cellIndex))
        const candidateShapes = findInnerCorners([candidate], values)
        const cellAlignedSteering = {
            cellCenters: values.map((_, cellIndex) => (cellIndex + 0.5) / values.length),
            laps: [createAlignedLap(1, values), createAlignedLap(2, values), createAlignedLap(3, values)],
        }
        const result = createDetectedCorners(candidateShapes, cellAlignedSteering, 5)

        expect(result.confirmedInnerValleys).toHaveLength(1)
        expect(result.confirmedInnerValleys[0]).toMatchObject({ voteCount: 3, racingLapCount: 3, confirmed: true })
        expect(result.corners).toEqual([
            { startCellIndex: 0, endCellIndexExclusive: 4, cellIndexes: [0, 1, 2, 3] },
            { startCellIndex: 4, endCellIndexExclusive: 0, cellIndexes: [4, 5, 6, 7, 8] },
        ])
    })
})

function createSteeringProfile(values: readonly (number | null)[]) {
    return {
        selectedLaps: [],
        cells: values.map((value, index) => ({
            cellCenter: (index + 0.5) / values.length,
            signedMedianSteeringDegrees: value,
            unsignedMedianSteeringDegrees: value === null ? null : Math.abs(value),
            lapSupportCount: value === null ? 0 : 2,
            lapSupportFraction: value === null ? 0 : 1,
        })),
    }
}

function createStrengthProfile(values: readonly (number | null)[]) {
    return {
        cells: values.map((value, index) => ({
            cellCenter: (index + 0.5) / values.length,
            signedSteeringDegrees: value,
            steeringStrengthDegrees: value,
        })),
    }
}

function createSmoothedSteeringProfile(values: readonly (number | null)[]) {
    return {
        polynomialOrder: 2,
        windowSize: 5,
        minimumLapSupport: 2,
        cells: values.map((value, index) => ({
            cellCenter: (index + 0.5) / values.length,
            smoothedSignedSteeringDegrees: value,
        })),
    }
}

function createThresholds(lowThresholdDegrees: number, highThresholdDegrees: number) {
    return {
        status: 'calculated' as const,
        highThresholdDegrees,
        lowThresholdDegrees,
        lowerClassMedianDegrees: 0,
        lowerClassSpreadDegrees: 0,
        lowerClassSpreadSource: 'ZERO_SPREAD' as const,
        otsuDiagnostics: { separabilityRatio: 1, lowerClassCount: 1, upperClassCount: 1 },
    }
}

function createAlignedLap(lapNumber: number, values: readonly (number | null)[]) {
    return {
        lapNumber,
        contribution: 'whole-track' as const,
        steeringDegreesByCell: values,
        cornerDetectionSupportedCellMask: values.map((value) => value !== null),
    }
}

function createConfirmedCandidate(cellIndexes: readonly number[]) {
    return {
        startCellIndex: cellIndexes[0]!,
        endCellIndexExclusive: cellIndexes[cellIndexes.length - 1]! + 1,
        cellIndexes,
        confidence: 1,
    }
}

function findInnerCorners(candidates: readonly ReturnType<typeof createConfirmedCandidate>[], values: readonly number[]) {
    return findInnerCornersInCandidates(candidates, createStrengthProfile(values), createSteeringProfile(values), createSmoothedSteeringProfile(values), 3)
}
