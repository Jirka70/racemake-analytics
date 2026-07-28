import type {
  NormalizedTelemetryFrame,
  NormalizedTelemetryStint,
} from './telemetry-types'
import type {
  ContinuousTimelineSegment,
  FrameAuditConfig,
  FrameTransition,
  IsolatedChannelOutlier,
  SamplingBaseline,
  TelemetryAuditResult,
  TimelineTransition,
  UsableTimeline,
} from './frame-audit-types'
import { createTimelineTransitions } from './audit/create-timeline-transitions'
import { createFrameTransitions } from './audit/create-frame-transitions'
import { computeSamplingBaseline } from './audit/compute-sampling-baseline'
import { findChannelOutliers } from './audit/find-isolated-outliers'
import { createAuditedFrames } from './audit/create-audit-frames'
import { createUsableTimeline } from './audit/create-usable-timeline'
import { createContinuousTimelineSegments } from './audit/create-continuous-timeline-segments'

export function auditTelemetry(
  telemetry: NormalizedTelemetryStint,
  config: FrameAuditConfig,
): TelemetryAuditResult {
  const normalizedFrames: readonly NormalizedTelemetryFrame[] = telemetry.frames
  const frameTransitions: FrameTransition[] = createFrameTransitions(normalizedFrames)
  const timelineTransitions: TimelineTransition[] = createTimelineTransitions(frameTransitions)
  const samplingBaseline: SamplingBaseline | null =
    computeSamplingBaseline(
      timelineTransitions,
      config.sampling,
    )

  let isolatedOutliers: IsolatedChannelOutlier[] = []

  if (samplingBaseline !== null) {
    isolatedOutliers = findChannelOutliers(
      normalizedFrames,
      samplingBaseline,
      config.isolatedOutlier,
    )
  }
  const auditedFrames = createAuditedFrames(normalizedFrames, isolatedOutliers,)
  let usableTimeline: UsableTimeline | null = null

  if (samplingBaseline !== null) {
    usableTimeline = createUsableTimeline(
      auditedFrames,
      timelineTransitions,
      samplingBaseline,
    )
  }

  let continuousTimelineSegments:
    ContinuousTimelineSegment[] = []

  if (usableTimeline !== null) {
    continuousTimelineSegments =
      createContinuousTimelineSegments(
        usableTimeline,
      )
  }

  return {
      frameTransitions: frameTransitions,
      timelineTransitions: timelineTransitions,
      samplingBaseline,
      isolatedOutliers: isolatedOutliers,
      auditedFrames: auditedFrames,
      usableTimeline,
      continuousTimelineSegments,
  }
}
