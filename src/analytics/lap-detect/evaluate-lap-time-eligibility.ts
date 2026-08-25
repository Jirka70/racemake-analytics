import type { DetectedLap, LapEligibilityDecision, LapEligibilityReason, LapTimeEligibilityConfig } from './lap-detect-types'

export function evaluateLapTimeEligibility(lap: DetectedLap, config: LapTimeEligibilityConfig): LapEligibilityDecision {
    const reasons: LapEligibilityReason[] = []

    if (!Number.isFinite(lap.lapTimeMs) || lap.lapTimeMs <= 0) {
        reasons.push({ code: 'NON_POSITIVE_LAP_TIME', lapTimeMs: lap.lapTimeMs })
    }

    if (!Number.isFinite(lap.confidence.boundaryConfidence) || lap.confidence.boundaryConfidence < config.minimumBoundaryConfidence) {
        reasons.push({
            code: 'BOUNDARY_CONFIDENCE_BELOW_MINIMUM',
            observedValue: lap.confidence.boundaryConfidence,
            requiredMinimum: config.minimumBoundaryConfidence,
        })
    }

    if (!Number.isFinite(lap.confidence.lapTimeConfidence) || lap.confidence.lapTimeConfidence < config.minimumLapTimeConfidence) {
        reasons.push({
            code: 'LAP_TIME_CONFIDENCE_BELOW_MINIMUM',
            observedValue: lap.confidence.lapTimeConfidence,
            requiredMinimum: config.minimumLapTimeConfidence,
        })
    }

    if (lap.limitations.some(
        (limitation) => limitation.code === 'SAMPLING_GAP_WITHIN_LAP'
            && limitation.mayContainLapBoundary,
    )) {
        reasons.push({ code: 'SAMPLING_GAP_WITHIN_LAP' })
    }

    return { eligible: reasons.length === 0, reasons }
}
