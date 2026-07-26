import type { FrameDispositionCounts } from './audit-telemetry'
import type {
  AuditedFrame,
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
    if (
      issue.sourceIndex === undefined || (issue.scope !== 'frame' && issue.scope !== 'channel')
    ) {
      continue
    }

    const frameIssues = issuesBySourceIndex.get(issue.sourceIndex) ?? []
    frameIssues.push(issue)
    issuesBySourceIndex.set(issue.sourceIndex, frameIssues)
  }

  return Object.freeze(
    frames.map((frame) => {
      const frameIssues = Object.freeze([
        ...(issuesBySourceIndex.get(frame.sourceIndex) ?? []),
      ])
      const invalidChannels = Object.freeze([
        ...new Set(
          frameIssues.flatMap((issue) =>
            issue.action === 'exclude-channel-value'
              ? (issue.channels ?? [])
              : [],
          ),
        ),
      ])
      const rejected = frameIssues.some(
        (issue) =>
          issue.action === 'exclude-frame' ||
          issue.action === 'reject-dataset',
      )
      const disposition = rejected
        ? 'rejected'
        : frameIssues.length > 0 || invalidChannels.length > 0
          ? 'suspect'
          : 'accepted'

      return Object.freeze({
        frame,
        disposition,
        invalidChannels,
        issues: frameIssues,
      })
    }),
  )
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

export function countInvalidValuesByChannel(
  frames: readonly AuditedFrame[],
): Readonly<Partial<Record<TelemetryChannel, number>>> {
  const counts: Partial<Record<TelemetryChannel, number>> = {}

  for (const frame of frames) {
    for (const channel of frame.invalidChannels) {
      counts[channel] = (counts[channel] ?? 0) + 1
    }
  }

  return Object.freeze(counts)
}
