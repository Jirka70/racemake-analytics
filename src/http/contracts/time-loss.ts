import type { TrackRegionTimingLimitation } from '../../analytics/coach/track-region-timing-types'
import type { TrackRegion } from '../../analytics/coach/track-region-types'
import type { AnalysisResponseContext } from './analysis'

export type TimeLossLimitationCode =
  | TrackRegionTimingLimitation['code']
  | 'REGION_TIMING_UNAVAILABLE'
  | 'FASTEST_OBSERVED_REGION_PASS_UNAVAILABLE'

export interface TimeLossLimitationResponse {
  readonly code: TimeLossLimitationCode
  readonly message: string
}

export interface FastestObservedRegionPassResponse {
  readonly lapNumber: number
  readonly durationMs: number
}

export interface RegionTimeLossResponse {
  readonly regionId: TrackRegion['id']
  readonly regionDurationMs: number | null
  readonly fastestObservedPass: FastestObservedRegionPassResponse | null
  readonly timeLossToFastestObservedPassMs: number | null
  readonly cumulativeTimeLossToIdealLapMs: number | null
  readonly limitations: readonly TimeLossLimitationResponse[]
}

export interface LapTimeLossResponse {
  readonly lapNumber: number
  readonly lapTimeMs: number
  readonly timeLossToFastestLapMs: number
  readonly timeLossToIdealLapMs: number | null
  readonly regions: readonly RegionTimeLossResponse[]
}

export interface FastestLapResponse {
  readonly lapNumber: number
  readonly lapTimeMs: number
}

export interface IdealLapResponse {
  readonly durationMs: number
  readonly basis: 'fastest-observed-pass-per-region'
}

export interface TimeLossResponse extends AnalysisResponseContext {
  readonly fastestLap: FastestLapResponse | null
  readonly idealLap: IdealLapResponse | null
  readonly laps: readonly LapTimeLossResponse[]
}
