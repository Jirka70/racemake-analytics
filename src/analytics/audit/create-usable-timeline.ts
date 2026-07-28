import { AuditedFrame, AuditedTimelineTransition, ExcludedTimelineFrame, ExcludedTimelineFrameReason, SamplingBaseline, TimelineContinuity, TimelineTransition, UsableTimeline } from "../frame-audit-types";
import { createFrameTransitions } from "./create-frame-transitions";
import { createTimelineTransitions } from "./create-timeline-transitions";

export function createUsableTimeline(auditedFrames: readonly AuditedFrame[], 
    originalTransitions: readonly TimelineTransition[], 
    samplingBaseline: SamplingBaseline) : UsableTimeline {
    const originalTransitionByCurrentSourceIndex = indexTransitionsByCurrentSourceIndex(originalTransitions)
    
    const retainedFrames: AuditedFrame[] = []
    const excludedFrames: ExcludedTimelineFrame[] = []

    for (const auditedFrame of auditedFrames) {
        const incomingTransition = originalTransitionByCurrentSourceIndex.get(auditedFrame.frame.sourceIndex)
        const exclusionReason = findTimelineFrameExclusionReason(auditedFrame, incomingTransition)

        if (exclusionReason) {
            excludedFrames.push({ frame: auditedFrame.frame, reason: exclusionReason })
            continue
        }

        retainedFrames.push(auditedFrame)
    }

    const retainedNormalizedFrames = retainedFrames.map((frame) => frame.frame)
    const rebuiltFrameTransitions = createFrameTransitions(retainedNormalizedFrames)
    const rebuiltTimelineTransitions = createTimelineTransitions(rebuiltFrameTransitions)

    const auditedTransitions = rebuiltTimelineTransitions
        .map((timelineTransition) => createAuditedTransition(timelineTransition, samplingBaseline))

    return {
        frames: retainedFrames,
        excludedFrames,
        transitions: auditedTransitions   
    }
}

function createAuditedTransition(transition: TimelineTransition, samplingBaseline: SamplingBaseline) : AuditedTimelineTransition {
    return {
        ...transition,
        timeContinuity: determineContinuity(transition, samplingBaseline),
        discontinuousChannels: [],
    }
}

function determineContinuity(transition: TimelineTransition, samplingBaseline: SamplingBaseline) : TimelineContinuity {
    if (transition.relation !== "chronological") return "break"
    if (transition.timestampDeltaMs > samplingBaseline.maximumGapMs) return "gap"

    return "continuous"
}

function findTimelineFrameExclusionReason(
  auditedFrame: AuditedFrame,
  incomingTransition:
    TimelineTransition | undefined,
): ExcludedTimelineFrameReason | null {
    const isInvalidTimestampChannel = auditedFrame.invalidChannels.includes('timestampMs')

    if (isInvalidTimestampChannel) return "isolated-invalid-timestamp"

    if (!incomingTransition) return null
    
    const isExactDuplicate = incomingTransition.relation === "exact-duplicate"
    if (isExactDuplicate) return "exact-duplicate"

    const hasSameTimestamp = incomingTransition.relation === 'same-timestamp-conflict'
    if (hasSameTimestamp) return 'same-timestamp-conflict'

    return null
}

function indexTransitionsByCurrentSourceIndex(transitions: readonly TimelineTransition[])
    : Map<number, TimelineTransition> {
    const transitionsByCurrentSourceIndex =
        new Map<number, TimelineTransition>()

    for (const transition of transitions) {
        transitionsByCurrentSourceIndex.set(transition.current.sourceIndex, transition)
    }

    return transitionsByCurrentSourceIndex
}
