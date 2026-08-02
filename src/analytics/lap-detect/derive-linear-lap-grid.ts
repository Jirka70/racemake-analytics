import type { UsableTimeline } from '../frame-audit-types'
import { median } from '../robust-statistics'
import type { DetectedLap, LinearLapGrid } from './lap-detect-types'
import { isChannelUsable, POSITION_CHANNEL } from './util/usable-channels'

export function deriveLinearLapGrid(timeline: UsableTimeline, laps: readonly DetectedLap[]): LinearLapGrid | null {
    if (laps.length === 0) return null

    const usablePositionSampleCounts = laps.map((lap) => countUsablePositionSamples(timeline, lap))
    const medianUsablePositionSampleCountPerLap = median(usablePositionSampleCounts)
    const cellCount = Math.max(1, Math.floor(medianUsablePositionSampleCountPerLap))
    const positionStep = 1 / cellCount
    const positions = Array.from({ length: cellCount + 1 }, (_, positionIndex) => positionIndex * positionStep)

    return { cellCount, positionStep, positions, medianUsablePositionSampleCountPerLap }
}

function countUsablePositionSamples(timeline: UsableTimeline, lap: DetectedLap): number {
    const lapFrames = timeline.frames.slice(lap.startCrossing.transitionIndex + 1, lap.endCrossing.transitionIndex + 1)
    const uniquePositions = new Set<number>()

    for (const auditedFrame of lapFrames) {
        if (!isChannelUsable(auditedFrame, POSITION_CHANNEL)) continue
        uniquePositions.add(auditedFrame.frame.normalizedTrackPosition)
    }

    return uniquePositions.size
}
