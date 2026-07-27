import { describe, expect, test } from 'bun:test'
import { computeSamplingBaseline } from '../../../src/analytics/audit/compute-sampling-baseline'
import type {
  FrameTransitionRelation,
  TimelineTransition,
} from '../../../src/analytics/frame-audit-types'
import { NormalizedTelemetryFrame } from '../../../src/analytics/telemetry-types'

const SAMPLING_CONFIG = {
  minimumSampleCount: 3,
  gapMedianMultiplier: 5,
  gapMadMultiplier: 10,
}

function createFrame(
  sourceIndex: number,
  timestampMs: number,
): NormalizedTelemetryFrame {
  return new NormalizedTelemetryFrame({
    sourceIndex,
    timestampMs,
    recordedLapNumber: 1,
    normalizedTrackPosition: sourceIndex / 100,
    speedKmh: 200,
    throttleRatio: 1,
    brakeRatio: 0,
    steeringDegrees: 0,
    gear: 5,
    engineRpm: 7_000,
    tyreCoreTemperatureC: {
      frontLeft: 90,
      frontRight: 90,
      rearLeft: 90,
      rearRight: 90,
    },
  })
}

function createTransition(
  transitionIndex: number,
  timestampDeltaMs: number,
  relation: FrameTransitionRelation,
): TimelineTransition {
  const previousTimestampMs = 1_000

  return {
    previous: createFrame(
      transitionIndex * 2,
      previousTimestampMs,
    ),
    current: createFrame(
      transitionIndex * 2 + 1,
      previousTimestampMs + timestampDeltaMs,
    ),
    timestampDeltaMs,
    relation,
  }
}

describe('computeSamplingBaseline', () => {
  test('uses only chronological transitions', () => {
    const transitions = [
      createTransition(0, 40, 'chronological'),
      createTransition(1, 50, 'chronological'),
      createTransition(2, 60, 'chronological'),
      createTransition(3, 0, 'exact-duplicate'),
      createTransition(4, 0, 'same-timestamp-conflict'),
      createTransition(5, -200, 'timestamp-regression'),
    ]

    const baseline =
      computeSamplingBaseline(transitions, SAMPLING_CONFIG)

    expect(baseline).not.toBeNull()
    expect(baseline?.sampleCount).toBe(3)
    expect(baseline?.medianDeltaMs).toBe(50)
    expect(baseline?.madDeltaMs).toBe(10)
    expect(baseline?.scaledMadDeltaMs).toBeCloseTo(14.826)
    expect(baseline?.maximumGapMs).toBe(250)
  })

  test('uses the robust-scale limit when it exceeds the median limit', () => {
    const transitions = [
      createTransition(0, 10, 'chronological'),
      createTransition(1, 20, 'chronological'),
      createTransition(2, 30, 'chronological'),
    ]
    const config = {
      ...SAMPLING_CONFIG,
      gapMedianMultiplier: 2,
      gapMadMultiplier: 3,
    }
    const baseline = computeSamplingBaseline(transitions, config)

    expect(baseline).not.toBeNull()
    expect(baseline?.sampleCount).toBe(3)
    expect(baseline?.medianDeltaMs).toBe(20)
    expect(baseline?.madDeltaMs).toBe(10)
    expect(baseline?.scaledMadDeltaMs).toBeCloseTo(14.826)
    expect(baseline?.maximumGapMs).toBeCloseTo(64.478)
  })

  test('returns null without enough chronological transitions', () => {
    const transitions = [
      createTransition(0, 50, 'chronological'),
      createTransition(1, 60, 'chronological'),
      createTransition(2, 0, 'exact-duplicate'),
      createTransition(3, -10, 'timestamp-regression'),
    ]

    expect(
      computeSamplingBaseline(transitions, SAMPLING_CONFIG),
    ).toBeNull()
  })
})
