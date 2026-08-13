import type { LocallyAuditedSignalChannel } from '../../analytics/frame-audit-types'
import type {
  AnalysisId,
  AnalysisResponseContext,
} from './analysis'

export const SERIES_CHANNELS = [
  'speedKmh',
  'throttleRatio',
  'brakeRatio',
  'steeringDegrees',
  'gear',
  'engineRpm',
  'tyreCoreTemperatureC',
  'quality',
] as const

export type SeriesChannel = typeof SERIES_CHANNELS[number]

export interface SeriesQuery {
  readonly analysisId: AnalysisId
  readonly laps?: readonly number[]
  readonly channels?: readonly SeriesChannel[]
  readonly positionFrom?: number
  readonly positionTo?: number
}

export interface TyreCoreTemperatureSeriesResponse {
  readonly frontLeft: readonly (number | null)[]
  readonly frontRight: readonly (number | null)[]
  readonly rearLeft: readonly (number | null)[]
  readonly rearRight: readonly (number | null)[]
}

export interface LapSeriesQualityResponse {
  readonly timelineContinuous: readonly boolean[]
  readonly unavailableChannels: readonly (
    readonly LocallyAuditedSignalChannel[]
  )[]
}

export interface SeriesChannelDataResponse {
  readonly speedKmh?: readonly (number | null)[]
  readonly throttleRatio?: readonly (number | null)[]
  readonly brakeRatio?: readonly (number | null)[]
  readonly steeringDegrees?: readonly (number | null)[]
  readonly gear?: readonly (number | null)[]
  readonly engineRpm?: readonly (number | null)[]
  readonly tyreCoreTemperatureC?: TyreCoreTemperatureSeriesResponse
  readonly quality?: LapSeriesQualityResponse
}

export interface LapSeriesResponse {
  readonly lapNumber: number
  readonly lapTimeMs: number
  readonly lapElapsedMs: readonly (number | null)[]
  readonly channels: SeriesChannelDataResponse
}

export interface SeriesSelectionResponse {
  readonly lapNumbers: readonly number[]
  readonly channels: readonly SeriesChannel[]
  readonly positionFrom: number
  readonly positionTo: number
}

export interface SeriesResponse extends AnalysisResponseContext {
  readonly selection: SeriesSelectionResponse
  readonly grid: {
    readonly normalizedTrackPositions: readonly number[]
  }
  readonly laps: readonly LapSeriesResponse[]
}
