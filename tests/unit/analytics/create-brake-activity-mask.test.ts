import { describe, expect, test } from 'bun:test'
import type { CellAlignedRacingLap, CellAlignedRacingLapCell } from '../../../src/analytics/coach/cell-aligned-racing-telemetry-types'
import { createBrakeActivityMask } from '../../../src/analytics/coach/phenomena/braking/create-brake-activity-mask'

describe('createBrakeActivityMask', () => {
    test('grows a high-threshold braking seed backwards and forwards through the low threshold', () => {
        const lap = createLap([
            createCell(0),
            createCell(0.1),
            createCell(0.2),
            createCell(0.6),
            createCell(0.3),
            createCell(0.1),
            createCell(0),
        ])

        expect(createBrakeActivityMask(lap, 0.5, 0.1))
            .toEqual([false, true, true, true, true, true, false])
    })

    test('does not activate a low-threshold run without a high-threshold seed', () => {
        const lap = createLap([createCell(0.1), createCell(0.4), createCell(0.2)])

        expect(createBrakeActivityMask(lap, 0.4, 0.1)).toEqual([false, false, false])
    })

    test('never grows through unreliable brake data', () => {
        const lap = createLap([
            createCell(0.6),
            createCell(0.2),
            createCell(0.2, false),
            createCell(0.2),
            createCell(0),
        ])

        expect(createBrakeActivityMask(lap, 0.5, 0.1)).toEqual([true, true, false, false, false])
    })

    test('grows a braking run across the finish line', () => {
        const lap = createLap([createCell(0.2), createCell(0), createCell(0.2), createCell(0.6)])

        expect(createBrakeActivityMask(lap, 0.5, 0.1)).toEqual([true, false, true, true])
    })
})

function createLap(cells: readonly CellAlignedRacingLapCell[]): CellAlignedRacingLap {
    return { lapNumber: 1, lapTimeMs: 90_000, cells }
}

function createCell(brakeRatio: number | null, timelineContinuous = true, discontinuousChannels: CellAlignedRacingLapCell['quality']['discontinuousChannels'] = []): CellAlignedRacingLapCell {
    return {
        cellIndex: 0,
        from: { normalizedTrackPosition: 0, lapElapsedMs: 0 },
        center: {
            normalizedTrackPosition: 0.5,
            lapElapsedMs: 50,
            speedKmh: 200,
            brakeRatio,
            throttleRatio: 0,
            steeringDegrees: 0,
            gear: 5,
            engineRpm: 8_000,
            tyreCoreTemperatureC: { frontLeft: 80, frontRight: 80, rearLeft: 80, rearRight: 80 },
        },
        to: { normalizedTrackPosition: 1, lapElapsedMs: 100 },
        quality: { timelineContinuous, discontinuousChannels },
    }
}
