import type { FrameAuditConfig } from '../analytics/frame-audit-types'
import { runTelemetryAuditPipeline } from '../application/telemetry-audit-pipeline'
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
  const analysisId = createAnalysisId(validatedWirePayload)
  const cachedAnalysis = dependencies.analysisStore.get(analysisId)
  const analysis = cachedAnalysis ?? runTelemetryAuditPipeline(
    validatedWirePayload,
    dependencies.frameAuditConfig,
  )

  if (!cachedAnalysis) {
    dependencies.analysisStore.set(analysisId, analysis)
  }

  const {
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
    cacheHit: cachedAnalysis !== null,
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
