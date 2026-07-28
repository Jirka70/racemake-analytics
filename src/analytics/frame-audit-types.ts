import type {
  NormalizedTelemetryFrame,
  TyreCoreTemperatureC,
} from './telemetry-types'

export type TyreTemperatureChannel =
  `tyreCoreTemperatureC.${keyof TyreCoreTemperatureC}`

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

export interface FrameTransition {
  readonly previous: NormalizedTelemetryFrame
  readonly current: NormalizedTelemetryFrame
  readonly timestampDeltaMs: number
}

export type FrameTransitionRelation =
  | 'chronological'
  | 'exact-duplicate'
  | 'same-timestamp-conflict'
  | 'timestamp-regression'

export interface TimelineTransition extends FrameTransition {
  readonly relation: FrameTransitionRelation
}

export interface AuditedTimelineTransition extends TimelineTransition {
  readonly timeContinuity: TimelineContinuity
  readonly discontinuousChannels: readonly LocallyAuditedSignalChannel[]
}

export interface UsableTimeline {
  readonly frames: readonly AuditedFrame[]
  readonly excludedFrames: readonly ExcludedTimelineFrame[]
  readonly transitions: readonly AuditedTimelineTransition[]
}

export interface SamplingConfig {
  readonly minimumSampleCount: number
  readonly gapMedianMultiplier: number
  readonly gapMadMultiplier: number
}

export interface SamplingBaseline {
  readonly sampleCount: number
  readonly medianDeltaMs: number
  readonly madDeltaMs: number
  readonly scaledMadDeltaMs: number
  readonly maximumGapMs: number
}

export interface FrameAuditConfig {
  readonly sampling: SamplingConfig
  readonly isolatedOutlier: IsolatedOutlierConfig
  readonly channelContinuity: ChannelContinuityConfig
}

export interface TelemetryAuditResult {
  readonly frameTransitions: readonly FrameTransition[]
  readonly timelineTransitions: readonly TimelineTransition[]
  readonly samplingBaseline: SamplingBaseline | null
  readonly isolatedOutliers: readonly IsolatedChannelOutlier[]
  readonly auditedFrames: readonly AuditedFrame[]
  readonly usableTimeline: UsableTimeline | null
  readonly continuousTimelineSegments: readonly ContinuousTimelineSegment[]
  readonly channelDiscontinuities: readonly ChannelDiscontinuity[]
}

export type TimelineContinuity =
  | 'continuous'
  | 'gap'
  | 'break'

export type ExcludedTimelineFrameReason =
  | 'exact-duplicate'
  | 'same-timestamp-conflict'
  | 'isolated-invalid-timestamp'

export interface ExcludedTimelineFrame {
  readonly frame: NormalizedTelemetryFrame
  readonly reason: ExcludedTimelineFrameReason
}

export interface AuditedFrame {
  readonly frame: NormalizedTelemetryFrame
  readonly suspectChannels: readonly TelemetryChannel[]
  readonly invalidChannels: readonly TelemetryChannel[]
}

export type LocallyAuditedSignalChannel =
  | 'normalizedTrackPosition'
  | 'speedKmh'
  | 'throttleRatio'
  | 'brakeRatio'
  | 'steeringDegrees'
  | 'engineRpm'
  | TyreTemperatureChannel

export type DerivableTelemetryChannel = Exclude<LocallyAuditedSignalChannel, 'engineRpm'>

export type IsolatedOutlierChannel =
  | 'timestampMs'
  | LocallyAuditedSignalChannel

export interface IsolatedChannelOutlier {
  readonly frame: NormalizedTelemetryFrame
  readonly channel: IsolatedOutlierChannel
  readonly usability: 'suspect' | 'invalid'

  readonly previousValue: number
  readonly observedValue: number
  readonly nextValue: number

  readonly predictedValue?: number
  readonly residual?: number
  readonly threshold?: number
}

export type DriverInputChannel =
  | 'throttleRatio'
  | 'brakeRatio'
  | 'steeringDegrees'

export type LocallyAuditedSensorChannel = Exclude<
  LocallyAuditedSignalChannel,
  DriverInputChannel
>

export interface IsolatedOutlierConfig {
  readonly minimumResidualSampleCount: number
  readonly signalMadMultiplier: number
  readonly driverInputMadMultiplier: number
  readonly minimumReturnRateRatio: number
  readonly fallbackIqrMultiplier: number
  readonly minimumResidualBySignalChannel: Partial<Record<LocallyAuditedSensorChannel, number>>
}

export interface SignalResidualSample {
  readonly frame: NormalizedTelemetryFrame
  readonly channel: LocallyAuditedSignalChannel

  readonly previousValue: number
  readonly observedValue: number
  readonly nextValue: number

  readonly predictedValue: number
  readonly residual: number
  readonly incomingDurationMs: number
  readonly outgoingDurationMs: number
}

export interface ContinuousTimelineSegment {
  readonly id: string
  readonly frames: readonly AuditedFrame[]
  readonly startSourceIndex: number
  readonly endSourceIndex: number
  readonly startTimestampMs: number
  readonly endTimestampMs: number
  readonly frameCount: number
}

export type PersistenceAuditedChannel =
  | 'speedKmh'
  | 'engineRpm'
  | TyreTemperatureChannel

export interface ChannelContinuityConfig {
  readonly minimumRateSampleCount: number
  readonly rateMadMultiplier: number
  readonly rateIqrMultiplier: number
  readonly windowDurationMultiplier: number
  readonly minimumWindowSamples: number
  readonly minimumShiftToSpreadRatio: number
}

export interface ChannelDiscontinuity {
  readonly previousSourceIndex: number
  readonly currentSourceIndex: number
  readonly channels: readonly PersistenceAuditedChannel[]
}
