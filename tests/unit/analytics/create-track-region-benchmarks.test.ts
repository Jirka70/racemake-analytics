import { describe, expect, test } from 'bun:test'
import { createTrackRegionBenchmarks } from '../../../src/analytics/coach/create-track-region-benchmarks'
import type { RacingLapRegionTiming, TrackRegionTiming } from '../../../src/analytics/coach/track-region-timing-types'
import type { StraightTrackRegion, UnsupportedTrackRegion } from '../../../src/analytics/coach/track-region-types'

describe('createTrackRegionBenchmarks', () => {
    test('selects the fastest and slowest valid observed timing', () => {
        const region: StraightTrackRegion = { type: 'straight', id: 'C1-C2', previousCornerId: 'C1', nextCornerId: 'C2', cellIndexes: [1, 2] }
        const regionTiming: TrackRegionTiming = {
            region,
            racingLapTimings: [createTiming(3, 110), createTiming(1, 90), createTiming(2, null)],
        }

        const benchmark = createTrackRegionBenchmarks([regionTiming])[0]

        expect(benchmark?.fastestObservedTiming?.lapNumber).toBe(1)
        expect(benchmark?.slowestObservedTiming?.lapNumber).toBe(3)
    })

    test('does not create a benchmark for an unsupported region', () => {
        const region: UnsupportedTrackRegion = { type: 'unsupported', id: 'U1', cellIndexes: [0, 1] }
        const benchmark = createTrackRegionBenchmarks([{ region, racingLapTimings: [createTiming(1, 100)] }])[0]

        expect(benchmark?.fastestObservedTiming).toBeNull()
        expect(benchmark?.slowestObservedTiming).toBeNull()
    })
})

function createTiming(lapNumber: number, durationMs: number | null): RacingLapRegionTiming {
    return {
        lapNumber,
        trackRegionId: 'C1-C2',
        durationMs,
        limitations: durationMs === null
            ? [{ code: 'MISSING_REGION_BOUNDARY_TIME', boundary: 'start', cellIndex: 1 }]
            : [],
    }
}
