import type { UsableTimeline } from '../frame-audit-types'
import type { LapCrossing, PositionCalibration } from './lap-detect-types'

interface NonbreakableLapCrossingSequence {
    readonly crossings: readonly LapCrossing[]
}

export function selectValidLapCrossings(timeline: UsableTimeline, crossings: readonly LapCrossing[], calibration: PositionCalibration): readonly LapCrossing[] {
    const timelineOrderedCrossings = [...crossings].sort((first, second) => first.transitionIndex - second.transitionIndex)
    const sequences = splitLapCrossingsAtTimelineBreaks(timeline, timelineOrderedCrossings)

    return sequences.flatMap((sequence) => {
        const timestampOrderedSequence = {
            crossings: [...sequence.crossings].sort((first, second) =>
                first.timestampMs - second.timestampMs || first.transitionIndex - second.transitionIndex
            ),
        }

        return selectValidCrossingsFromSequence(timestampOrderedSequence, calibration).crossings
    })
}

function selectValidCrossingsFromSequence(sequence: NonbreakableLapCrossingSequence, calibration: PositionCalibration): NonbreakableLapCrossingSequence {
    const selectedCrossings: LapCrossing[] = []

    for (const crossing of sequence.crossings) {
        const previousCrossing = selectedCrossings[selectedCrossings.length - 1]

        if (!previousCrossing || canRepresentDistinctLapBoundaries(previousCrossing, crossing, calibration)) {
            selectedCrossings.push(crossing)
            continue
        }

        selectedCrossings[selectedCrossings.length - 1] = selectPreferredLapCrossing(previousCrossing, crossing)
    }

    return { crossings: selectedCrossings }
}

function canRepresentDistinctLapBoundaries(first: LapCrossing, second: LapCrossing, calibration: PositionCalibration): boolean {
    const elapsedSeconds = (second.timestampMs - first.timestampMs) / 1_000

    // Two crossings can represent separate boundaries only if one full lap was plausible between them.
    const maximumPlausiblePositionProgress = calibration.globalPositionRateLimitPerSecond * elapsedSeconds
    return maximumPlausiblePositionProgress >= 1
}

function selectPreferredLapCrossing(first: LapCrossing, second: LapCrossing): LapCrossing {
    if (first.confidence.boundaryConfidence !== second.confidence.boundaryConfidence) {
        return first.confidence.boundaryConfidence > second.confidence.boundaryConfidence ? first : second
    }

    if (first.confidence.timestampConfidence !== second.confidence.timestampConfidence) {
        return first.confidence.timestampConfidence > second.confidence.timestampConfidence ? first : second
    }

    return first
}

function splitLapCrossingsAtTimelineBreaks(timeline: UsableTimeline, crossings: readonly LapCrossing[]): readonly NonbreakableLapCrossingSequence[] {
    const sequences: NonbreakableLapCrossingSequence[] = []
    let currentCrossings: LapCrossing[] = []

    for (const crossing of crossings) {
        const previousCrossing = currentCrossings[currentCrossings.length - 1]

        if (previousCrossing && hasTimelineBreakBetween(timeline, previousCrossing, crossing)) {
            sequences.push({ crossings: currentCrossings })
            currentCrossings = []
        }

        currentCrossings.push(crossing)
    }

    if (currentCrossings.length > 0) sequences.push({ crossings: currentCrossings })
    return sequences
}

function hasTimelineBreakBetween(timeline: UsableTimeline, previousCrossing: LapCrossing, nextCrossing: LapCrossing): boolean {
    for (let transitionIndex = previousCrossing.transitionIndex + 1; transitionIndex < nextCrossing.transitionIndex; transitionIndex++) {
        if (timeline.transitions[transitionIndex]?.timeContinuity === 'break') return true
    }

    return false
}
