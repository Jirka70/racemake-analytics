import type { FrameAuditConfig } from '../analytics/frame-audit-types'
import {
  ANALYSIS_STAGES,
  type ReportAnalysisProgress,
} from '../application/analysis-progress'
import {
  runTelemetryAuditPipeline,
  runTelemetryAuditPipelineWithProgress,
  type TelemetryAuditPipelineResult,
} from '../application/telemetry-audit-pipeline'
import type { WireTelemetryPayload } from '../analytics/telemetry-types'
import type { AnalysisStore } from './analysis-store'
import type { IngestResponse } from './contracts/ingest'
import { createAnalysisId } from './create-analysis-id'
import { telemetryPayloadSchema } from './schemas/telemetry-payload'
import { zValidate } from './z-validate'

export interface IngestTelemetryAnalysisDependencies {
  readonly analysisStore: AnalysisStore
  readonly frameAuditConfig: FrameAuditConfig
}

export function ingestTelemetryAnalysis(
  input: unknown,
  dependencies: IngestTelemetryAnalysisDependencies,
): IngestResponse {
  const validatedWirePayload = zValidate(telemetryPayloadSchema, input)
  return ingestValidatedTelemetryAnalysis(
    validatedWirePayload,
    dependencies,
  )
}

export async function ingestValidatedTelemetryAnalysisWithProgress(
  validatedWirePayload: WireTelemetryPayload,
  dependencies: IngestTelemetryAnalysisDependencies,
  reportProgress: ReportAnalysisProgress,
): Promise<IngestResponse> {
  await reportProgress({
    stage: 'VALIDATING_TELEMETRY',
    status: 'completed',
    completedStageCount: 1,
    totalStageCount: ANALYSIS_STAGES.length,
    details: {
      receivedFrameCount: validatedWirePayload.frames.length,
    },
  })

  const analysisId = createAnalysisId(validatedWirePayload)
  const cachedAnalysis = dependencies.analysisStore.get(analysisId)
  const analysis = cachedAnalysis
    ?? await runTelemetryAuditPipelineWithProgress(
      validatedWirePayload,
      dependencies.frameAuditConfig,
      reportProgress,
    )

  if (!cachedAnalysis) {
    dependencies.analysisStore.set(analysisId, analysis)
  }

  return createIngestResponse(
    analysisId,
    analysis,
    cachedAnalysis !== null,
  )
}

function ingestValidatedTelemetryAnalysis(
  validatedWirePayload: WireTelemetryPayload,
  dependencies: IngestTelemetryAnalysisDependencies,
): IngestResponse {
  const analysisId = createAnalysisId(validatedWirePayload)
  const cachedAnalysis = dependencies.analysisStore.get(analysisId)
  const analysis = cachedAnalysis ?? runTelemetryAuditPipeline(
    validatedWirePayload,
    dependencies.frameAuditConfig,
  )

  if (!cachedAnalysis) {
    dependencies.analysisStore.set(analysisId, analysis)
  }

  return createIngestResponse(
    analysisId,
    analysis,
    cachedAnalysis !== null,
  )
}

function createIngestResponse(
  analysisId: IngestResponse['analysisId'],
  analysis: TelemetryAuditPipelineResult,
  cacheHit: boolean,
): IngestResponse {
  const {
    validatedWirePayload,
    normalizedTelemetry,
    auditResult,
    lapDetectionResult,
    cornerDetectionResult,
    coachCallsResult,
  } = analysis
  const coachingPhenomena = coachCallsResult.coachingPhenomena

  return {
    analysisId,
    sessionId: normalizedTelemetry.sessionId,
    telemetrySchema: normalizedTelemetry.schemaVersion,
    status: 'ready',
    cacheHit,
    receivedFrameCount: validatedWirePayload.frames.length,
    retainedTimelineFrameCount: auditResult.usableTimeline?.frames.length ?? 0,
    excludedTimelineFrameCount:
      auditResult.usableTimeline?.excludedFrames.length
      ?? validatedWirePayload.frames.length,
    detectedLapCount: lapDetectionResult.laps.length,
    racingLapCount: coachCallsResult.racingLaps.length,
    detectedCornerCount: cornerDetectionResult.corners.length,
    rankedPhenomenonCount: coachingPhenomena.rankedPhenomena.length,
    detectorFailureCount: coachingPhenomena.detectorFailures.length,
  }
}
