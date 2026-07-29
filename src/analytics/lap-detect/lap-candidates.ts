import type { UsableTimeline } from '../frame-audit-types'
import type { InternalLapCrossing, LapCandidate, LapFragment } from './lap-detect-types'

export function createLapCandidates(timeline: UsableTimeline, crossings: readonly InternalLapCrossing[]): LapCandidate[] {
    const candidates: LapCandidate[] = []

    for (let crossingIndex = 0; crossingIndex < crossings.length - 1; crossingIndex += 1) {
        const startCrossing = crossings[crossingIndex]
        const finishCrossing = crossings[crossingIndex + 1]
        const startFrameIndex = startCrossing.currentFrameIndex
        const finishFrameIndex = finishCrossing.currentFrameIndex

        candidates.push({
            sequenceNumber: crossingIndex + 1,
            startCrossing,
            finishCrossing,
            frames: timeline.frames.slice(startFrameIndex, finishFrameIndex),
            transitions: timeline.transitions.slice(startFrameIndex, finishFrameIndex),
        })
    }

    return candidates
}

export function createLapFragments(timeline: UsableTimeline, crossings: readonly InternalLapCrossing[]): LapFragment[] {
    if (timeline.frames.length === 0) return []

    if (crossings.length === 0) {
        return [createLapFragment(timeline, 'whole-timeline', 0, timeline.frames.length)]
    }

    const fragments: LapFragment[] = []
    const firstCrossingFrameIndex = crossings[0].currentFrameIndex
    const lastCrossingFrameIndex = crossings[crossings.length - 1].currentFrameIndex

    if (firstCrossingFrameIndex > 0) {
        fragments.push(createLapFragment(timeline, 'opening', 0, firstCrossingFrameIndex))
    }

    if (lastCrossingFrameIndex < timeline.frames.length) {
        fragments.push(createLapFragment(timeline, 'closing', lastCrossingFrameIndex, timeline.frames.length))
    }

    return fragments
}

function createLapFragment(timeline: UsableTimeline, kind: LapFragment['kind'], startFrameIndex: number, endFrameIndexExclusive: number): LapFragment {
    return {
        kind,
        startSourceIndex: timeline.frames[startFrameIndex].frame.sourceIndex,
        endSourceIndex: timeline.frames[endFrameIndexExclusive - 1].frame.sourceIndex,
        frameCount: endFrameIndexExclusive - startFrameIndex,
    }
}
