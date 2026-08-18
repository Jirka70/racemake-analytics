import type { SteeringStrengthThresholdResult } from '../analytics/corner-detect/derive-steering-strength-thresholds'
import type { CoachingDetectorFailure } from '../analytics/coach/phenomena/coaching-phenomenon-types'
import type { BrakeActivityThresholdResult } from '../analytics/coach/phenomena/braking/brake-activity-thresholds'
import type { ProcessingIssue } from '../analytics/frame-audit-types'
import { findAnalysisUsability } from '../application/analysis-usability'
import type { AnalysisStore } from './analysis-store'
import type { CoachingDetectorFailureResponse } from './contracts/coaching'
import type {
  BrakeActivityThresholdDiagnosticsResponse,
  DiagnosticsResponse,
  FrameAuditIssueResponse,
  SteeringThresholdDiagnosticsResponse,
} from './contracts/diagnostics'
import { getAnalysis } from './get-analysis'

export function getDiagnostics(
  query: unknown,
  analysisStore: AnalysisStore,
): DiagnosticsResponse {
  const { analysisId, analysis } = getAnalysis(query, analysisStore)
  const audit = analysis.auditResult
  const samplingBaseline = audit.samplingBaseline
  const steeringThresholds =
    analysis.cornerDetectionResult.steeringStrengthThresholdResult
  const coaching = analysis.coachCallsResult.coachingPhenomena
  const brakeThresholds = coaching.signalThresholdResults.brakeActivity

  return {
    analysisId,
    sessionId: analysis.normalizedTelemetry.sessionId,
    usability: findAnalysisUsability(analysis),
    frameAudit: {
      receivedFrameCount: analysis.validatedWirePayload.frames.length,
      retainedTimelineFrameCount: audit.usableTimeline?.frames.length ?? 0,
      excludedTimelineFrameCount: audit.usableTimeline
        ? audit.usableTimeline.excludedFrames.length
        : analysis.validatedWirePayload.frames.length,
      samplingBaseline: samplingBaseline
        ? {
            medianIntervalMs: samplingBaseline.medianDeltaMs,
            maximumContinuousIntervalMs: samplingBaseline.maximumGapMs,
          }
        : null,
      issues: audit.issues.map(createFrameAuditIssueResponse),
      channelDiscontinuities: audit.channelDiscontinuities.map(
        (discontinuity) => ({
          previousSourceIndex: discontinuity.previousSourceIndex,
          currentSourceIndex: discontinuity.currentSourceIndex,
          channels: discontinuity.channels,
        }),
      ),
    },
    thresholds: {
      steering: createSteeringThresholdResponse(steeringThresholds),
      brakeActivity: createBrakeThresholdResponse(brakeThresholds),
    },
    detectorFailures: coaching.detectorFailures.map(
      createDetectorFailureResponse,
    ),
  }
}

function createFrameAuditIssueResponse(
  issue: ProcessingIssue,
): FrameAuditIssueResponse {
  return {
    id: issue.id,
    code: issue.code,
    action: issue.action,
    severity: issue.severity,
    scope: issue.scope,
    message: issue.message,
    ...(issue.sourceIndex === undefined
      ? {}
      : { sourceIndex: issue.sourceIndex }),
    ...(issue.timestampMs === undefined
      ? {}
      : { timestampMs: issue.timestampMs }),
    ...(issue.channels === undefined
      ? {}
      : { channels: issue.channels }),
  }
}

function createSteeringThresholdResponse(
  thresholds: SteeringStrengthThresholdResult,
): SteeringThresholdDiagnosticsResponse {
  if (thresholds.status === 'unavailable') {
    return { status: thresholds.status }
  }

  return {
    status: thresholds.status,
    lowThresholdDegrees: thresholds.lowThresholdDegrees,
    highThresholdDegrees: thresholds.highThresholdDegrees,
  }
}

function createBrakeThresholdResponse(
  thresholds: BrakeActivityThresholdResult,
): BrakeActivityThresholdDiagnosticsResponse {
  if (thresholds.status === 'unavailable') {
    return { status: thresholds.status }
  }

  return {
    status: thresholds.status,
    lowThresholdRatio: thresholds.lowThresholdRatio,
    highThresholdRatio: thresholds.highThresholdRatio,
  }
}

function createDetectorFailureResponse(
  failure: CoachingDetectorFailure,
): CoachingDetectorFailureResponse {
  return {
    code: failure.code,
    phenomena: failure.phenomena,
    lapNumber: failure.lapNumber,
    trackRegionId: failure.trackRegionId,
    errorName: failure.errorName,
  }
}
