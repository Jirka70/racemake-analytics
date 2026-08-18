import type {
  LapCrossingLimitation,
  LapEligibilityReason,
  LapCrossingLimitationSeverity,
} from '../../analytics/lap-detect/lap-detect-types'
import type { AnalysisId } from './analysis'

export type LapEligibilityResponse = 'racing' | 'non-racing'

export interface LapEligibilityReasonResponse {
  readonly code: LapEligibilityReason['code']
  readonly message: string
  readonly observedValue?: number
  readonly requiredValue?: number
}

export interface LapEligibilityDecisionResponse {
  readonly eligible: boolean
  readonly reasons: readonly LapEligibilityReasonResponse[]
}

export interface LapAnalysisEligibilityResponse {
  readonly lapTime: LapEligibilityDecisionResponse
  readonly racing: LapEligibilityDecisionResponse
  readonly cornerDetection: LapEligibilityDecisionResponse
}

export interface LapCrossingLimitationResponse {
  readonly code: LapCrossingLimitation['code']
  readonly severity: LapCrossingLimitationSeverity
  readonly message: string
}

export interface LapSamplingGapLimitationResponse {
  readonly code: 'SAMPLING_GAP_WITHIN_LAP'
  readonly severity: 'warning'
  readonly message: string
  readonly gapStartTimestampMs: number
  readonly gapEndTimestampMs: number
  readonly gapDurationMs: number
  readonly fromPosition: number
  readonly toPosition: number
}

export type LapLimitationResponse =
  | LapCrossingLimitationResponse
  | LapSamplingGapLimitationResponse

export interface LapSamplingGapResponse
  extends LapSamplingGapLimitationResponse {
  readonly lapNumber: number
}

export interface LapConfidenceResponse {
  readonly boundary: number
  readonly lapTime: number
  readonly overall: number
}

export interface LapResponse {
  readonly lapNumber: number
  readonly lapTimeMs: number
  readonly eligibility: LapEligibilityResponse
  readonly analysisEligibility: LapAnalysisEligibilityResponse
  readonly confidence: LapConfidenceResponse
  readonly limitations: readonly LapLimitationResponse[]
}

export interface LapFragmentResponse {
  readonly startPosition: number
  readonly endPosition: number
}

export interface LapsResponse {
  readonly analysisId: AnalysisId
  readonly sessionId: string
  readonly laps: readonly LapResponse[]
  readonly fragments: readonly LapFragmentResponse[]
  readonly samplingGaps: readonly LapSamplingGapResponse[]
}
