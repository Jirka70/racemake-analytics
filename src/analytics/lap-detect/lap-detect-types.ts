import type { AuditedTimelineTransition } from '../frame-audit-types'

export interface LapDetectionConfig {
    readonly calibration: {
        readonly minimumSamples: number
        readonly positionRateMadMultiplier: number
        readonly positionRateIqrMultiplier: number
    }
    readonly interpolation: {
        readonly positionGapMedianMultiplier: number
        readonly maximumAbsolutePositionSpan: number
    }
    readonly crossing: {
        readonly lapCounterSearchRadiusFrames: number
    }
}

export interface PositionCalibration {
    readonly medianPositionStep: number
    readonly maximumInterpolationSpan: number
    readonly medianPositionRatePerSecond: number
    readonly globalPositionRateLimitPerSecond: number
}

export interface LapCrossingCandidate {
    readonly transitionIndex: number
    readonly transition: AuditedTimelineTransition
    readonly lapCounterEvidence: LapCounterEvidence
}

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
    readonly lapCrossingCandidates: readonly LapCrossingCandidate[]
}
