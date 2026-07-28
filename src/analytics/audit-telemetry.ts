import type { NormalizedTelemetryFrame, NormalizedTelemetryStint } from "./telemetry-types";
import type { ChannelDiscontinuity, ContinuousTimelineSegment, FrameAuditConfig, FrameTransition, IsolatedChannelOutlier, ProcessingIssue, SamplingBaseline, TelemetryAuditResult, TimelineTransition, UsableTimeline } from "./frame-audit-types";
import { createTimelineTransitions } from "./audit/create-timeline-transitions";
import { createFrameTransitions } from "./audit/create-frame-transitions";
import { computeSamplingBaseline } from "./audit/compute-sampling-baseline";
import { findChannelOutliers } from "./audit/find-isolated-outliers";
import { createAuditedFrames } from "./audit/create-audit-frames";
import { createUsableTimeline } from "./audit/create-usable-timeline";
import { createContinuousTimelineSegments } from "./audit/create-continuous-timeline-segments";
import { attachChannelDiscontinuities, findChannelDiscontinuities } from "./audit/find-channel-discontinuities";
import { createProcessingIssues } from "./audit/create-processing-issues";

export function auditTelemetry(telemetry: NormalizedTelemetryStint, config: FrameAuditConfig) : TelemetryAuditResult {
    const normalizedFrames: readonly NormalizedTelemetryFrame[] = telemetry.frames
    const frameTransitions: FrameTransition[] = createFrameTransitions(normalizedFrames)
    const timelineTransitions: TimelineTransition[] = createTimelineTransitions(frameTransitions)
    const samplingBaseline: SamplingBaseline | null = computeSamplingBaseline(timelineTransitions, config.sampling)
    let isolatedOutliers: IsolatedChannelOutlier[] = []

    if (samplingBaseline !== null) {
        isolatedOutliers = findChannelOutliers(normalizedFrames, samplingBaseline, config.isolatedOutlier)
    }

    const auditedFrames = createAuditedFrames(normalizedFrames, isolatedOutliers)
    let usableTimeline: UsableTimeline | null = null

    if (samplingBaseline !== null) {
        usableTimeline = createUsableTimeline(auditedFrames, timelineTransitions, samplingBaseline)
    }

    let continuousTimelineSegments: ContinuousTimelineSegment[] = []
    let channelDiscontinuities: ChannelDiscontinuity[] = []

    if (usableTimeline !== null && samplingBaseline !== null) {
        channelDiscontinuities = findChannelDiscontinuities(usableTimeline, samplingBaseline, config.channelContinuity)
        usableTimeline = attachChannelDiscontinuities(usableTimeline, channelDiscontinuities)
        continuousTimelineSegments = createContinuousTimelineSegments(usableTimeline)
    }

    const issues: ProcessingIssue[] = createProcessingIssues(timelineTransitions, samplingBaseline, isolatedOutliers, usableTimeline, channelDiscontinuities, config)

    return {
        frameTransitions,
        timelineTransitions,
        samplingBaseline,
        isolatedOutliers,
        auditedFrames,
        usableTimeline,
        continuousTimelineSegments,
        channelDiscontinuities,
        issues,
    }
}
