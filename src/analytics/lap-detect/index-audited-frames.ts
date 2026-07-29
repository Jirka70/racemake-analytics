import type { AuditedFrame, UsableTimeline } from '../frame-audit-types'

export function indexAuditedFrames(timeline: UsableTimeline): ReadonlyMap<number, AuditedFrame> {
    return new Map(
        timeline.frames.map((auditedFrame) => [auditedFrame.frame.sourceIndex, auditedFrame]),
    )
}
