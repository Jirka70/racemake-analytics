import type {
  LapCounterEvidence,
  LapCrossingLimitation,
} from '../../analytics/lap-detect/lap-detect-types'
import type { AnalysisId } from './analysis'

export type LapTelemetryReviewUsage = 'full' | 'recorded-sections-only'
export type LapTimeComparisonUsage = 'verified-only' | 'excluded'
export type LapRankingUsage = 'ranked' | 'excluded'
export type LapCoachingUsage =
  | 'full'
  | 'supported-regions-only'
  | 'none'

/** Final backend policy consumed by the UI. */
export interface LapUsageResponse {
  readonly telemetryReview: LapTelemetryReviewUsage
  readonly lapTimeComparison: LapTimeComparisonUsage
  readonly lapRanking: LapRankingUsage
  readonly coaching: LapCoachingUsage
}

export type LapTimingResponse =
  | {
      readonly status: 'verified'
      readonly lapTimeMs: number
    }
  | {
      readonly status: 'unverified'
      readonly lapTimeMs: number
    }

export type LapCrossingProblemCode = LapCrossingLimitation['code']

export interface LapBoundaryEvidenceResponse {
  readonly fromPosition: number
  readonly toPosition: number
  readonly transitionDurationMs: number
  readonly lapCounterEvidence: LapCounterEvidence['status']
  readonly usablePositionRateSamplesBefore: number | null
  readonly usablePositionRateSamplesAfter: number | null
  readonly reasonCodes: readonly LapCrossingProblemCode[]
}

export interface LapBoundaryLimitationResponse {
  readonly code:
    | 'START_BOUNDARY_UNCERTAIN'
    | 'FINISH_BOUNDARY_UNCERTAIN'
  readonly severity: 'warning'
  readonly message: string
  readonly boundary: 'start' | 'finish'
  readonly crossingBoundaryConfidence: number
  readonly lapBoundaryConfidence: number
  readonly requiredLapBoundaryConfidence: number
  readonly evidence: LapBoundaryEvidenceResponse
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

export interface LapTimeLimitationResponse {
  readonly code: 'LAP_TIME_UNCERTAIN' | 'LAP_TIME_UNAVAILABLE'
  readonly severity: 'warning' | 'error'
  readonly message: string
  readonly observedLapTimeConfidence: number
  readonly requiredLapTimeConfidence: number
}

export type LapLimitationResponse =
  | LapBoundaryLimitationResponse
  | LapSamplingGapLimitationResponse
  | LapTimeLimitationResponse

export type LapQualityResponse =
  | {
      readonly status: 'verified'
      readonly label: 'Verified'
      readonly summary: null
      readonly limitations: readonly []
    }
  | {
      readonly status: 'limited'
      readonly label: 'Limited data'
      readonly summary: string
      readonly limitations: readonly [
        LapLimitationResponse,
        ...LapLimitationResponse[],
      ]
    }

export interface LapSamplingGapResponse
  extends LapSamplingGapLimitationResponse {
  readonly lapNumber: number
}

export interface LapCoverageResponse {
  readonly capturedRatio: number
  readonly startPosition: 0
  readonly endPosition: 1
}

export interface LapCrossingConfidenceResponse {
  readonly boundary: number
  readonly timestamp: number
  readonly overall: number
}

export interface LapConfidenceResponse {
  readonly startCrossing: LapCrossingConfidenceResponse
  readonly finishCrossing: LapCrossingConfidenceResponse
  readonly lap: {
    readonly boundary: number
    readonly lapTime: number
    readonly overall: number
  }
}

export interface LapResponse {
  readonly lapNumber: number
  readonly timing: LapTimingResponse
  readonly quality: LapQualityResponse
  readonly usage: LapUsageResponse
  readonly coverage: LapCoverageResponse
  readonly confidence: LapConfidenceResponse
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
  /** Compatibility projection for chart overlays; the canonical copy is in lap.quality.limitations. */
  readonly samplingGaps: readonly LapSamplingGapResponse[]
}
