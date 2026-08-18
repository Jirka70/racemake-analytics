import type {
    DetectedLap,
    DetectedLapEligibility,
    LapEligibilityConfig,
    LapEligibilityDecision,
} from './lap-detect-types'
import { evaluateLapTimeEligibility } from './evaluate-lap-time-eligibility'

export function evaluateLapEligibility(
    lap: DetectedLap,
    config: LapEligibilityConfig,
): DetectedLapEligibility {
    const timeEligible = evaluateLapTimeEligibility(lap, config.time)
    const realRacing = evaluateRealRacingEligibility(timeEligible)

    return { timeEligible, realRacing }
}

export function evaluateRealRacingEligibility(
    timeEligibility: LapEligibilityDecision,
): LapEligibilityDecision {
    // A racing lap is a defensible crossing-to-crossing time. Missing telemetry
    // remains a limitation on dependent analysis, not a judgement about the lap.
    return timeEligibility
}
