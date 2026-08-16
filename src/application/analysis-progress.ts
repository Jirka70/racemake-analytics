export const ANALYSIS_STAGES = [
  'VALIDATING_TELEMETRY',
  'NORMALIZING_TELEMETRY',
  'AUDITING_TELEMETRY',
  'DETECTING_LAPS',
  'DETECTING_CORNERS',
  'CREATING_COACHING_FINDINGS',
] as const

export type AnalysisStage = typeof ANALYSIS_STAGES[number]

export interface AnalysisProgressDetails {
  readonly receivedFrameCount?: number
  readonly retainedTimelineFrameCount?: number
  readonly excludedTimelineFrameCount?: number
  readonly detectedLapCount?: number
  readonly racingLapCount?: number
  readonly detectedCornerCount?: number
  readonly rankedPhenomenonCount?: number
  readonly detectorFailureCount?: number
}

export interface AnalysisProgress {
  readonly stage: AnalysisStage
  readonly status: 'running' | 'completed'
  readonly completedStageCount: number
  readonly totalStageCount: number
  readonly details?: AnalysisProgressDetails
}

export type ReportAnalysisProgress = (
  progress: AnalysisProgress,
) => void | Promise<void>
