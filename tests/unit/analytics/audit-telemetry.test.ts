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
    gapRobustScaleMultiplier: 10,
    minimumBaselineSamples: 10,
  },
  localOutlier: {
    spikeMadMultiplier: 8,
    persistenceWindowDeltaMultiplier: 5,
    minimumWindowSamples: 1,
    fallbackQuantile: 0.9,
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
    expect(first.telemetry).toBe(telemetry)
    expect(first.issues.map((issue) => issue.code)).toContain(
      'DUPLICATE_SAMPLE',
    )
    expect(first.issues.map((issue) => issue.code)).toContain(
      'SAMPLING_GAP',
    )
    expect(first.issues).toContainEqual(
      expect.objectContaining({
        code: 'LOCAL_OUTLIER',
        sourceIndex: 12,
        channels: ['speedKmh'],
      }),
    )
    expect(first.diagnostics).toMatchObject({
      inputFrameCount: 40,
      acceptedFrameCount: 38,
      suspectFrameCount: 1,
      rejectedFrameCount: 1,
      continuousSegmentCount: 3,
      invalidChannelValueCounts: {
        speedKmh: 1,
      },
      sampling: {
        detectedGapCount: 1,
      },
    })
  })
})
