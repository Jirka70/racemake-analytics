import type { AuditedFrame, AuditedTimelineTransition } from '../frame-audit-types'

export interface LapDetectionConfig {
    readonly calibration: {
        readonly minimumSamples: number
        readonly positionRateMadMultiplier: number
        readonly positionRateIqrMultiplier: number
    }
    readonly crossing: {
        readonly localWindowDurationMultiplier: number
        readonly minimumLocalTransitions: number
        readonly minimumConfidence: number
        readonly counterUpdateToleranceFrames: number
        readonly confidenceWeights: LapCrossingConfidenceWeights
    }
    readonly interpolation: {
        readonly positionGapMedianMultiplier: number
        readonly maximumAbsolutePositionSpan: number
    }
    readonly linearGrid: {
        readonly minimumCellCount: number
        readonly maximumCellCount: number
        readonly minimumUsablePositionSampleCount: number
        readonly minimumRelativePositionSampleRatio: number
    }
    readonly eligibility: {
        readonly minimumRacingPositionCoverage: number
        readonly maximumRacingUnsupportedPositionSpan: number
        readonly minimumCornerPositionCoverage: number
        readonly minimumCornerSteeringCoverage: number
        readonly maximumCornerUnsupportedSpan: number
        readonly minimumComparisonCoverage: number
        readonly maximumComparisonUnsupportedSpan: number
    }
    readonly motion: {
        readonly stationarySpeedKmh: number
        readonly minimumSpeedEvidenceFraction: number
        readonly minimumMovingFraction: number
        readonly maximumStationaryFraction: number
    }
}

export interface PositionCalibration {
    readonly medianPositionStep: number
    readonly maximumInterpolationSpan: number
    readonly medianPositionRatePerSecond: number
    readonly globalPositionRateLimitPerSecond: number
}

export interface LapCandidate {
    readonly sequenceNumber: number
    readonly startCrossing: InternalLapCrossing
    readonly finishCrossing: InternalLapCrossing
    readonly frames: readonly AuditedFrame[]
    readonly transitions: readonly AuditedTimelineTransition[]
}

export type LapLimitationCode =
    | 'INSUFFICIENT_POSITION_BASELINE'
    | 'INSUFFICIENT_LAP_CROSSINGS'
    | 'LAP_COUNTER_MISMATCH'
    | 'LAP_COUNTER_MISSING_CHANGE'
    | 'LAP_COUNTER_INCONSISTENT'
    | 'TIME_ORDER_BREAK'
    | 'SAMPLING_GAP'
    | 'UNEXPECTED_POSITION_WRAP'
    | 'INSUFFICIENT_SAMPLE_DENSITY'
    | 'INSUFFICIENT_POSITION_COVERAGE'
    | 'INSUFFICIENT_STEERING_COVERAGE'
    | 'UNSUPPORTED_POSITION_SPAN'
    | 'UNSUPPORTED_STEERING_SPAN'
    | 'INSUFFICIENT_SPEED_EVIDENCE'
    | 'STATIONARY_LAP'

export type LapLimitationImpact =
    | 'timing'
    | 'corner-detection'
    | 'time-loss-comparison'
    | 'racing-lap-classification'
    | 'all-analysis'

export interface LapLimitation {
    readonly code: LapLimitationCode
    readonly severity: 'warning' | 'error'
    readonly impact: LapLimitationImpact
    readonly message: string
}

export interface LapCrossingEvidence {
    readonly previousPosition: number
    readonly nextPosition: number
    readonly circularPositionDelta: number
    readonly positionRatePerSecond: number
    readonly localMedianPositionRatePerSecond: number
    readonly localPositionRateLimitPerSecond: number
    readonly localTransitionsBefore: number
    readonly localTransitionsAfter: number
}

export interface LapCrossingConfidenceWeights {
    readonly boundaryLocalRateConsistency: number
    readonly boundaryCounterAgreement: number
    readonly timestampTemporalResolution: number
    readonly timestampPositionResolution: number
    readonly timestampLocalRateConsistency: number
}

export interface LapCounterEvidence {
    readonly agreement: 'exact' | 'nearby' | 'missing' | 'mismatch'
    readonly score: number
    readonly updateOffsetFrames: number | null
    readonly observedDelta: number
}

export type CrossingTimestampResolution =
    | {
        readonly method: 'exact-previous-frame'
        readonly timestampMs: number
        readonly sourceIndex: number
    }
    | {
        readonly method: 'exact-current-frame'
        readonly timestampMs: number
        readonly sourceIndex: number
    }
    | {
        readonly method: 'linear-interpolation'
        readonly timestampMs: number
        readonly interpolationRatio: number
        readonly previousSourceIndex: number
        readonly nextSourceIndex: number
        readonly bracketDurationMs: number
    }

export interface LapCrossingConfidence {
    readonly overall: number
    readonly boundary: number
    readonly timestamp: number
    readonly localRateConsistency: number
    readonly temporalResolution: number
    readonly positionResolution: number
    readonly counterAgreement: number
}

export interface LapCrossing {
    readonly timestampMs: number
    readonly timestampResolution: CrossingTimestampResolution
    readonly bracketDurationMs: number
    readonly previousSourceIndex: number
    readonly nextSourceIndex: number
    readonly hasLapCounterIncreasedByOne: boolean
    readonly counterEvidence: LapCounterEvidence
    readonly confidence: LapCrossingConfidence
    readonly evidence: LapCrossingEvidence
    readonly limitations: readonly LapLimitation[]
}

export interface InternalLapCrossing {
    readonly transitionIndex: number
    readonly previousFrameIndex: number
    readonly currentFrameIndex: number
    readonly crossing: LapCrossing
}

export interface LapFragment {
    readonly kind: 'whole-timeline' | 'opening' | 'closing'
    readonly startSourceIndex: number
    readonly endSourceIndex: number
    readonly frameCount: number
}

export interface LinearGrid {
    readonly cellCount: number
    readonly normalizedPositionCellWidth: number
    readonly referenceUsablePositionSampleCountPerLap: number
    readonly requiredUsablePositionSampleCountPerLap: number
}

export interface CoverageResult {
    readonly coverage: number
    readonly maximumUnsupportedSpan: number
    readonly supportedCellMask: readonly boolean[]
}

export interface RecordedLapMode {
    readonly value: number | null
    readonly supportFraction: number
}

export interface MotionResult {
    readonly observedDurationMs: number
    readonly movingFraction: number
    readonly longestStationaryDurationMs: number
}

export interface LapConfidence {
    readonly overall: number
    readonly timing: number
    readonly cornerModel: number
    readonly startCrossing: number
    readonly finishCrossing: number
    readonly positionCoverage: number
    readonly steeringCoverage: number
    readonly positionContinuity: number
    readonly steeringContinuity: number
    readonly sampleDensity: number
    readonly motionEvidence: number
    readonly counterAgreement: number
    readonly counterConsistency: number
    readonly limitations: readonly LapLimitation[]
}

export interface DetectedLap {
    readonly id: string
    readonly sequenceNumber: number
    readonly recordedLapNumber: number | null
    readonly startCrossing: LapCrossing
    readonly finishCrossing: LapCrossing
    readonly startTimestampMs: number
    readonly finishTimestampMs: number
    readonly lapTimeMs: number
    readonly startSourceIndex: number
    readonly endSourceIndex: number
    readonly frameCount: number
    readonly positionCoverage: number
    readonly steeringCoverage: number
    readonly maximumUnsupportedPositionSpan: number
    readonly maximumUnsupportedSteeringSpan: number
    readonly usablePositionSampleCount: number
    readonly requiredPositionSampleCount: number
    readonly samplingGapCount: number
    readonly largestSamplingGapMs: number
    readonly speedEvidenceFraction: number
    readonly movingFraction: number
    readonly longestStationaryDurationMs: number
    readonly timingEligible: boolean
    readonly realRacingLap: boolean
    readonly cornerModelEligible: boolean
    readonly positionComparisonEligible: boolean
    readonly confidence: LapConfidence
}

export interface LapDetectionDiagnostics {
    readonly gridSize: number
    readonly gridPositionStep: number
    readonly medianPositionStep: number | null
    readonly maximumInterpolationSpan: number | null
    readonly medianPositionRatePerSecond: number | null
    readonly globalPositionRateLimitPerSecond: number | null
    readonly medianUsablePositionSamplesPerLap: number | null
    readonly requiredPositionSamplesPerLap: number | null
    readonly limitations: readonly LapLimitation[]
}

export interface LapDetectionResult {
    readonly crossings: readonly LapCrossing[]
    readonly laps: readonly DetectedLap[]
    readonly includedRacingLaps: readonly DetectedLap[]
    readonly excludedLaps: readonly DetectedLap[]
    readonly fragments: readonly LapFragment[]
    readonly diagnostics: LapDetectionDiagnostics
}
