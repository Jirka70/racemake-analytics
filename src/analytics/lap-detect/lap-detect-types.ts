import type { AuditedTimelineTransition } from '../frame-audit-types'

export interface LapDetectionConfig {
    readonly calibration: {
        readonly minimumSamples: number
        readonly positionRateMadMultiplier: number
        readonly positionRateIqrMultiplier: number
        readonly positionStepMadMultiplier: number
        readonly positionStepIqrMultiplier: number
    }
    readonly crossing: {
        readonly lapCounterSearchRadiusFrames: number
        readonly confidence: LapCrossingConfidenceConfig
    }
    readonly eligibility: LapEligibilityConfig
}

export interface LapEligibilityConfig {
    readonly time: LapTimeEligibilityConfig
}

export interface LapTimeEligibilityConfig {
    readonly minimumBoundaryConfidence: number
    readonly minimumLapTimeConfidence: number
}

export interface LapCrossingConfidenceConfig {
    readonly interpolationSpanConfidenceAtSupportedLimit: number
    readonly globalRateConfidenceAtPlausibleLimit: number
    readonly temporalConfidenceAtMedianInterval: number
    readonly localRateReferenceRelativeDifference: number
    readonly localRateConfidenceAtReferenceDifference: number
    readonly localRateWindowDurationMedianMultiplier: number
    readonly localRateFullSupportSamplesPerSide: number
    readonly lapCounterAgreementScores: {
        readonly exact: number
        readonly nearby: number
        readonly missing: number
        readonly mismatch: number
    }
    readonly aggregationWeights: LapCrossingConfidenceWeights
}

export interface LapCrossingConfidenceWeights {
    readonly boundary: {
        readonly localRateConsistency: number
        readonly localRateSupport: number
        readonly globalRatePlausibility: number
        readonly lapCounterAgreement: number
    }
    readonly timestamp: {
        readonly interpolationSpanSupport: number
        readonly temporalResolution: number
        readonly localRateConsistency: number
    }
}

export interface PositionCalibration {
    readonly medianPositionStep: number
    readonly maximumSupportedPositionSpan: number
    readonly medianPositionRatePerSecond: number
    readonly globalPositionRateLimitPerSecond: number
}

export interface LinearLapGrid {
    readonly cellCount: number
    readonly positionStep: number
    readonly positions: readonly number[] // Includes both 0 and 1.
    readonly medianUsablePositionSampleCountPerLap: number
}

export interface LapGridCoverage {
    readonly supportMask: readonly boolean[] // Has exactly one value for every position in LinearLapGrid.positions.
    readonly supportedGridPointCount: number
    readonly coverageRatio: number
    readonly longestUnsupportedNormalizedPositionSpan: number // Measured on the normalized track-position axis [0, 1].
}

export interface DetectedLapGridCoverage {
    readonly position: LapGridCoverage
    readonly elapsedTime: LapGridCoverage
    readonly steering: LapGridCoverage
}

export interface DetectedLapGridCoverageEntry {
    readonly lapNumber: number
    readonly coverage: DetectedLapGridCoverage
}

export interface LapEligibilityDecision {
    readonly eligible: boolean
    readonly reasons: readonly LapEligibilityReason[]
}

export interface DetectedLapEligibility {
    readonly timeEligible: LapEligibilityDecision
    readonly realRacing: LapEligibilityDecision
}

export interface DetectedLapEligibilityResult {
    readonly lapNumber: number
    readonly eligibility: DetectedLapEligibility
}

export interface MinimumEligibilityRequirementNotMet {
    readonly code:
        | 'BOUNDARY_CONFIDENCE_BELOW_MINIMUM'
        | 'LAP_TIME_CONFIDENCE_BELOW_MINIMUM'
        | 'POSITION_COVERAGE_BELOW_MINIMUM'
        | 'MOVEMENT_OBSERVATION_BELOW_MINIMUM'
        | 'MOVING_TIME_BELOW_MINIMUM'
        | 'STEERING_COVERAGE_BELOW_MINIMUM'
    readonly observedValue: number
    readonly requiredMinimum: number
}

export interface MaximumEligibilityRequirementExceeded {
    readonly code:
        | 'POSITION_HOLE_EXCEEDS_MAXIMUM'
        | 'STATIONARY_INTERVAL_EXCEEDS_MAXIMUM'
        | 'STEERING_HOLE_EXCEEDS_MAXIMUM'
    readonly observedValue: number
    readonly allowedMaximum: number
}

export interface NonPositiveLapTimeEligibilityReason {
    readonly code: 'NON_POSITIVE_LAP_TIME'
    readonly lapTimeMs: number
}

/**
 * Legacy reason variants remain in the public type for HTTP compatibility.
 * The current racing-lap classifier emits only lap-time eligibility reasons.
 */
export interface EligibilityPrerequisiteNotMet {
    readonly code:
        | 'TIME_ELIGIBILITY_REQUIRED'
        | 'REAL_RACING_ELIGIBILITY_REQUIRED'
}

export interface SamplingGapEligibilityReason {
    readonly code: 'SAMPLING_GAP_WITHIN_LAP'
}

export type LapEligibilityReason =
    | MinimumEligibilityRequirementNotMet
    | MaximumEligibilityRequirementExceeded
    | NonPositiveLapTimeEligibilityReason
    | EligibilityPrerequisiteNotMet
    | SamplingGapEligibilityReason

export interface LinearizedLap {
    readonly lapNumber: number

    /**
     * Milliseconds elapsed since the lap start.
     * Has exactly one value for every position in LinearLapGrid.positions; null means the position could not be interpolated safely.
     */
    readonly elapsedTimestampsMs: readonly (number | null)[]

    /** Has exactly one value for every position in LinearLapGrid.positions; null means steering could not be interpolated safely. */
    readonly steeringDegrees: readonly (number | null)[]
    readonly coverage: DetectedLapGridCoverage
    readonly issues: readonly LapLinearizationIssue[]
}

export type LapLinearizationIssueCode =
    | 'INTERPOLATED'
    | 'NO_BRACKETING_TRANSITION'
    | 'POSITION_TRANSITION_UNUSABLE'
    | 'POSITION_SPAN_EXCEEDED'
    | 'POSITION_RATE_EXCEEDED'
    | 'STEERING_TRANSITION_UNUSABLE'

export interface LapLinearizationIssue {
    readonly code: LapLinearizationIssueCode
    readonly gridIndex: number
    readonly normalizedTrackPosition: number
}

export interface LapCrossingCandidate {
    readonly transitionIndex: number
    readonly transition: AuditedTimelineTransition
    readonly lapCounterEvidence: LapCounterEvidence
}

export interface LapCrossingPositionInterpolation {
    readonly fromPosition: number
    readonly toPosition: number
    readonly unwrappedToPosition: number
    readonly positionSpan: number
    readonly maximumSupportedPositionSpan: number // Largest span supported by the dataset's typical position sampling.
    readonly maximumPlausiblePositionSpan: number // Largest span plausible for this transition under the global position-rate limit.
    readonly crossingFraction: number // e.g. 0.5 -> crossing happened exactly in the middle of transition
}

export interface LapCrossingConfidenceComponents {
    readonly interpolationSpanSupport: number // Measures timestamp precision from position span; exact endpoint crossings score 1 and wider interpolated spans decay exponentially.
    readonly temporalResolution: number // Measures timestamp precision from transition duration; exact endpoint crossings score 1 and longer sampling intervals decay exponentially.
    readonly localRateConsistency: number // Measures how closely position movement across the crossing agrees with valid movement immediately before and after it.
    readonly localRateSupport: number // Measures whether enough valid continuous position-rate samples exist on both sides of the crossing to support the local comparison.
    readonly globalRatePlausibility: number // Measures whether the observed position span is plausible for this transition duration under the dataset-wide position-rate limit.
    readonly lapCounterAgreement: number // Represents discrete supporting evidence from an exact, nearby, missing, or mismatched recorded lap-counter update.
}

export interface LapCrossingConfidence {
    readonly components: LapCrossingConfidenceComponents
    readonly boundaryConfidence: number // Confidence that the detected position wrap represents a real lap boundary.
    readonly timestampConfidence: number // Confidence in the interpolated crossing timestamp, assuming the boundary is real.
    readonly overallConfidence: number // Geometric mean combining boundary existence with crossing timestamp precision.
}

export type LapCrossingLimitationSeverity = 'warning' | 'error'

export interface LapCrossingLimitationBase {
    readonly severity: LapCrossingLimitationSeverity
    readonly message: string
}

export interface PositionInterpolationSpanExceededLimitation extends LapCrossingLimitationBase {
    readonly code: 'POSITION_INTERPOLATION_SPAN_EXCEEDED'
    readonly severity: 'warning'
    readonly fromPosition: number
    readonly toPosition: number
    readonly observedPositionSpan: number
    readonly maximumSupportedPositionSpan: number
}

export interface PositionRateLimitExceededLimitation extends LapCrossingLimitationBase {
    readonly code: 'POSITION_RATE_LIMIT_EXCEEDED'
    readonly severity: 'warning'
    readonly fromPosition: number
    readonly toPosition: number
    readonly transitionDurationMs: number
    readonly observedPositionRatePerSecond: number
    readonly globalPositionRateLimitPerSecond: number
}

export interface LapCounterConfirmationMissingLimitation extends LapCrossingLimitationBase {
    readonly code: 'LAP_COUNTER_CONFIRMATION_MISSING'
    readonly severity: 'warning'
}

export interface LapCounterMismatchLimitation extends LapCrossingLimitationBase {
    readonly code: 'LAP_COUNTER_MISMATCH'
    readonly severity: 'warning'
}

export interface LocalPositionRateContextUnavailableLimitation extends LapCrossingLimitationBase {
    readonly code: 'LOCAL_POSITION_RATE_CONTEXT_UNAVAILABLE'
    readonly severity: 'warning'
    readonly usablePositionRateSamplesBefore: number
    readonly usablePositionRateSamplesAfter: number
}

export type LapCrossingLimitation =
    | PositionInterpolationSpanExceededLimitation
    | PositionRateLimitExceededLimitation
    | LapCounterConfirmationMissingLimitation
    | LapCounterMismatchLimitation
    | LocalPositionRateContextUnavailableLimitation

export interface LapCrossing {
    readonly transitionIndex: number
    readonly transition: AuditedTimelineTransition
    readonly timestampMs: number
    readonly lapCounterEvidence: LapCounterEvidence
    readonly positionInterpolation: LapCrossingPositionInterpolation
    readonly confidence: LapCrossingConfidence
    readonly limitations: readonly LapCrossingLimitation[]
}

export interface DetectedLap {
    readonly lapNumber: number // One-based sequential number assigned to detected complete laps.
    readonly startCrossing: LapCrossing
    readonly endCrossing: LapCrossing
    readonly lapTimeMs: number
    readonly confidence: DetectedLapConfidence
    readonly limitations: readonly DetectedLapLimitation[]
}

export interface DetectedLapFragment {
    readonly startPosition: number
    readonly endPosition: number
    /** Indexes into the usable timeline. Kept internal so fragment telemetry can
     * be inspected without widening the intentionally small `/laps` contract. */
    readonly startFrameIndex: number
    readonly endFrameIndex: number
}

export interface DetectedLapConfidence {
    readonly boundaryConfidence: number // Confidence that both crossings represent real lap boundaries.
    readonly lapTimeConfidence: number // Confidence in lapTimeMs based on the timestamp precision of both crossings.
    readonly overallConfidence: number // Geometric mean of boundary existence and lap-time precision.
}

export interface SamplingGapWithinLapLimitation {
    readonly code: 'SAMPLING_GAP_WITHIN_LAP'
    readonly severity: 'warning'
    readonly message: string
    readonly gapStartTimestampMs: number
    readonly gapEndTimestampMs: number
    readonly gapDurationMs: number
    readonly fromPosition: number // Last observed normalized track position before the gap.
    readonly toPosition: number // First observed normalized track position after the gap.
    /** Internal conservative veto: the missing interval may contain an unobserved start/finish crossing. */
    readonly mayContainLapBoundary: boolean
}

export type DetectedLapLimitation = SamplingGapWithinLapLimitation

/**
 * `exact` means the candidate transition increments the counter by one.
 * `nearby` means the candidate transition has no increment and exactly one surrounding continuous transition increments it by one.
 * `missing` means every inspected transition keeps the same counter value.
 * `mismatch` means an inspected transition has another non-zero change or the window contains multiple increments.
 */
export interface LapCounterEvidence {
    readonly status: 'exact' | 'nearby' | 'missing' | 'mismatch'
    readonly frameOffset: number | null
    readonly previousLapNumber: number
    readonly observedLapNumber: number | null
}

export interface LapDetectionResult {
    readonly positionCalibration: PositionCalibration | null
    readonly linearGrid: LinearLapGrid | null
    readonly lapCrossings: readonly LapCrossing[]
    readonly laps: readonly DetectedLap[]
    readonly lapFragments: readonly DetectedLapFragment[]
    readonly linearizedLaps: readonly LinearizedLap[]
    readonly lapGridCoverages: readonly DetectedLapGridCoverageEntry[]
    readonly lapEligibilityResults: readonly DetectedLapEligibilityResult[]
}
