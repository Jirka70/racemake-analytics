import type { AuditedTimelineTransition, UsableTimeline } from '../frame-audit-types'
import type { LapCounterEvidence } from './lap-detect-types'

interface LapCounterIncrement {
    readonly frameOffset: number
    readonly previousLapNumber: number
    readonly observedLapNumber: number
}

export function evaluateLapCounterEvidence(timeline: UsableTimeline, candidateTransitionIndex: number, searchRadiusFrames: number): LapCounterEvidence {
    const candidateTransition = timeline.transitions[candidateTransitionIndex]
    if (!candidateTransition) throw new Error(`Missing lap-crossing candidate transition at index ${candidateTransitionIndex}`)

    if (hasLapCounterIncrement(candidateTransition)) return createEvidence('exact', 0, candidateTransition)

    const candidateIncrement = calculateLapCounterIncrement(candidateTransition)
    if (candidateIncrement !== 0) return createEvidence('mismatch', 0, candidateTransition)

    const surroundingIncrements = collectSurroundingLapCounterIncrements(timeline, candidateTransitionIndex, searchRadiusFrames)
    if (surroundingIncrements.length === 0) {
        return {
            status: 'missing',
            frameOffset: null,
            previousLapNumber: candidateTransition.previous.recordedLapNumber,
            observedLapNumber: null,
        }
    }

    const validIncrements = surroundingIncrements.filter(({ previousLapNumber, observedLapNumber }) => observedLapNumber - previousLapNumber === 1)
    const hasMismatch = surroundingIncrements.some(({ previousLapNumber, observedLapNumber }) => observedLapNumber - previousLapNumber !== 1)
    const selectedIncrement = surroundingIncrements[0]

    if (hasMismatch || validIncrements.length !== 1) {
        return {
            status: 'mismatch',
            frameOffset: selectedIncrement.frameOffset,
            previousLapNumber: selectedIncrement.previousLapNumber,
            observedLapNumber: selectedIncrement.observedLapNumber,
        }
    }

    const increment = validIncrements[0]
    return {
        status: 'nearby',
        frameOffset: increment.frameOffset,
        previousLapNumber: increment.previousLapNumber,
        observedLapNumber: increment.observedLapNumber,
    }
}

function collectSurroundingLapCounterIncrements(timeline: UsableTimeline, candidateTransitionIndex: number, searchRadiusFrames: number): LapCounterIncrement[] {
    const increments: LapCounterIncrement[] = []

    for (const direction of [1, -1] as const) {
        for (let distance = 1; distance <= searchRadiusFrames; distance++) {
            const transition = timeline.transitions[candidateTransitionIndex + direction * distance]
            if (!transition || transition.timeContinuity !== 'continuous') break

            const lapIncrement = calculateLapCounterIncrement(transition)
            if (lapIncrement === 0) continue

            increments.push({
                frameOffset: direction * distance,
                previousLapNumber: transition.previous.recordedLapNumber,
                observedLapNumber: transition.current.recordedLapNumber,
            })
        }
    }

    return increments
}

function hasLapCounterIncrement(transition: AuditedTimelineTransition): boolean {
    if (transition.timeContinuity !== 'continuous') return false
    return calculateLapCounterIncrement(transition) === 1
}

function calculateLapCounterIncrement(transition: AuditedTimelineTransition): number {
    return transition.current.recordedLapNumber - transition.previous.recordedLapNumber
}

function createEvidence(status: 'exact' | 'mismatch', frameOffset: number, transition: AuditedTimelineTransition): LapCounterEvidence {
    return {
        status,
        frameOffset,
        previousLapNumber: transition.previous.recordedLapNumber,
        observedLapNumber: transition.current.recordedLapNumber,
    }
}
