import type { ZodType } from 'zod'
import type { TelemetryAuditPipelineResult } from '../application/telemetry-audit-pipeline'
import type { AnalysisStore } from './analysis-store'
import { ApiRequestError } from './api-request-error'
import type {
  AnalysisId,
  AnalysisQuery,
} from './contracts/analysis'
import { analysisQuerySchema } from './schemas/analysis-query'

export interface GetAnalysisResult {
  readonly analysisId: AnalysisId
  readonly analysis: TelemetryAuditPipelineResult
}

export function getAnalysis(
  query: unknown,
  analysisStore: AnalysisStore,
): GetAnalysisResult {
  const { analysisId } = parseAnalysisQuery(
    query,
    analysisQuerySchema,
  )

  return getAnalysisById(analysisId, analysisStore)
}

export function parseAnalysisQuery<Query extends AnalysisQuery>(
  query: unknown,
  schema: ZodType<Query>,
): Query {
  const queryResult = schema.safeParse(query)
  if (!queryResult.success) {
    if (!hasAnalysisId(query)) {
      throw new ApiRequestError('ANALYSIS_ID_REQUIRED')
    }

    throw new ApiRequestError(
      'INVALID_QUERY',
      queryResult.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    )
  }

  return queryResult.data
}

export function getAnalysisById(
  analysisId: AnalysisId,
  analysisStore: AnalysisStore,
): GetAnalysisResult {
  const analysis = analysisStore.get(analysisId)
  if (!analysis) {
    throw new ApiRequestError('ANALYSIS_NOT_FOUND')
  }

  return {
    analysisId,
    analysis,
  }
}

function hasAnalysisId(query: unknown): boolean {
  return typeof query === 'object'
    && query !== null
    && 'analysisId' in query
}
