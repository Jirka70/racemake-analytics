import { describe, expect, test } from 'bun:test'
import type { ProcessingIssue } from '../../../src/analytics/frame-audit-types'
import {
  classifyFrameUsabilityFromIssues,
  countFramesByDisposition,
  countInvalidValuesByChannel,
} from '../../../src/analytics/frame-usability'
import { NormalizedTelemetryFrame } from '../../../src/analytics/telemetry-types'

function createFrame(sourceIndex: number): NormalizedTelemetryFrame {
  return new NormalizedTelemetryFrame({
    sourceIndex,
    timestampMs: sourceIndex * 50,
    recordedLapNumber: 1,
    normalizedTrackPosition: sourceIndex / 10,
    speedKmh: 100,
    throttleRatio: 1,
    brakeRatio: 0,
    steeringDegrees: 0,
    gear: 3,
    engineRpm: 5_000,
    tyreCoreTemperatureC: {
      frontLeft: 90,
      frontRight: 90,
      rearLeft: 90,
      rearRight: 90,
    },
  })
}

describe('frame usability', () => {
  test('classifies frame rejection separately from channel rejection', () => {
    const issues: readonly ProcessingIssue[] = [
      {
        code: 'LOCAL_OUTLIER',
        reason: 'isolated-signal-spike',
        severity: 'error',
        action: 'exclude-channel-value',
        scope: 'channel',
        sourceIndex: 1,
        channels: ['speedKmh'],
        message: 'speed spike',
      },
      {
        code: 'DUPLICATE_SAMPLE',
        reason: 'exact-consecutive-duplicate',
        severity: 'error',
        action: 'exclude-frame',
        scope: 'frame',
        sourceIndex: 2,
        message: 'duplicate',
      },
      {
        code: 'INSUFFICIENT_BASELINE',
        reason: 'sampling-baseline-too-small',
        severity: 'warning',
        action: 'retain',
        scope: 'dataset',
        message: 'dataset warning',
      },
    ]
    const audited = classifyFrameUsabilityFromIssues(
      [createFrame(0), createFrame(1), createFrame(2)],
      issues,
    )

    expect(audited.map((frame) => frame.disposition)).toEqual([
      'accepted',
      'suspect',
      'rejected',
    ])
    expect(audited[1].invalidChannels).toEqual(['speedKmh'])
    expect(audited[0].issues).toEqual([])
  })

  test('counts dispositions and invalid values by channel', () => {
    const issues: readonly ProcessingIssue[] = [
      {
        code: 'LOCAL_OUTLIER',
        reason: 'test',
        severity: 'error',
        action: 'exclude-channel-value',
        scope: 'channel',
        sourceIndex: 0,
        channels: ['speedKmh', 'engineRpm'],
        message: 'test',
      },
      {
        code: 'LOCAL_OUTLIER',
        reason: 'test',
        severity: 'error',
        action: 'exclude-channel-value',
        scope: 'channel',
        sourceIndex: 1,
        channels: ['speedKmh'],
        message: 'test',
      },
    ]
    const audited = classifyFrameUsabilityFromIssues(
      [createFrame(0), createFrame(1), createFrame(2)],
      issues,
    )

    expect(countFramesByDisposition(audited)).toEqual({
      accepted: 1,
      suspect: 2,
      rejected: 0,
    })
    expect(countInvalidValuesByChannel(audited)).toEqual({
      speedKmh: 2,
      engineRpm: 1,
    })
  })
})
