  import {
    blockOutlierChannelsNearAffectedFrames,
    computeSignalResidualBaselines,
    findIsolatedSignalSpikes,
    findLocalOutlierIssues,
  } from './local-outliers'
  import {
    computeSamplingIntervalBaseline,
    findGapsExceedingMaximumGap,
  } from './sampling-gaps'
  import {
    classifyFramePairsAsContinuousGapOrDiscontinuous,
    findDuplicateFrames,
    findTimelineIntegrityIssues,
    findTimestampOrderViolations,
    splitFramesAtContinuityBreaks,
  } from './timeline-audit'
  import {
    classifyFrameUsabilityFromIssues,
    countFramesByDisposition,
  } from './frame-usability'
  import type {
    AuditDiagnostics,
    AuditedFrame,
    AuditedTransition,
    ChannelResidualDiagnostics,
    ContinuousSegment,
    FrameAuditConfig,
    ProcessingIssue,
    SamplingDiagnostics,
    SamplingGap,
    TelemetryAuditResult,
    TelemetryChannel,
  } from './frame-audit-types'
  import type {
    NormalizedTelemetryFrame,
    NormalizedTelemetryStint,
  } from './telemetry-types'

  export interface DuplicateFrameFinding {
    readonly retainedSourceIndex: number
    readonly duplicateSourceIndex: number
    readonly timestampMs: number
  }

  export type TimestampOrderViolationKind =
    | 'duplicate-timestamp'
    | 'timestamp-regression'

  export interface TimestampOrderViolation {
    readonly fromSourceIndex: number
    readonly toSourceIndex: number
    readonly previousTimestampMs: number
    readonly currentTimestampMs: number
    readonly durationMs: number
    readonly kind: TimestampOrderViolationKind
  }

  export interface SamplingIntervalBaseline {
    readonly positiveDeltaCount: number
    readonly medianDeltaMs: number | null
    readonly madDeltaMs: number | null
    readonly robustScaleMs: number | null
    readonly maximumGapMs: number | null
  }

  export interface SignalResidualBaseline {
    readonly channel: TelemetryChannel
    readonly medianResidual: number | null
    readonly madResidual: number | null
    readonly robustScale: number | null
    readonly spikeThreshold: number | null
    readonly diagnostics: ChannelResidualDiagnostics
  }

  export interface LocalSignalSpike {
    readonly sourceIndex: number
    readonly timestampMs: number
    readonly channel: TelemetryChannel
    readonly measuredValue: number
    readonly predictedValue: number
    readonly residual: number
    readonly threshold: number
  }

  export interface FrameDispositionCounts {
    readonly accepted: number
    readonly suspect: number
    readonly rejected: number
  }

  /**
   * Runs the frame-audit pipeline without mutating or copying normalized
   * telemetry values. The returned wrappers, issues, transitions, segments and
   * diagnostics describe what downstream processing may safely use.
   */
  export function auditTelemetry(
    telemetry: NormalizedTelemetryStint,
    config: FrameAuditConfig,
  ): TelemetryAuditResult {
    const normalizedFrames: readonly NormalizedTelemetryFrame[] = telemetry.frames

    const duplicateFrames: readonly DuplicateFrameFinding[] = findDuplicateFrames(normalizedFrames)

    const timestampOrderViolations: readonly TimestampOrderViolation[] = findTimestampOrderViolations(normalizedFrames)

    const samplingBaseline: SamplingIntervalBaseline = computeSamplingIntervalBaseline(normalizedFrames, config.sampling)

    const samplingGaps: readonly SamplingGap[] = findGapsExceedingMaximumGap(normalizedFrames, samplingBaseline.maximumGapMs)

    const timelineIssues: readonly ProcessingIssue[] = findTimelineIntegrityIssues(duplicateFrames, timestampOrderViolations,
        samplingGaps, samplingBaseline)

    const timelineTransitions: readonly AuditedTransition[] = classifyFramePairsAsContinuousGapOrDiscontinuous(
        normalizedFrames,
        duplicateFrames,
        timestampOrderViolations,
        samplingGaps,
        timelineIssues,
) 
      

    const residualBaselines: readonly SignalResidualBaseline[] =
      computeSignalResidualBaselines(
        normalizedFrames,
        timelineTransitions,
        config.localOutlier,
      )

    const isolatedSignalSpikes: readonly LocalSignalSpike[] =
      findIsolatedSignalSpikes(
        normalizedFrames,
        timelineTransitions,
        residualBaselines,
        config.localOutlier,
      )

    const localOutlierIssues: readonly ProcessingIssue[] =
      findLocalOutlierIssues(isolatedSignalSpikes)

    const issues: readonly ProcessingIssue[] = Object.freeze([
      ...timelineIssues,
      ...localOutlierIssues,
    ])

    const auditedTransitions: readonly AuditedTransition[] =
      blockOutlierChannelsNearAffectedFrames(
        timelineTransitions,
        isolatedSignalSpikes,
      )

    const auditedFrames: readonly AuditedFrame[] =
      classifyFrameUsabilityFromIssues(
        normalizedFrames,
        issues,
      )

    const continuousSegments: readonly ContinuousSegment[] =
      splitFramesAtContinuityBreaks(
        auditedFrames,
        auditedTransitions,
      )

    const frameCounts: FrameDispositionCounts =
      countFramesByDisposition(auditedFrames)

    const samplingDiagnostics: SamplingDiagnostics = Object.freeze({
      positiveDeltaCount: samplingBaseline.positiveDeltaCount,
      medianDeltaMs: samplingBaseline.medianDeltaMs,
      madDeltaMs: samplingBaseline.madDeltaMs,
      scaledMadDeltaMs: samplingBaseline.robustScaleMs,
      maximumGapMs: samplingBaseline.maximumGapMs,
      gapMedianMultiplier: config.sampling.gapMedianMultiplier,
      gapRobustScaleMultiplier:
        config.sampling.gapRobustScaleMultiplier,
      detectedGapCount: samplingGaps.length,
    })

    const channelResiduals: readonly ChannelResidualDiagnostics[] =
      Object.freeze(
        residualBaselines.map((baseline) => baseline.diagnostics),
      )

    const diagnostics: AuditDiagnostics = Object.freeze({
      inputFrameCount: normalizedFrames.length,
      acceptedFrameCount: frameCounts.accepted,
      suspectFrameCount: frameCounts.suspect,
      rejectedFrameCount: frameCounts.rejected,
      continuousSegmentCount: continuousSegments.length,
      sampling: samplingDiagnostics,
      channelResiduals,
    })

    return Object.freeze({
      telemetry,
      frames: auditedFrames,
      transitions: auditedTransitions,
      continuousSegments,
      issues,
      diagnostics,
    })
  }
