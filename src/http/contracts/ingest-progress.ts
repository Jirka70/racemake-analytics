import type {
  AnalysisProgress,
  AnalysisProgressDetails,
  AnalysisStage,
} from '../../application/analysis-progress'
import type { ApiErrorResponse } from '../api-errors'
import type { IngestResponse } from './ingest'

export { ANALYSIS_STAGES } from '../../application/analysis-progress'
export type {
  AnalysisProgress,
  AnalysisProgressDetails,
  AnalysisStage,
}

export interface AnalysisProgressEvent extends AnalysisProgress {
  readonly type: 'progress'
}

export type IngestStreamEvent =
  | AnalysisProgressEvent
  | {
      readonly type: 'completed'
      readonly response: IngestResponse
    }
  | {
      readonly type: 'failed'
      readonly error: ApiErrorResponse['error']
    }
