import type { TrackRegion } from './track-region-types'

export interface MissingRegionBoundaryTimeLimitation {
    readonly code: 'MISSING_REGION_BOUNDARY_TIME'
    readonly boundary: 'start' | 'end'
    readonly cellIndex: number
}

export type TrackRegionTimingLimitation = MissingRegionBoundaryTimeLimitation

export interface RacingLapRegionTiming {
    readonly lapNumber: number
    readonly trackRegionId: TrackRegion['id']
    readonly durationMs: number | null
    readonly limitations: readonly TrackRegionTimingLimitation[]
}

export interface TrackRegionTiming {
    readonly region: TrackRegion
    readonly racingLapTimings: readonly RacingLapRegionTiming[]
}

export interface TrackRegionBenchmark {
    readonly region: TrackRegion
    readonly fastestObservedTiming: RacingLapRegionTiming | null
    readonly slowestObservedTiming: RacingLapRegionTiming | null
}

export interface ObservedRegionPassComparison {
    readonly lapNumber: number
    readonly regionDurationMs: number
    readonly comparedLapMinusObservedPassMs: number
}

export interface RacingLapRegionComparison {
    readonly trackRegionId: TrackRegion['id']
    readonly comparedLapNumber: number
    readonly comparedLapRegionDurationMs: number
    readonly fastestObserved: ObservedRegionPassComparison
    readonly slowestObserved: ObservedRegionPassComparison
}

export interface RacingLapRegionComparisonIndex {
    readonly byLapNumber: ReadonlyMap<number, ReadonlyMap<TrackRegion['id'], RacingLapRegionComparison>>
}
