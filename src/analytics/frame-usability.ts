import type { FrameDispositionCounts } from './audit-telemetry'
import type {
  AuditedFrame,
  FrameDisposition,
  ProcessingIssue,
  TelemetryChannel,
} from './frame-audit-types'
import type { NormalizedTelemetryFrame } from './telemetry-types'

export function classifyFrameUsabilityFromIssues(
  frames: readonly NormalizedTelemetryFrame[],
  issues: readonly ProcessingIssue[],
): readonly AuditedFrame[] {
  const issuesBySourceIndex = new Map<
    number,
    ProcessingIssue[]
  >()

  for (const issue of issues) {
    if (issue.sourceIndex === undefined) continue
    const isFrameRelatedIssue = issue.scope === 'frame' || issue.scope === 'channel'
    if (!isFrameRelatedIssue) {
      continue
    }

    const frameIssues = issuesBySourceIndex.get(issue.sourceIndex) ?? []
    frameIssues.push(issue)
    issuesBySourceIndex.set(issue.sourceIndex, frameIssues)
  }

  const auditedFrames: AuditedFrame[] = []

  for (const frame of frames) {
    const frameIssues = issuesBySourceIndex.get(frame.sourceIndex) ?? []
    const invalidChannels = collectInvalidChannels(frameIssues)
    const disposition = computeFrameDisposition(frameIssues)

    auditedFrames.push({ frame, disposition, invalidChannels, issues: frameIssues })
  }

  return Object.freeze(auditedFrames)
}

export function countFramesByDisposition(
  frames: readonly AuditedFrame[],
): FrameDispositionCounts {
  let accepted = 0
  let suspect = 0
  let rejected = 0

  for (const frame of frames) {
    switch (frame.disposition) {
      case 'accepted':
        accepted += 1
        break
      case 'suspect':
        suspect += 1
        break
      case 'rejected':
        rejected += 1
        break
    }
  }

  return Object.freeze({
    accepted,
    suspect,
    rejected,
  })
}

function collectInvalidChannels(frameIssues: readonly ProcessingIssue[]): TelemetryChannel[] {
  const invalidChannels: TelemetryChannel[] = []

  for (const frameIssue of frameIssues) {
    if (frameIssue.action !== 'exclude-channel-value') continue

    for (const channel of frameIssue.channels ?? []) {
      invalidChannels.push(channel)
    }
  }

  return invalidChannels
}

function computeFrameDisposition(frameIssues: readonly ProcessingIssue[]): FrameDisposition {
  const hasIssues = frameIssues.length > 0
  const isFrameRejected = frameIssues.some((issue) => issue.action === 'exclude-frame')

  if (isFrameRejected) return 'rejected'
  if (hasIssues) return 'suspect'

  return 'accepted'
}
