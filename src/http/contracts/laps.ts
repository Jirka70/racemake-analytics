import type {
  LapCrossingLimitation,
  LapEligibilityReason,
  LapCrossingLimitationSeverity,
  DetectedLapLimitation,
} from '../../analytics/lap-detect/lap-detect-types'
import type { AnalysisResponseContext } from './analysis'

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

export interface LapLimitationResponse {
  readonly code:
    | LapCrossingLimitation['code']
    | DetectedLapLimitation['code']
  readonly severity: LapCrossingLimitationSeverity
  readonly message: string
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

export interface LapsResponse extends AnalysisResponseContext {
  readonly laps: readonly LapResponse[]
}
