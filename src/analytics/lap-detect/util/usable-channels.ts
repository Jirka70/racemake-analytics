import type { AuditedFrame, AuditedTimelineTransition, LocallyAuditedSignalChannel } from '../../frame-audit-types'

export const POSITION_CHANNEL = 'normalizedTrackPosition'

export function canUseChannelTransition(transition: AuditedTimelineTransition, channel: LocallyAuditedSignalChannel, auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>): boolean {
    if (transition.timeContinuity !== 'continuous') return false
    if (transition.discontinuousChannels.includes(channel)) return false

    const previous = auditedFrameBySourceIndex.get(transition.previous.sourceIndex)
    const current = auditedFrameBySourceIndex.get(transition.current.sourceIndex)

    return previous !== undefined
        && current !== undefined
        && isChannelUsable(previous, channel)
        && isChannelUsable(current, channel)
}

export function canUsePositionTransition(transition: AuditedTimelineTransition, auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>): boolean {
    return canUseChannelTransition(transition, POSITION_CHANNEL, auditedFrameBySourceIndex)
}

export function isChannelUsable(auditedFrame: AuditedFrame, channel: LocallyAuditedSignalChannel): boolean {
    return !auditedFrame.invalidChannels.includes(channel) && !auditedFrame.suspectChannels.includes(channel)
}
