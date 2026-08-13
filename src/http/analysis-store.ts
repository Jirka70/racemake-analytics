import type { TelemetryAuditPipelineResult } from '../application/telemetry-audit-pipeline'
import type { AnalysisId } from './contracts/analysis'

export interface AnalysisStore {
  readonly get: (
    analysisId: AnalysisId,
  ) => TelemetryAuditPipelineResult | null
  readonly set: (
    analysisId: AnalysisId,
    analysis: TelemetryAuditPipelineResult,
  ) => void
}

export interface InMemoryAnalysisStoreConfig {
  readonly maximumEntryCount: number
}

export function createInMemoryAnalysisStore(
  config: InMemoryAnalysisStoreConfig,
): AnalysisStore {
  if (
    !Number.isInteger(config.maximumEntryCount) ||
    config.maximumEntryCount <= 0
  ) {
    throw new RangeError(
      'maximumEntryCount must be a positive integer',
    )
  }

  const analyses = new Map<AnalysisId, TelemetryAuditPipelineResult>()

  return {
    get: (analysisId) => {
      const analysis = analyses.get(analysisId)
      if (!analysis) return null

      analyses.delete(analysisId)
      analyses.set(analysisId, analysis)
      return analysis
    },
    set: (analysisId, analysis) => {
      analyses.delete(analysisId)
      analyses.set(analysisId, analysis)

      while (analyses.size > config.maximumEntryCount) {
        const oldestAnalysisId = analyses.keys().next().value
        if (oldestAnalysisId === undefined) break
        analyses.delete(oldestAnalysisId)
      }
    },
  }
}
