import { describe, expect, test } from 'bun:test'
import type { CellAlignedRacingLapCell, CellAlignedRacingTelemetry } from '../../../src/analytics/coach/cell-aligned-racing-telemetry-types'
import { calculateBrakeActivityThreshold } from '../../../src/analytics/coach/phenomena/braking/brake-activity-thresholds'

describe('calculateBrakeActivityThreshold', () => {
    test('calculates one Otsu threshold from usable brake ratios across racing laps', () => {
        const telemetry = createTelemetry([
            [createCell(0), createCell(0.1), createCell(0.4, false)],
            [createCell(0), createCell(0.8), createCell(0.5, true, ['brakeRatio'])],
            [createCell(0.9), createCell(null)],
        ])

        const result = calculateBrakeActivityThreshold(telemetry)

        expect(result).toMatchObject({
            status: 'calculated',
            otsuDiagnostics: { lowerClassCount: 3, upperClassCount: 2 },
        })
        if (result.status !== 'calculated') throw new Error('Expected brake activity threshold')
        expect(result.highThresholdRatio).toBeCloseTo(0.45)
        expect(result.lowThresholdRatio).toBeCloseTo(0.025)
        expect(result.lowerClassMedianRatio).toBe(0)
        expect(result.lowerClassSpreadRatio).toBeCloseTo(0.025)
        expect(result.lowerClassSpreadSource).toBe('HALF_IQR')
        expect(result.otsuDiagnostics.separabilityRatio).toBeCloseTo(0.9856)
    })

    test('returns unavailable when no usable brake ratio remains', () => {
        const telemetry = createTelemetry([
            [createCell(null), createCell(0.5, false), createCell(0.8, true, ['brakeRatio'])],
        ])

        expect(calculateBrakeActivityThreshold(telemetry)).toEqual({
            status: 'unavailable',
            reason: 'EMPTY_SAMPLE',
            sampleCount: 0,
        })
    })

    test('derives the low threshold from the lower-class median and MAD', () => {
        const telemetry = createTelemetry([
            [createCell(0), createCell(0.1), createCell(0.2), createCell(0.8), createCell(0.9)],
        ])

        const result = calculateBrakeActivityThreshold(telemetry)

        if (result.status !== 'calculated') throw new Error('Expected brake activity threshold')
        expect(result.highThresholdRatio).toBeCloseTo(0.5)
        expect(result.lowThresholdRatio).toBeCloseTo(0.2)
        expect(result.lowerClassMedianRatio).toBeCloseTo(0.1)
        expect(result.lowerClassSpreadRatio).toBeCloseTo(0.1)
        expect(result.lowerClassSpreadSource).toBe('MAD')
    })
})

function createTelemetry(lapCells: readonly (readonly CellAlignedRacingLapCell[])[]): CellAlignedRacingTelemetry {
    return {
        laps: lapCells.map((cells, lapIndex) => ({
            lapNumber: lapIndex + 1,
            lapTimeMs: 90_000 + lapIndex * 1_000,
            cells,
        })),
    }
}

function createCell(brakeRatio: number | null, timelineContinuous = true, discontinuousChannels: CellAlignedRacingLapCell['quality']['discontinuousChannels'] = []): CellAlignedRacingLapCell {
    return {
        cellIndex: 0,
        from: { normalizedTrackPosition: 0, lapElapsedMs: 0 },
        center: {
            normalizedTrackPosition: 0.5,
            lapElapsedMs: 500,
            speedKmh: 100,
            brakeRatio,
            throttleRatio: 0,
            steeringDegrees: 0,
            gear: 3,
            engineRpm: 5_000,
            tyreCoreTemperatureC: null,
        },
        to: { normalizedTrackPosition: 1, lapElapsedMs: 1_000 },
        quality: { timelineContinuous, discontinuousChannels },
    }
}
