import { describe, expect, test } from 'bun:test'
import { calculateSteeringStrengthOtsu } from '../../../src/analytics/corner-detect/calculate-steering-strength-otsu'
import { calculateCornerCandidateConfidence, collectCornerCandidateConfidenceData, confirmCornerCandidates } from '../../../src/analytics/corner-detect/confirm-corner-candidates'
import { findGridCellCenters } from '../../../src/analytics/corner-detect/create-cell-aligned-steering'
import { createSteeringStrengthProfile } from '../../../src/analytics/corner-detect/create-steering-strength-profile'
import { createTrackSteeringProfile } from '../../../src/analytics/corner-detect/create-track-steering-profile'
import { deriveSteeringStrengthThresholds } from '../../../src/analytics/corner-detect/derive-steering-strength-thresholds'
import { findCornerCandidates } from '../../../src/analytics/corner-detect/find-corner-candidates'
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

describe('calculateSteeringStrengthOtsu', () => {
    test('excludes null strength values before calculating Otsu', () => {
        expect(calculateSteeringStrengthOtsu(createStrengthProfile([0, 0, 1, 1, null, 5, 5, 6, 6]))).toEqual({
            status: 'calculated',
            threshold: 3,
            diagnostics: {
                separabilityRatio: 6.25 / 6.5,
                lowerClassCount: 4,
                upperClassCount: 4,
            },
        })
    })

    test('propagates unavailable Otsu results', () => {
        expect(calculateSteeringStrengthOtsu(createStrengthProfile([null, null]))).toEqual({
            status: 'unavailable',
            reason: 'EMPTY_SAMPLE',
            sampleCount: 0,
        })
    })
})

describe('deriveSteeringStrengthThresholds', () => {
    test('derives the low threshold from the lower-class median and MAD', () => {
        const profile = createStrengthProfile([0, 0, 1, 1, 5, 5, 6, 6])
        const result = deriveSteeringStrengthThresholds(profile, calculateSteeringStrengthOtsu(profile))

        expect(result).toEqual({
            status: 'calculated',
            highThresholdDegrees: 3,
            lowThresholdDegrees: 1,
            lowerClassMedianDegrees: 0.5,
            lowerClassSpreadDegrees: 0.5,
            lowerClassSpreadSource: 'MAD',
            otsuDiagnostics: {
                separabilityRatio: 6.25 / 6.5,
                lowerClassCount: 4,
                upperClassCount: 4,
            },
        })
    })

    test('falls back to half IQR and disables hysteresis for zero spread', () => {
        const iqrProfile = createStrengthProfile([0, 0, 0, 1, 1, 5, 5])
        const zeroProfile = createStrengthProfile([0, 0, 0, 5, 5])

        expect(deriveSteeringStrengthThresholds(iqrProfile, calculateSteeringStrengthOtsu(iqrProfile))).toMatchObject({
            status: 'calculated',
            highThresholdDegrees: 3,
            lowThresholdDegrees: 0.5,
            lowerClassSpreadDegrees: 0.5,
            lowerClassSpreadSource: 'HALF_IQR',
        })
        expect(deriveSteeringStrengthThresholds(zeroProfile, calculateSteeringStrengthOtsu(zeroProfile))).toMatchObject({
            status: 'calculated',
            highThresholdDegrees: 2.5,
            lowThresholdDegrees: 2.5,
            lowerClassSpreadDegrees: 0,
            lowerClassSpreadSource: 'ZERO_SPREAD',
        })
    })

    test('propagates unavailable Otsu results', () => {
        const profile = createStrengthProfile([null])
        expect(deriveSteeringStrengthThresholds(profile, calculateSteeringStrengthOtsu(profile))).toEqual({
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
