import { auditTelemetry } from '../analytics/audit-telemetry'
import {
  detectCorners,
  type CornerDetectionResult,
} from '../analytics/corner-detect/detect-corners'
import {
  createCoachCalls,
  type CoachCallsResult,
} from '../analytics/coach/create-coach-calls'
import { detectLaps } from '../analytics/lap-detect/detect-laps'
import type {
  FrameAuditConfig,
  TelemetryAuditResult,
} from '../analytics/frame-audit-types'
import type {
  LapDetectionConfig,
  LapDetectionResult,
} from '../analytics/lap-detect/lap-detect-types'
import { DEFAULT_LAP_DETECTION_CONFIG } from '../analytics/lap-detect/config/lap-detection-config'
import { normalizeTelemetryPayload } from '../analytics/normalize-telemetry'
import type {
  NormalizedTelemetryStint,
  WireTelemetryPayload,
} from '../analytics/telemetry-types'
import { telemetryPayloadSchema } from '../http/schemas/telemetry-payload'
import { zValidate } from '../http/z-validate'
import {
  ANALYSIS_STAGES,
  type AnalysisProgressDetails,
  type AnalysisStage,
  type ReportAnalysisProgress,
} from './analysis-progress'

export interface TelemetryAuditPipelineResult {
  readonly validatedWirePayload: WireTelemetryPayload
  readonly normalizedTelemetry: NormalizedTelemetryStint
  readonly auditResult: TelemetryAuditResult
  readonly lapDetectionResult: LapDetectionResult
  readonly cornerDetectionResult: CornerDetectionResult
  readonly coachCallsResult: CoachCallsResult
}

/**
 * Runs the production pipeline through the current lap-detection scaffold.
 *
 * Keeping these stages together gives the CLI runner and integration tests one
 * path to exercise while position calibration is rebuilt into lap detection.
 */
export function runTelemetryAuditPipeline(
  input: unknown,
  config: FrameAuditConfig,
  lapDetectionConfig: LapDetectionConfig =
    DEFAULT_LAP_DETECTION_CONFIG,
): TelemetryAuditPipelineResult {
  const validatedWirePayload = zValidate(telemetryPayloadSchema, input)
  const normalizedTelemetry = normalizeTelemetryPayload(validatedWirePayload)
  const auditResult = auditTelemetry(normalizedTelemetry, config)
  const lapDetectionResult = detectLaps(
    auditResult,
    lapDetectionConfig,
  )
  const cornerDetectionResult = detectCorners(
    auditResult,
    lapDetectionResult,
  )
  const coachCallsResult = createCoachCalls(
    auditResult.usableTimeline,
    lapDetectionResult,
    cornerDetectionResult.corners,
  )

  return Object.freeze({
    validatedWirePayload,
    normalizedTelemetry,
    auditResult,
    lapDetectionResult,
    cornerDetectionResult,
    coachCallsResult,
  })
}

export async function runTelemetryAuditPipelineWithProgress(
  validatedWirePayload: WireTelemetryPayload,
  config: FrameAuditConfig,
  reportProgress: ReportAnalysisProgress,
  lapDetectionConfig: LapDetectionConfig =
    DEFAULT_LAP_DETECTION_CONFIG,
): Promise<TelemetryAuditPipelineResult> {
  const normalizedTelemetry = await runAnalysisStage(
    'NORMALIZING_TELEMETRY',
    1,
    reportProgress,
    () => normalizeTelemetryPayload(validatedWirePayload),
  )
  const auditResult = await runAnalysisStage(
    'AUDITING_TELEMETRY',
    2,
    reportProgress,
    () => auditTelemetry(normalizedTelemetry, config),
    (result) => ({
      retainedTimelineFrameCount:
        result.usableTimeline?.frames.length ?? 0,
      excludedTimelineFrameCount:
        result.usableTimeline?.excludedFrames.length
        ?? validatedWirePayload.frames.length,
    }),
  )
  const lapDetectionResult = await runAnalysisStage(
    'DETECTING_LAPS',
    3,
    reportProgress,
    () => detectLaps(auditResult, lapDetectionConfig),
    (result) => ({
      detectedLapCount: result.laps.length,
    }),
  )
  const cornerDetectionResult = await runAnalysisStage(
    'DETECTING_CORNERS',
    4,
    reportProgress,
    () => detectCorners(auditResult, lapDetectionResult),
    (result) => ({
      detectedCornerCount: result.corners.length,
    }),
  )
  const coachCallsResult = await runAnalysisStage(
    'CREATING_COACHING_FINDINGS',
    5,
    reportProgress,
    () => createCoachCalls(
      auditResult.usableTimeline,
      lapDetectionResult,
      cornerDetectionResult.corners,
    ),
    (result) => ({
      racingLapCount: result.racingLaps.length,
      rankedPhenomenonCount:
        result.coachingPhenomena.rankedPhenomena.length,
      detectorFailureCount:
        result.coachingPhenomena.detectorFailures.length,
    }),
  )

  return Object.freeze({
    validatedWirePayload,
    normalizedTelemetry,
    auditResult,
    lapDetectionResult,
    cornerDetectionResult,
    coachCallsResult,
  })
}

async function runAnalysisStage<Result>(
  stage: AnalysisStage,
  completedStageCount: number,
  reportProgress: ReportAnalysisProgress,
  calculate: () => Result,
  getDetails?: (result: Result) => AnalysisProgressDetails,
): Promise<Result> {
  await reportProgress({
    stage,
    status: 'running',
    completedStageCount,
    totalStageCount: ANALYSIS_STAGES.length,
  })

  const result = calculate()
  const details = getDetails?.(result)

  await reportProgress({
    stage,
    status: 'completed',
    completedStageCount: completedStageCount + 1,
    totalStageCount: ANALYSIS_STAGES.length,
    ...(details ? { details } : {}),
  })

  return result
}
