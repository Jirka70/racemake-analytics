import type {
  NormalizedTelemetryFrame,
  NormalizedTelemetryStint,
  TyreCoreTemperatureC,
} from './telemetry-types'

export type TyreTemperatureChannel =
  `tyreCoreTemperatureC.${keyof TyreCoreTemperatureC}`

/**
 * Normalized telemetry values that can be independently accepted, rejected,
 * or blocked from interpolation. `sourceIndex` is identity metadata rather
 * than a measured channel.
 */
export type TelemetryChannel =
  | 'timestampMs'
  | 'recordedLapNumber'
  | 'normalizedTrackPosition'
  | 'speedKmh'
  | 'throttleRatio'
  | 'brakeRatio'
  | 'steeringDegrees'
  | 'gear'
  | 'engineRpm'
  | TyreTemperatureChannel

export type IssueSeverity = 'info' | 'warning' | 'error' | 'fatal'

/**
 * Severity describes how serious an issue is. Action independently describes
 * what downstream processing is allowed to do with the affected data.
 */
export type IssueAction =
  | 'retain'
  | 'exclude-channel-value'
  | 'exclude-frame'
  | 'split-segment'
  | 'exclude-lap'
  | 'reject-dataset'

export type IssueScope =
  | 'dataset'
  | 'segment'
  | 'lap'
  | 'frame'
  | 'channel'
  | 'transition'

/**
 * Deliberately broad and stable categories. Exact causes belong in `reason`
 * and evidence, so codes never encode a known frame, lap, or dataset value.
 */
export type IssueCode =
  | 'CONTRACT_VIOLATION'
  | 'DUPLICATE_SAMPLE'
  | 'TIME_ORDER_VIOLATION'
  | 'SAMPLING_GAP'
  | 'LOCAL_OUTLIER'
  | 'SEQUENCE_DISCONTINUITY'
  | 'CYCLE_MARKER_MISMATCH'
  | 'PARTIAL_CYCLE'
  | 'INSUFFICIENT_SUPPORT'
  | 'STATIONARY_FRAGMENT'
  | 'INSUFFICIENT_BASELINE'

export type IssueEvidenceValue = number | string | boolean

export interface ProcessingIssue {
  readonly code: IssueCode
  readonly reason: string
  readonly severity: IssueSeverity
  readonly action: IssueAction
  readonly scope: IssueScope

  readonly sourceIndex?: number
  readonly nextSourceIndex?: number
  readonly timestampMs?: number
  readonly recordedLapNumber?: number
  readonly channels?: readonly TelemetryChannel[]

  readonly observed?: Readonly<Record<string, IssueEvidenceValue>>
  readonly thresholds?: Readonly<Record<string, number>>
  readonly message: string
}

export type FrameDisposition = 'accepted' | 'suspect' | 'rejected'

/**
 * This wrapper references the existing normalized frame; it does not copy its
 * telemetry values. Issue objects are likewise shared references.
 */
export interface AuditedFrame {
  readonly frame: NormalizedTelemetryFrame
  readonly disposition: FrameDisposition
  readonly invalidChannels: readonly TelemetryChannel[]
  readonly issues: readonly ProcessingIssue[]
}

export type TransitionContinuity =
  | 'continuous'
  | 'gap'
  | 'discontinuous'

/**
 * Describes the boundary between two adjacent source frames. Blocking is
 * channel-specific so one broken sensor does not invalidate unrelated data.
 */
export interface AuditedTransition {
  readonly fromSourceIndex: number
  readonly toSourceIndex: number
  readonly durationMs: number
  readonly continuity: TransitionContinuity
  readonly interpolationBlockedChannels: readonly TelemetryChannel[]
  readonly derivativesBlockedChannels: readonly TelemetryChannel[]
  readonly issues: readonly ProcessingIssue[]
}

/**
 * A maximal run of frames without a global gap or sequence break. The segment
 * stores only source-index bounds, never another copy of its frames.
 */
export interface ContinuousSegment {
  readonly id: string
  readonly startSourceIndex: number
  readonly endSourceIndex: number
  readonly startTimestampMs: number
  readonly endTimestampMs: number
  readonly frameCount: number
}

export type ResidualBaselineMethod =
  | 'scaled-mad'
  | 'scaled-iqr'
  | 'quantile-fallback'
  | 'insufficient-baseline'

export interface SamplingDiagnostics {
  readonly positiveDeltaCount: number
  readonly medianDeltaMs: number | null
  readonly madDeltaMs: number | null
  readonly scaledMadDeltaMs: number | null
  readonly maximumGapMs: number | null
  readonly gapMedianMultiplier: number
  readonly gapRobustScaleMultiplier: number
  readonly detectedGapCount: number
}

export interface SamplingGap {
  readonly fromSourceIndex: number
  readonly toSourceIndex: number
  readonly fromTimestampMs: number
  readonly toTimestampMs: number
  readonly durationMs: number
}

export interface SamplingGapAnalysis {
  readonly gaps: readonly SamplingGap[]
  readonly diagnostics: SamplingDiagnostics
}

export interface ChannelResidualDiagnostics {
  readonly channel: TelemetryChannel
  readonly method: ResidualBaselineMethod
  readonly preliminarySampleCount: number
  readonly finalSampleCount: number
  readonly residualMedian: number | null
  readonly residualMad: number | null
  readonly scaledResidualMad: number | null
  readonly residualIqr: number | null
  readonly fallbackQuantile: number
  readonly spikeMadMultiplier: number
  readonly spikeThreshold: number | null
}

export interface AuditDiagnostics {
  readonly inputFrameCount: number
  readonly acceptedFrameCount: number
  readonly suspectFrameCount: number
  readonly rejectedFrameCount: number
  readonly invalidChannelValueCounts: Readonly<
    Partial<Record<TelemetryChannel, number>>
  >
  readonly continuousSegmentCount: number
  readonly sampling: SamplingDiagnostics
  readonly channelResiduals: readonly ChannelResidualDiagnostics[]
}

/**
 * Algorithmic policy only. Concrete limits in milliseconds or channel units
 * are derived from every ingested dataset and returned in diagnostics.
 */
export interface FrameAuditConfig {
  readonly sampling: SamplingAuditConfig

  readonly localOutlier: {
    /**
     * Controls how far a residual must lie above its per-channel robust scale
     * before becoming a candidate. It is dimensionless, not a physical limit.
     */
    readonly spikeMadMultiplier: number

    /**
     * Expresses persistence-window duration as a multiple of the dataset's
     * typical sampling interval instead of a fixed frame count.
     */
    readonly persistenceWindowDeltaMultiplier: number

    /**
     * Requires enough observations on each side to distinguish a one-frame
     * spike from a persistent change.
     */
    readonly minimumWindowSamples: number

    /**
     * Last-resort robust cutoff when MAD and IQR cannot provide a non-zero
     * scale. A degenerate fallback must produce insufficient-baseline instead.
     */
    readonly fallbackQuantile: number
  }
}

export interface SamplingAuditConfig {
  /**
   * Declares a gap after several typical sample intervals, tolerating normal
   * recorder jitter without embedding a fixed millisecond threshold.
   */
  readonly gapMedianMultiplier: number

  /**
   * Expands the gap threshold for datasets whose normal sample intervals
   * have greater robust variability.
   */
  readonly gapRobustScaleMultiplier: number

  /**
   * Prevents robust statistics from being treated as reliable when based on
   * too few eligible observations.
   */
  readonly minimumBaselineSamples: number
}

export interface TelemetryAuditResult {
  /**
   * Shared reference to the normalized input keeps recorder metadata available
   * without duplicating frame values.
   */
  readonly telemetry: NormalizedTelemetryStint
  readonly frames: readonly AuditedFrame[]
  readonly transitions: readonly AuditedTransition[]
  readonly continuousSegments: readonly ContinuousSegment[]
  readonly issues: readonly ProcessingIssue[]
  readonly diagnostics: AuditDiagnostics
}
