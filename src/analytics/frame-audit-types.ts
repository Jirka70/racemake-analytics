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
}

export interface TelemetryAuditResult {
  readonly frameTransitions: readonly FrameTransition[]
  readonly timelineTransitions: readonly TimelineTransition[]
  readonly samplingBaseline: SamplingBaseline | null
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

export interface IsolatedOutlierConfig {
  readonly minimumResidualSampleCount: number
  readonly signalMadMultiplier: number
  readonly driverInputMadMultiplier: number
}

export interface SignalResidualSample {
  readonly frame: NormalizedTelemetryFrame
  readonly channel: LocallyAuditedSignalChannel

  readonly previousValue: number
  readonly observedValue: number
  readonly nextValue: number

  readonly predictedValue: number
  readonly residual: number
}
