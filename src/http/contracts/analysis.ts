export type AnalysisId = `sha256:${string}`

export interface AnalysisQuery {
  readonly analysisId: AnalysisId
}

export interface AnalysisResponseContext {
  readonly analysisId: AnalysisId
  readonly sessionId: string
}
