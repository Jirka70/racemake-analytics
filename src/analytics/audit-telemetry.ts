import type {
  NormalizedTelemetryFrame,
  NormalizedTelemetryStint,
} from './telemetry-types'
import type {
  FrameAuditConfig,
  FrameTransition,
  IsolatedChannelOutlier,
  SamplingBaseline,
  TelemetryAuditResult,
  TimelineTransition,
} from './frame-audit-types'
import { createTimelineTransitions } from './audit/create-timeline-transitions'
import { createFrameTransitions } from './audit/create-frame-transitions'
import { computeSamplingBaseline } from './audit/compute-sampling-baseline'
import { findChannelOutliers } from './audit/find-isolated-outliers'

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

  return {
    frameTransitions: Object.freeze(frameTransitions),
    timelineTransitions: Object.freeze(timelineTransitions),
    samplingBaseline,
    isolatedOutliers: Object.freeze(isolatedOutliers),
  }
}
