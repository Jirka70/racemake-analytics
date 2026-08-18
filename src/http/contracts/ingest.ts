import type { WireTelemetryPayload } from '../../analytics/telemetry-types'
import type { AnalysisUsability } from '../../application/analysis-usability'
import type { AnalysisId } from './analysis'

export type { AnalysisId } from './analysis'

export type IngestRequest = Omit<WireTelemetryPayload, 'schema'> & {
  readonly schema: string
}

export interface IngestResponse {
  readonly analysisId: AnalysisId
  readonly sessionId: string
  readonly telemetrySchema: string
  readonly status: 'ready'
  readonly usability: AnalysisUsability
  readonly cacheHit: boolean
  readonly receivedFrameCount: number
  readonly retainedTimelineFrameCount: number
  readonly excludedTimelineFrameCount: number
  readonly detectedLapCount: number
  readonly racingLapCount: number
  readonly detectedCornerCount: number
  readonly rankedPhenomenonCount: number
  readonly detectorFailureCount: number
}
