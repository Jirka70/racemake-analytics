import type {
  CornerPhase,
  CornerPhaseRegionId,
  CornerTrackRegionId,
  StraightTrackRegionId,
  UnsupportedTrackRegionId,
} from '../../analytics/coach/track-region-types'
import type { AnalysisResponseContext } from './analysis'

export interface TrackPositionIntervalResponse {
  readonly startNormalizedTrackPosition: number
  readonly endNormalizedTrackPosition: number
  readonly crossesStartFinishLine: boolean
}

export interface CornerPhaseResponse {
  readonly id: CornerPhaseRegionId
  readonly phase: CornerPhase
  readonly interval: TrackPositionIntervalResponse
  readonly peakNormalizedTrackPosition?: number
}

export interface CornerRegionResponse {
  readonly type: 'corner'
  readonly id: CornerTrackRegionId
  readonly interval: TrackPositionIntervalResponse
  readonly phases: readonly CornerPhaseResponse[]
}

export interface StraightRegionResponse {
  readonly type: 'straight'
  readonly id: StraightTrackRegionId
  readonly previousCornerId: CornerTrackRegionId
  readonly nextCornerId: CornerTrackRegionId
  readonly interval: TrackPositionIntervalResponse
}

export interface UnsupportedRegionResponse {
  readonly type: 'unsupported'
  readonly id: UnsupportedTrackRegionId
  readonly interval: TrackPositionIntervalResponse
}

export type TrackRegionResponse =
  | CornerRegionResponse
  | StraightRegionResponse
  | UnsupportedRegionResponse

export interface TrackResponse extends AnalysisResponseContext {
  readonly regions: readonly TrackRegionResponse[]
}
