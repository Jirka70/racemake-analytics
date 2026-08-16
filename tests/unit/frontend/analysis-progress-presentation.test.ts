import { describe, expect, test } from 'bun:test'
import {
  calculateAnalysisProgressPercentage,
  findAnalysisStageEvent,
  formatAnalysisStageMessage,
} from '../../../frontend/src/upload/analysis-progress-presentation'
import type { AnalysisProgressEvent } from '../../../src/http/contracts'

const LAP_PROGRESS_EVENT: AnalysisProgressEvent = {
  type: 'progress',
  stage: 'DETECTING_LAPS',
  status: 'completed',
  completedStageCount: 4,
  totalStageCount: 6,
  details: {
    detectedLapCount: 3,
  },
}

describe('analysis progress presentation', () => {
  test('calculates percentage from completed pipeline stages', () => {
    expect(calculateAnalysisProgressPercentage([])).toBe(0)
    expect(calculateAnalysisProgressPercentage([
      LAP_PROGRESS_EVENT,
    ])).toBe(67)
  })

  test('keeps the latest event for a stage and reports measured details', () => {
    const runningEvent: AnalysisProgressEvent = {
      ...LAP_PROGRESS_EVENT,
      status: 'running',
      completedStageCount: 3,
      details: undefined,
    }
    const event = findAnalysisStageEvent(
      'DETECTING_LAPS',
      [runningEvent, LAP_PROGRESS_EVENT],
    )

    expect(event).toBe(LAP_PROGRESS_EVENT)
    expect(formatAnalysisStageMessage(
      'DETECTING_LAPS',
      'completed',
      event,
    )).toBe('3 laps found')
  })
})
