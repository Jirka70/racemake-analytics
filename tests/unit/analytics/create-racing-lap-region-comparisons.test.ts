import { describe, expect, test } from 'bun:test'
import { createRacingLapRegionComparisonIndex, findRacingLapRegionComparison } from '../../../src/analytics/coach/create-racing-lap-region-comparisons'
import { createTrackRegionBenchmarks } from '../../../src/analytics/coach/create-track-region-benchmarks'
import type { RacingLapRegionTiming, TrackRegionTiming } from '../../../src/analytics/coach/track-region-timing-types'
import type { StraightTrackRegion, UnsupportedTrackRegion } from '../../../src/analytics/coach/track-region-types'

describe('createRacingLapRegionComparisonIndex', () => {
    test('indexes each valid lap pass with its fastest and slowest observed comparisons', () => {
        const region: StraightTrackRegion = { type: 'straight', id: 'C1-C2', previousCornerId: 'C1', nextCornerId: 'C2', cellIndexes: [1, 2] }
        const trackRegionTimings: TrackRegionTiming[] = [{
            region,
            racingLapTimings: [createTiming(1, 100), createTiming(2, 130), createTiming(3, 90), createTiming(4, null)],
        }]
        const index = createRacingLapRegionComparisonIndex(trackRegionTimings, createTrackRegionBenchmarks(trackRegionTimings))

        expect(findRacingLapRegionComparison(index, 2, 'C1-C2')).toEqual({
            trackRegionId: 'C1-C2',
            comparedLapNumber: 2,
            comparedLapRegionDurationMs: 130,
            fastestObserved: { lapNumber: 3, regionDurationMs: 90, comparedLapMinusObservedPassMs: 40 },
            slowestObserved: { lapNumber: 2, regionDurationMs: 130, comparedLapMinusObservedPassMs: 0 },
        })
        expect(findRacingLapRegionComparison(index, 4, 'C1-C2')).toBeNull()
    })

    test('does not index unsupported regions without observed benchmarks', () => {
        const region: UnsupportedTrackRegion = { type: 'unsupported', id: 'U1', cellIndexes: [0, 1] }
        const trackRegionTimings: TrackRegionTiming[] = [{ region, racingLapTimings: [createTiming(1, 100, 'U1')] }]
        const index = createRacingLapRegionComparisonIndex(trackRegionTimings, createTrackRegionBenchmarks(trackRegionTimings))

        expect(findRacingLapRegionComparison(index, 1, 'U1')).toBeNull()
        expect(index.byLapNumber.size).toBe(0)
    })
})

function createTiming(lapNumber: number, durationMs: number | null, trackRegionId: RacingLapRegionTiming['trackRegionId'] = 'C1-C2'): RacingLapRegionTiming {
    return {
        lapNumber,
        trackRegionId,
        durationMs,
        limitations: durationMs === null
            ? [{ code: 'MISSING_REGION_BOUNDARY_TIME', boundary: 'start', cellIndex: 1 }]
            : [],
    }
}
