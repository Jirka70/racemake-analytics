import type { UsableTimeline } from '../frame-audit-types'
import type { DetectedLap, DetectedLapConfidence, DetectedLapLimitation, LapCrossing } from './lap-detect-types'

export function createDetectedLaps(timeline: UsableTimeline, crossings: readonly LapCrossing[]): readonly DetectedLap[] {
    const laps: DetectedLap[] = []

    for (let crossingIndex = 1; crossingIndex < crossings.length; crossingIndex++) {
        const startCrossing = crossings[crossingIndex - 1]
        const endCrossing = crossings[crossingIndex]

        if (hasTimelineBreakBetween(timeline, startCrossing, endCrossing)) continue

        laps.push({
            lapNumber: laps.length + 1,
            startCrossing,
            endCrossing,
            lapTimeMs: endCrossing.timestampMs - startCrossing.timestampMs,
            confidence: createDetectedLapConfidence(startCrossing, endCrossing),
            limitations: findDetectedLapLimitations(timeline, startCrossing, endCrossing),
        })
    }

    return laps
}

function findDetectedLapLimitations(timeline: UsableTimeline, startCrossing: LapCrossing, endCrossing: LapCrossing): DetectedLapLimitation[] {
    const limitations: DetectedLapLimitation[] = []

    for (let transitionIndex = startCrossing.transitionIndex + 1; transitionIndex < endCrossing.transitionIndex; transitionIndex++) {
        const transition = timeline.transitions[transitionIndex]
        if (transition?.timeContinuity !== 'gap') continue

        limitations.push({
            code: 'SAMPLING_GAP_WITHIN_LAP',
            severity: 'warning',
            message: 'A sampling gap occurs within the detected lap',
            gapStartTimestampMs: transition.previous.timestampMs,
            gapEndTimestampMs: transition.current.timestampMs,
            gapDurationMs: transition.timestampDeltaMs,
            fromPosition: transition.previous.normalizedTrackPosition,
            toPosition: transition.current.normalizedTrackPosition,
        })
    }

    return limitations
}

function createDetectedLapConfidence(startCrossing: LapCrossing, endCrossing: LapCrossing): DetectedLapConfidence {
    const boundaryConfidence = calculateGeometricMean(startCrossing.confidence.boundaryConfidence, endCrossing.confidence.boundaryConfidence)
    const lapTimeConfidence = calculateGeometricMean(startCrossing.confidence.timestampConfidence, endCrossing.confidence.timestampConfidence)

    return {
        boundaryConfidence,
        lapTimeConfidence,
        overallConfidence: calculateGeometricMean(boundaryConfidence, lapTimeConfidence),
    }
}

function calculateGeometricMean(first: number, second: number): number {
    return Math.sqrt(first * second)
}

function hasTimelineBreakBetween(timeline: UsableTimeline, startCrossing: LapCrossing, endCrossing: LapCrossing): boolean {
    for (let transitionIndex = startCrossing.transitionIndex + 1; transitionIndex < endCrossing.transitionIndex; transitionIndex++) {
        if (timeline.transitions[transitionIndex]?.timeContinuity === 'break') return true
    }

    return false
}
