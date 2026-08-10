import { describe, expect, test } from 'bun:test'
import type { CellAlignedRacingLapCell, CellAlignedRacingTelemetry } from '../../../src/analytics/coach/cell-aligned-racing-telemetry-types'
import { createTrackRegionTimings } from '../../../src/analytics/coach/create-track-region-timings'
import type { StraightTrackRegion } from '../../../src/analytics/coach/track-region-types'

describe('createTrackRegionTimings', () => {
    test('measures regular and finish-line-wrapping regions from their boundaries', () => {
        const telemetry = createTelemetry([0, 100, 250, 450, 600], 600)
        const regularRegion = createStraightRegion('C1-C2', [1, 2])
        const wrappingRegion = createStraightRegion('C2-C1', [3, 0])

        const timings = createTrackRegionTimings([regularRegion, wrappingRegion], telemetry)

        expect(timings[0]?.racingLapTimings).toEqual([
            { lapNumber: 1, trackRegionId: 'C1-C2', durationMs: 350, limitations: [] },
        ])
        expect(timings[1]?.racingLapTimings).toEqual([
            { lapNumber: 1, trackRegionId: 'C2-C1', durationMs: 250, limitations: [] },
        ])
    })

    test('returns null duration and boundary limitations when region boundaries are missing', () => {
        const telemetry = createTelemetry([0, null, 250, null, 600], 600)
        const region = createStraightRegion('C1-C2', [1, 2])

        const timing = createTrackRegionTimings([region], telemetry)[0]?.racingLapTimings[0]

        expect(timing).toEqual({
            lapNumber: 1,
            trackRegionId: 'C1-C2',
            durationMs: null,
            limitations: [
                { code: 'MISSING_REGION_BOUNDARY_TIME', boundary: 'start', cellIndex: 1 },
                { code: 'MISSING_REGION_BOUNDARY_TIME', boundary: 'end', cellIndex: 2 },
            ],
        })
    })
})

function createTelemetry(boundaryTimesMs: readonly (number | null)[], lapTimeMs: number): CellAlignedRacingTelemetry {
    const cells = Array.from({ length: boundaryTimesMs.length - 1 }, (_, cellIndex) => createCell(
        cellIndex,
        boundaryTimesMs[cellIndex] ?? null,
        boundaryTimesMs[cellIndex + 1] ?? null,
    ))
    return { laps: [{ lapNumber: 1, lapTimeMs, cells }] }
}

function createCell(cellIndex: number, fromTimeMs: number | null, toTimeMs: number | null): CellAlignedRacingLapCell {
    const fromPosition = cellIndex / 4
    const toPosition = (cellIndex + 1) / 4
    return {
        cellIndex,
        from: { normalizedTrackPosition: fromPosition, lapElapsedMs: fromTimeMs },
        center: {
            normalizedTrackPosition: (fromPosition + toPosition) / 2,
            lapElapsedMs: null,
            speedKmh: null,
            brakeRatio: null,
            throttleRatio: null,
            steeringDegrees: null,
            gear: null,
            engineRpm: null,
            tyreCoreTemperatureC: null,
        },
        to: { normalizedTrackPosition: toPosition, lapElapsedMs: toTimeMs },
        quality: { timelineContinuous: true, discontinuousChannels: [] },
    }
}

function createStraightRegion(id: StraightTrackRegion['id'], cellIndexes: readonly number[]): StraightTrackRegion {
    const [previousCornerId, nextCornerId] = id.split('-') as [StraightTrackRegion['previousCornerId'], StraightTrackRegion['nextCornerId']]
    return { type: 'straight', id, previousCornerId, nextCornerId, cellIndexes }
}
