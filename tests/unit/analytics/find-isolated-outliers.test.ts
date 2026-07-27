import { describe, expect, test } from 'bun:test'
import {
  findChannelOutliers,
} from '../../../src/analytics/audit/find-isolated-outliers'
import type {
  IsolatedOutlierConfig,
  SamplingBaseline,
} from '../../../src/analytics/frame-audit-types'
import { NormalizedTelemetryFrame } from '../../../src/analytics/telemetry-types'

const SAMPLING_BASELINE: SamplingBaseline = {
  sampleCount: 7,
  medianDeltaMs: 50,
  madDeltaMs: 0,
  scaledMadDeltaMs: 0,
  maximumGapMs: 250,
}

const OUTLIER_CONFIG: IsolatedOutlierConfig = {
  minimumResidualSampleCount: 5,
  signalMadMultiplier: 0,
  driverInputMadMultiplier: 0,
}

function createFrames(
  positions: readonly number[],
  speeds: readonly number[] = positions.map(() => 100),
): readonly NormalizedTelemetryFrame[] {
  return positions.map(
    (normalizedTrackPosition, sourceIndex) =>
      new NormalizedTelemetryFrame({
        sourceIndex,
        timestampMs: sourceIndex * 50,
        recordedLapNumber: 1,
        normalizedTrackPosition,
        speedKmh: speeds[sourceIndex],
        throttleRatio: 0.8,
        brakeRatio: 0,
        steeringDegrees: 2,
        gear: 4,
        engineRpm: 5_000,
        tyreCoreTemperatureC: {
          frontLeft: 90,
          frontRight: 91,
          rearLeft: 92,
          rearRight: 93,
        },
      }),
  )
}

describe('findChannelOutliers', () => {
  test('does not classify a normal start-finish wrap as a position outlier', () => {
    const frames = createFrames([
      0.97,
      0.98,
      0.99,
      0,
      0.01,
      0.02,
      0.03,
    ])

    const positionOutliers = findChannelOutliers(
      frames,
      SAMPLING_BASELINE,
      OUTLIER_CONFIG,
    ).filter(
      (outlier) =>
        outlier.channel ===
        'normalizedTrackPosition',
    )

    expect(positionOutliers).toEqual([])
  })

  test('finds an isolated position error at the start-finish wrap', () => {
    const frames = createFrames([
      0.97,
      0.98,
      0.99,
      0.5,
      0.01,
      0.02,
      0.03,
    ])

    const positionOutliers = findChannelOutliers(
      frames,
      SAMPLING_BASELINE,
      OUTLIER_CONFIG,
    ).filter(
      (outlier) =>
        outlier.channel ===
        'normalizedTrackPosition',
    )

    expect(positionOutliers).toContainEqual(
      expect.objectContaining({
        frame: frames[3],
        observedValue: 0.5,
        predictedValue: 0,
        residual: 0.5,
      }),
    )
  })

  test('runs signal auditing after timestamp auditing', () => {
    const positions = [
      0.1,
      0.11,
      0.12,
      0.13,
      0.14,
      0.15,
      0.16,
    ]
    const frames = createFrames(
      positions,
      [100, 101, 102, 1_000, 104, 105, 106],
    )

    const speedOutliers = findChannelOutliers(
      frames,
      SAMPLING_BASELINE,
      OUTLIER_CONFIG,
    ).filter(
      (outlier) => outlier.channel === 'speedKmh',
    )

    expect(speedOutliers).toContainEqual(
      expect.objectContaining({
        frame: frames[3],
        observedValue: 1_000,
        predictedValue: 103,
        residual: 897,
      }),
    )
  })
})
