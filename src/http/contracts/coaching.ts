import type {
  AnalysisLimitation,
  CoachingAnalysisRegionId,
  CoachingFindingMetric,
  CoachingPhenomenon,
} from '../../analytics/coach/phenomena/coaching-phenomenon-types'
import type { TrackRegion } from '../../analytics/coach/track-region-types'
import type { LocallyAuditedSignalChannel } from '../../analytics/frame-audit-types'
import type { AnalysisResponseContext } from './analysis'

export interface CoachingFindingEvidenceResponse {
  readonly channels: readonly LocallyAuditedSignalChannel[]
  readonly message: string
}

export interface CoachingFindingLimitationResponse {
  readonly code: AnalysisLimitation['code']
  readonly message: string
}

export interface CoachingFindingResponse {
  readonly phenomenon: CoachingPhenomenon
  readonly lapNumber: number
  readonly comparedWithLapNumber: number
  readonly analysisRegionId: CoachingAnalysisRegionId
  readonly occurredAtLapElapsedMs: number
  readonly impactTimeLossMs: number
  readonly message: string
  readonly evidence: readonly CoachingFindingEvidenceResponse[]
  readonly metrics: readonly CoachingFindingMetric[]
  readonly limitations: readonly CoachingFindingLimitationResponse[]
}

export interface RankedCoachingPhenomenonResponse {
  readonly rank: number
  readonly priority: number
  readonly finding: CoachingFindingResponse
}

export interface CoachingDetectorFailureResponse {
  readonly code: 'COACHING_DETECTOR_FAILED'
  readonly phenomena: readonly CoachingPhenomenon[]
  readonly lapNumber: number
  readonly trackRegionId: TrackRegion['id']
  readonly errorName: string
}

export interface CoachingResponse extends AnalysisResponseContext {
  readonly rankedPhenomena: readonly RankedCoachingPhenomenonResponse[]
  readonly detectorFailures: readonly CoachingDetectorFailureResponse[]
}
