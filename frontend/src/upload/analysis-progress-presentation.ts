import {
  ANALYSIS_STAGES,
  type AnalysisProgressEvent,
  type AnalysisStage,
} from '../../../src/http/contracts'

interface AnalysisStageMessages {
  readonly pending: string
  readonly running: string
  readonly completed: string
}

const ANALYSIS_STAGE_MESSAGES: Record<
  AnalysisStage,
  AnalysisStageMessages
> = {
  VALIDATING_TELEMETRY: {
    pending: 'Check telemetry file',
    running: 'Checking telemetry file…',
    completed: 'Telemetry file checked',
  },
  NORMALIZING_TELEMETRY: {
    pending: 'Prepare telemetry',
    running: 'Preparing telemetry…',
    completed: 'Telemetry prepared',
  },
  AUDITING_TELEMETRY: {
    pending: 'Check telemetry quality',
    running: 'Checking telemetry quality…',
    completed: 'Telemetry quality checked',
  },
  DETECTING_LAPS: {
    pending: 'Find laps',
    running: 'Finding laps…',
    completed: 'Laps found',
  },
  DETECTING_CORNERS: {
    pending: 'Map the track',
    running: 'Mapping the track…',
    completed: 'Track mapped',
  },
  CREATING_COACHING_FINDINGS: {
    pending: 'Compare your driving',
    running: 'Comparing your driving…',
    completed: 'Driving comparison completed',
  },
}

export type AnalysisStageVisualStatus =
  | 'pending'
  | 'running'
  | 'completed'

export function calculateAnalysisProgressPercentage(
  events: readonly AnalysisProgressEvent[],
): number {
  const latestEvent = events.at(-1)
  if (!latestEvent) return 0

  return Math.round(
    Math.min(
      1,
      latestEvent.completedStageCount
      / latestEvent.totalStageCount,
    ) * 100,
  )
}

export function findCurrentAnalysisMessage(
  events: readonly AnalysisProgressEvent[],
): string {
  const latestEvent = events.at(-1)
  if (!latestEvent) {
    return ANALYSIS_STAGE_MESSAGES.VALIDATING_TELEMETRY.running
  }

  return ANALYSIS_STAGE_MESSAGES[latestEvent.stage][latestEvent.status]
}

export function findAnalysisStageEvent(
  stage: AnalysisStage,
  events: readonly AnalysisProgressEvent[],
): AnalysisProgressEvent | null {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (event?.stage === stage) return event
  }

  return null
}

export function findAnalysisStageVisualStatus(
  stage: AnalysisStage,
  event: AnalysisProgressEvent | null,
  hasProgressStarted: boolean,
): AnalysisStageVisualStatus {
  if (event) return event.status

  if (!hasProgressStarted && stage === ANALYSIS_STAGES[0]) {
    return 'running'
  }

  return 'pending'
}

export function formatAnalysisStageMessage(
  stage: AnalysisStage,
  status: AnalysisStageVisualStatus,
  event: AnalysisProgressEvent | null,
): string {
  if (status !== 'completed' || !event?.details) {
    return ANALYSIS_STAGE_MESSAGES[stage][status]
  }

  const details = event.details

  if (
    stage === 'VALIDATING_TELEMETRY'
    && details.receivedFrameCount !== undefined
  ) {
    return `${formatCount(details.receivedFrameCount)} telemetry samples checked`
  }

  if (
    stage === 'AUDITING_TELEMETRY'
    && details.excludedTimelineFrameCount
  ) {
    return `${formatCount(details.excludedTimelineFrameCount)} unreliable samples excluded`
  }

  if (
    stage === 'DETECTING_LAPS'
    && details.detectedLapCount !== undefined
  ) {
    return `${formatCount(details.detectedLapCount)} laps found`
  }

  if (
    stage === 'DETECTING_CORNERS'
    && details.detectedCornerCount !== undefined
  ) {
    return `${formatCount(details.detectedCornerCount)} corners mapped`
  }

  if (
    stage === 'CREATING_COACHING_FINDINGS'
    && details.rankedPhenomenonCount !== undefined
  ) {
    return `${formatCount(details.rankedPhenomenonCount)} coaching findings prepared`
  }

  return ANALYSIS_STAGE_MESSAGES[stage].completed
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}
