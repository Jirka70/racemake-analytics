import type { TrackRegion } from '../../analytics/coach/track-region-types'
import type { AnalysisResponseContext } from './analysis'
import type { SeriesChannel, SeriesChannelDataResponse } from './series'
import type { TrackPositionIntervalResponse } from './track'

export interface IdealLapQuery {
  readonly analysisId: AnalysisResponseContext['analysisId']
  readonly channels?: readonly SeriesChannel[]
  readonly positionFrom?: number
  readonly positionTo?: number
}

export interface IdealLapSelectionResponse {
  readonly channels: readonly SeriesChannel[]
  readonly positionFrom: number
  readonly positionTo: number
}

export interface IdealLapRegionSourceResponse {
  readonly regionId: TrackRegion['id']
  readonly sourceLapNumber: number
  readonly sourceDurationMs: number
  readonly interval: TrackPositionIntervalResponse
}

export interface AvailableIdealLapResponse extends AnalysisResponseContext {
  readonly status: 'available'
  readonly durationMs: number
  readonly basis: 'fastest-observed-pass-per-region'
  readonly selection: IdealLapSelectionResponse
  readonly grid: {
    readonly normalizedTrackPositions: readonly number[]
  }
  readonly lapElapsedMs: readonly (number | null)[]
  readonly channels: SeriesChannelDataResponse
  readonly regionSources: readonly IdealLapRegionSourceResponse[]
}

export interface IdealLapLimitationResponse {
  readonly code:
    | 'TRACK_GRID_UNAVAILABLE'
    | 'FASTEST_OBSERVED_REGION_PASS_UNAVAILABLE'
    | 'IDEAL_LAP_SOURCE_UNAVAILABLE'
    | 'IDEAL_LAP_TIMELINE_UNAVAILABLE'
    | 'IDEAL_LAP_TRACK_COVERAGE_INCOMPLETE'
  readonly message: string
  readonly regionId?: TrackRegion['id']
}

export interface UnavailableIdealLapResponse extends AnalysisResponseContext {
  readonly status: 'unavailable'
  readonly limitations: readonly IdealLapLimitationResponse[]
}

export type IdealLapSeriesResponse =
  AvailableIdealLapResponse | UnavailableIdealLapResponse
