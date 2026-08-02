import type {
    CornerEligibilityConfig,
    DetectedLap,
    DetectedLapEligibility,
    DetectedLapGridCoverage,
    LapEligibilityConfig,
    LapEligibilityDecision,
    LapEligibilityReason,
    LapMovementSummary,
    RealRacingEligibilityConfig,
} from './lap-detect-types'
import { evaluateLapTimeEligibility } from './evaluate-lap-time-eligibility'

export function evaluateLapEligibility(
    lap: DetectedLap,
    coverage: DetectedLapGridCoverage,
    movement: LapMovementSummary,
    config: LapEligibilityConfig,
): DetectedLapEligibility {
    const timeEligible = evaluateLapTimeEligibility(lap, config.time)
    const realRacing = evaluateRealRacingEligibility(lap, coverage, movement, timeEligible, config.realRacing)
    const cornerEligible = evaluateCornerEligibility(coverage, realRacing, config.corner)

    return { timeEligible, realRacing, cornerEligible }
}

export function evaluateRealRacingEligibility(
    lap: DetectedLap,
    coverage: DetectedLapGridCoverage,
    movement: LapMovementSummary,
    timeEligibility: LapEligibilityDecision,
    config: RealRacingEligibilityConfig,
): LapEligibilityDecision {
    const reasons: LapEligibilityReason[] = []

    if (!timeEligibility.eligible) reasons.push({ code: 'TIME_ELIGIBILITY_REQUIRED' })

    if (!Number.isFinite(coverage.position.coverageRatio) || coverage.position.coverageRatio < config.minimumPositionCoverageRatio) {
        reasons.push({
            code: 'POSITION_COVERAGE_BELOW_MINIMUM',
            observedValue: coverage.position.coverageRatio,
            requiredMinimum: config.minimumPositionCoverageRatio,
        })
    }

    if (!Number.isFinite(coverage.position.longestUnsupportedNormalizedPositionSpan)
        || coverage.position.longestUnsupportedNormalizedPositionSpan > config.maximumUnsupportedNormalizedPositionSpan) {
        reasons.push({
            code: 'POSITION_HOLE_EXCEEDS_MAXIMUM',
            observedValue: coverage.position.longestUnsupportedNormalizedPositionSpan,
            allowedMaximum: config.maximumUnsupportedNormalizedPositionSpan,
        })
    }

    if (lap.limitations.some(({ code }) => code === 'SAMPLING_GAP_WITHIN_LAP')) {
        reasons.push({ code: 'SAMPLING_GAP_WITHIN_LAP' })
    }

    if (!Number.isFinite(movement.movementObservationTimeRatio)
        || movement.movementObservationTimeRatio < config.minimumMovementObservationTimeRatio) {
        reasons.push({
            code: 'MOVEMENT_OBSERVATION_BELOW_MINIMUM',
            observedValue: movement.movementObservationTimeRatio,
            requiredMinimum: config.minimumMovementObservationTimeRatio,
        })
    }

    if (!Number.isFinite(movement.movingObservedTimeRatio)
        || movement.movingObservedTimeRatio < config.minimumMovingObservedTimeRatio) {
        reasons.push({
            code: 'MOVING_TIME_BELOW_MINIMUM',
            observedValue: movement.movingObservedTimeRatio,
            requiredMinimum: config.minimumMovingObservedTimeRatio,
        })
    }

    if (!Number.isFinite(movement.longestStationaryIntervalLapTimeRatio)
        || movement.longestStationaryIntervalLapTimeRatio > config.maximumStationaryIntervalLapTimeRatio) {
        reasons.push({
            code: 'STATIONARY_INTERVAL_EXCEEDS_MAXIMUM',
            observedValue: movement.longestStationaryIntervalLapTimeRatio,
            allowedMaximum: config.maximumStationaryIntervalLapTimeRatio,
        })
    }

    return createEligibilityDecision(reasons)
}

export function evaluateCornerEligibility(
    coverage: DetectedLapGridCoverage,
    realRacingEligibility: LapEligibilityDecision,
    config: CornerEligibilityConfig,
): LapEligibilityDecision {
    const reasons: LapEligibilityReason[] = []

    if (!realRacingEligibility.eligible) reasons.push({ code: 'REAL_RACING_ELIGIBILITY_REQUIRED' })

    if (!Number.isFinite(coverage.steering.coverageRatio) || coverage.steering.coverageRatio < config.minimumSteeringCoverageRatio) {
        reasons.push({
            code: 'STEERING_COVERAGE_BELOW_MINIMUM',
            observedValue: coverage.steering.coverageRatio,
            requiredMinimum: config.minimumSteeringCoverageRatio,
        })
    }

    if (!Number.isFinite(coverage.steering.longestUnsupportedNormalizedPositionSpan)
        || coverage.steering.longestUnsupportedNormalizedPositionSpan > config.maximumUnsupportedSteeringPositionSpan) {
        reasons.push({
            code: 'STEERING_HOLE_EXCEEDS_MAXIMUM',
            observedValue: coverage.steering.longestUnsupportedNormalizedPositionSpan,
            allowedMaximum: config.maximumUnsupportedSteeringPositionSpan,
        })
    }

    return createEligibilityDecision(reasons)
}

function createEligibilityDecision(reasons: readonly LapEligibilityReason[]): LapEligibilityDecision {
    return { eligible: reasons.length === 0, reasons }
}
