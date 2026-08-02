import type { AuditedFrame, AuditedTimelineTransition, UsableTimeline } from '../frame-audit-types'
import type { DetectedLap, LapMovementSummary, RealRacingEligibilityConfig } from './lap-detect-types'
import { canUseChannelTransition } from './util/usable-channels'

export function summarizeLapMovement(
    timeline: UsableTimeline,
    lap: DetectedLap,
    auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>,
    config: RealRacingEligibilityConfig,
): LapMovementSummary {
    let observedDurationMs = 0
    let movingDurationMs = 0
    let currentStationaryIntervalMs = 0
    let longestStationaryIntervalMs = 0

    for (let transitionIndex = lap.startCrossing.transitionIndex; transitionIndex <= lap.endCrossing.transitionIndex; transitionIndex++) {
        const transition = timeline.transitions[transitionIndex]
        if (transition === undefined) continue

        const durationWithinLapMs = calculateDurationWithinLap(transition, transitionIndex, lap)
        if (durationWithinLapMs <= 0) continue

        if (!canUseChannelTransition(transition, 'speedKmh', auditedFrameBySourceIndex)) {
            currentStationaryIntervalMs = 0
            continue
        }

        observedDurationMs += durationWithinLapMs

        // The endpoint average is a deterministic approximation of speed over this complete or partial transition.
        const averageSpeedKmh = (transition.previous.speedKmh + transition.current.speedKmh) / 2
        if (averageSpeedKmh > config.stationarySpeedUpperBoundKmh) {
            movingDurationMs += durationWithinLapMs
            currentStationaryIntervalMs = 0
            continue
        }

        currentStationaryIntervalMs += durationWithinLapMs
        longestStationaryIntervalMs = Math.max(longestStationaryIntervalMs, currentStationaryIntervalMs)
    }

    return {
        observedDurationMs,
        movementObservationTimeRatio: calculateRatio(observedDurationMs, lap.lapTimeMs),
        movingDurationMs,
        movingObservedTimeRatio: calculateRatio(movingDurationMs, observedDurationMs),
        longestStationaryIntervalMs,
        longestStationaryIntervalLapTimeRatio: calculateRatio(longestStationaryIntervalMs, lap.lapTimeMs),
    }
}

function calculateDurationWithinLap(transition: AuditedTimelineTransition, transitionIndex: number, lap: DetectedLap): number {
    const intervalStartTimestampMs = transitionIndex === lap.startCrossing.transitionIndex
        ? lap.startCrossing.timestampMs
        : transition.previous.timestampMs
    const intervalEndTimestampMs = transitionIndex === lap.endCrossing.transitionIndex
        ? lap.endCrossing.timestampMs
        : transition.current.timestampMs

    return Math.max(0, intervalEndTimestampMs - intervalStartTimestampMs)
}

function calculateRatio(numerator: number, denominator: number): number {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0
    return Math.min(1, Math.max(0, numerator / denominator))
}
