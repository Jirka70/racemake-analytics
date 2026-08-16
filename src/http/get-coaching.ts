import type { AnalysisStore } from './analysis-store'
import type { CoachingResponse } from './contracts/coaching'
import { getAnalysis } from './get-analysis'

export function getCoaching(
  query: unknown,
  analysisStore: AnalysisStore,
): CoachingResponse {
  const { analysisId, analysis } = getAnalysis(query, analysisStore)
  const { rankedPhenomena, detectorFailures } =
    analysis.coachCallsResult.coachingPhenomena

  return {
    analysisId,
    sessionId: analysis.normalizedTelemetry.sessionId,
    rankedPhenomena: rankedPhenomena.map(
      ({ rank, priority, finding }) => ({
        rank,
        priority,
        finding: {
          phenomenon: finding.phenomenon,
          lapNumber: finding.lapNumber,
          comparedWithLapNumber: finding.comparedWithLapNumber,
          analysisRegionId: finding.analysisRegionId,
          occurredAtLapElapsedMs: finding.occurredAtLapElapsedMs,
          impactTimeLossMs: finding.impactTimeLossMs,
          message: finding.message,
          evidence: finding.evidence.map((evidence) => ({
            channels: evidence.channels,
            message: evidence.message,
          })),
          metrics: finding.metrics,
          limitations: finding.limitations.map((limitation) => ({
            code: limitation.code,
            message: limitation.message,
          })),
        },
      }),
    ),
    detectorFailures: detectorFailures.map((failure) => ({
      code: failure.code,
      phenomena: failure.phenomena,
      lapNumber: failure.lapNumber,
      trackRegionId: failure.trackRegionId,
      errorName: failure.errorName,
    })),
  }
}
