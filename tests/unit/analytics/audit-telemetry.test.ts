import { describe, expect, test } from 'bun:test'
import { auditTelemetry } from '../../../src/analytics/audit-telemetry'
import type { FrameAuditConfig } from '../../../src/analytics/frame-audit-types'
import {
  NormalizedTelemetryFrame,
  type NormalizedTelemetryStint,
} from '../../../src/analytics/telemetry-types'

const AUDIT_CONFIG: FrameAuditConfig = {
  sampling: {
    gapMedianMultiplier: 5,
    gapMadMultiplier: 10,
    minimumSampleCount: 10,
  },
  isolatedOutlier: {
    minimumResidualSampleCount: 10,
    signalMadMultiplier: 8,
    driverInputMadMultiplier: 20,
    minimumReturnRateRatio: 0.25,
    fallbackIqrMultiplier: 3,
    minimumResidualBySignalChannel: {
      speedKmh: 0.1,
    },
  },
  channelContinuity: {
    minimumRateSampleCount: 10,
    rateMadMultiplier: 12,
    rateIqrMultiplier: 3,
    windowDurationMultiplier: 5,
    minimumWindowSamples: 4,
    minimumShiftToSpreadRatio: 6,
  },
}

function createTelemetry(): NormalizedTelemetryStint {
  const frames = Array.from({ length: 40 }, (_, sourceIndex) => {
    const timestampOffset = sourceIndex >= 30 ? 1_000 : 0

    return new NormalizedTelemetryFrame({
      sourceIndex,
      timestampMs: sourceIndex * 50 + timestampOffset,
      recordedLapNumber: 1,
      normalizedTrackPosition: sourceIndex / 40,
      speedKmh:
        sourceIndex === 12 ? 1_000 : 100 + sourceIndex * 2,
      throttleRatio: 0.8,
      brakeRatio: 0,
      steeringDegrees: 2,
      gear: 4,
      engineRpm: 5_000 + sourceIndex * 10,
      tyreCoreTemperatureC: {
        frontLeft: 90 + sourceIndex * 0.01,
        frontRight: 91 + sourceIndex * 0.01,
        rearLeft: 92 + sourceIndex * 0.01,
        rearRight: 93 + sourceIndex * 0.01,
      },
    })
  })
  const retained = frames[19]

  frames[20] = new NormalizedTelemetryFrame({
    sourceIndex: 20,
    timestampMs: retained.timestampMs,
    recordedLapNumber: retained.recordedLapNumber,
    normalizedTrackPosition: retained.normalizedTrackPosition,
    speedKmh: retained.speedKmh,
    throttleRatio: retained.throttleRatio,
    brakeRatio: retained.brakeRatio,
    steeringDegrees: retained.steeringDegrees,
    gear: retained.gear,
    engineRpm: retained.engineRpm,
    tyreCoreTemperatureC: retained.tyreCoreTemperatureC,
  })

  return Object.freeze({
    schemaVersion: 'racemake.telemetry.stint.v1',
    sessionId: 'test-session',
    recorder: Object.freeze({ name: 'test', version: '1' }),
    note: '',
    frameCount: frames.length,
    frames: Object.freeze(frames),
  })
}

describe('auditTelemetry', () => {
  test('coordinates timeline and channel-level audit deterministically', () => {
    const telemetry = createTelemetry()
    const first = auditTelemetry(telemetry, AUDIT_CONFIG)
    const second = auditTelemetry(telemetry, AUDIT_CONFIG)

    expect(first).toEqual(second)
    expect(first.frameTransitions).toHaveLength(
      telemetry.frames.length - 1,
    )
    expect(first.timelineTransitions).toContainEqual(
      expect.objectContaining({
        relation: 'exact-duplicate',
      }),
    )
    expect(first.samplingBaseline).not.toBeNull()
    expect(first.isolatedOutliers).toContainEqual(
      expect.objectContaining({
        frame: telemetry.frames[12],
        channel: 'speedKmh',
        usability: 'invalid',
      }),
    )
    expect(first.auditedFrames[12]).toMatchObject({
      frame: telemetry.frames[12],
      suspectChannels: [],
      invalidChannels: ['speedKmh'],
    })
    expect(first.usableTimeline).not.toBeNull()
    expect(first.usableTimeline?.excludedFrames).toContainEqual({
      frame: telemetry.frames[20],
      reason: 'exact-duplicate',
    })
    expect(
      first.usableTimeline?.frames.some(
        (auditedFrame) =>
          auditedFrame.frame === telemetry.frames[12],
      ),
    ).toBeTrue()
    expect(first.usableTimeline?.transitions[11].discontinuousChannels).toContain('speedKmh')
    expect(first.usableTimeline?.transitions[12].discontinuousChannels).toContain('speedKmh')
    expect(first.continuousTimelineSegments).toHaveLength(2)
    expect(
      first.continuousTimelineSegments.map(
        (segment) => segment.frameCount,
      ),
    ).toEqual([29, 10])
    expect(new Set(first.issues.map((issue) => issue.id)).size).toBe(first.issues.length)
    expect(first.issues).toContainEqual(expect.objectContaining({
      id: 'duplicate-sample:20',
      code: 'DUPLICATE_SAMPLE',
      action: 'exclude-frame',
      severity: 'warning',
      scope: 'frame',
      reason: 'exact-adjacent-duplicate',
      sourceIndex: 20,
    }))
    expect(first.issues).toContainEqual(expect.objectContaining({
      id: 'local-outlier:12:speedKmh',
      code: 'LOCAL_OUTLIER',
      action: 'exclude-channel-value',
      severity: 'error',
      scope: 'channel',
      channels: ['speedKmh'],
      observed: expect.objectContaining({ observedValue: 1_000, usability: 'invalid' }),
      thresholds: expect.objectContaining({ residualThreshold: expect.any(Number) }),
    }))
    expect(first.issues).toContainEqual(expect.objectContaining({
      id: 'sampling-gap:29:30',
      code: 'SAMPLING_GAP',
      action: 'split-timeline',
      severity: 'warning',
      scope: 'transition',
      sourceIndex: 29,
      nextSourceIndex: 30,
      thresholds: expect.objectContaining({ maximumGapMs: first.samplingBaseline?.maximumGapMs }),
    }))
    expect(first.issues.every((issue) => issue.message.length > 40)).toBeTrue()
  })

  test('reports when the sampling baseline cannot support dependent analysis', () => {
    const telemetry = createTelemetry()
    const shortTelemetry: NormalizedTelemetryStint = Object.freeze({ ...telemetry, frameCount: 5, frames: Object.freeze(telemetry.frames.slice(0, 5)) })
    const result = auditTelemetry(shortTelemetry, AUDIT_CONFIG)

    expect(result.samplingBaseline).toBeNull()
    expect(result.usableTimeline).toBeNull()
    expect(result.issues).toContainEqual(expect.objectContaining({
      id: 'insufficient-baseline:sampling',
      code: 'INSUFFICIENT_BASELINE',
      action: 'stop-analysis',
      severity: 'error',
      scope: 'dataset',
      reason: 'insufficient-chronological-transitions',
      observed: { chronologicalTransitionCount: 4 },
      thresholds: { minimumChronologicalTransitionCount: 10 },
    }))
  })
})
