import type { AuditedFrame, AuditedTimelineTransition, UsableTimeline } from '../frame-audit-types'
import { evaluateLapCounterEvidence } from './lap-counter-evidence'
import type { LapCrossingCandidate } from './lap-detect-types'
import { canUsePositionTransition } from './util/usable-channels'

const MINIMUM_POSITION_DROP_FOR_WRAP = 0.5

export function findLapCrossingCandidates(timeline: UsableTimeline, auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>, lapCounterSearchRadiusFrames: number): LapCrossingCandidate[] {
    const candidates: LapCrossingCandidate[] = []

    for (let transitionIndex = 0; transitionIndex < timeline.transitions.length; transitionIndex++) {
        const transition = timeline.transitions[transitionIndex]

        if (!canUsePositionTransition(transition, auditedFrameBySourceIndex)) continue
        if (!hasForwardPositionWrap(transition)) continue

        const lapCounterEvidence = evaluateLapCounterEvidence(timeline, transitionIndex, lapCounterSearchRadiusFrames)

        candidates.push({
            transitionIndex,
            transition,
            lapCounterEvidence
        })
    }

    return candidates
}

function hasForwardPositionWrap(transition: AuditedTimelineTransition): boolean {
    const previousPosition = transition.previous.normalizedTrackPosition
    const currentPosition = transition.current.normalizedTrackPosition
    const positionChange = currentPosition - previousPosition

    return positionChange < -MINIMUM_POSITION_DROP_FOR_WRAP
}
