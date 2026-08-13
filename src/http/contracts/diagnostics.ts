import type {
  PersistenceAuditedChannel,
  ProcessingIssueAction,
  ProcessingIssueCode,
  ProcessingIssueScope,
  ProcessingIssueSeverity,
  TelemetryChannel,
} from '../../analytics/frame-audit-types'
import type { AnalysisResponseContext } from './analysis'
import type { CoachingDetectorFailureResponse } from './coaching'

export interface SamplingBaselineResponse {
  readonly medianIntervalMs: number
  readonly maximumContinuousIntervalMs: number
}

export interface FrameAuditIssueResponse {
  readonly id: string
  readonly code: ProcessingIssueCode
  readonly action: ProcessingIssueAction
  readonly severity: ProcessingIssueSeverity
  readonly scope: ProcessingIssueScope
  readonly message: string
  readonly sourceIndex?: number
  readonly timestampMs?: number
  readonly channels?: readonly TelemetryChannel[]
}

export interface ChannelDiscontinuityResponse {
  readonly previousSourceIndex: number
  readonly currentSourceIndex: number
  readonly channels: readonly PersistenceAuditedChannel[]
}

export interface FrameAuditDiagnosticsResponse {
  readonly receivedFrameCount: number
  readonly retainedTimelineFrameCount: number
  readonly excludedTimelineFrameCount: number
  readonly samplingBaseline: SamplingBaselineResponse | null
  readonly issues: readonly FrameAuditIssueResponse[]
  readonly channelDiscontinuities: readonly ChannelDiscontinuityResponse[]
}

export type SteeringThresholdDiagnosticsResponse =
  | {
      readonly status: 'calculated'
      readonly lowThresholdDegrees: number
      readonly highThresholdDegrees: number
    }
  | {
      readonly status: 'unavailable'
    }

export type BrakeActivityThresholdDiagnosticsResponse =
  | {
      readonly status: 'calculated'
      readonly lowThresholdRatio: number
      readonly highThresholdRatio: number
    }
  | {
      readonly status: 'unavailable'
    }

export interface AnalysisThresholdsResponse {
  readonly steering: SteeringThresholdDiagnosticsResponse
  readonly brakeActivity: BrakeActivityThresholdDiagnosticsResponse
}

export interface DiagnosticsResponse extends AnalysisResponseContext {
  readonly frameAudit: FrameAuditDiagnosticsResponse
  readonly thresholds: AnalysisThresholdsResponse
  readonly detectorFailures: readonly CoachingDetectorFailureResponse[]
}
