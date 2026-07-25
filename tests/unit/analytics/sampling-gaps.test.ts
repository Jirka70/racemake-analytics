import { describe, expect, test } from 'bun:test'
import type { SamplingAuditConfig } from '../../../src/analytics/frame-audit-types'
import { analyzeSamplingGaps } from '../../../src/analytics/sampling-gaps'
import { NormalizedTelemetryFrame } from '../../../src/analytics/telemetry-types'

const TEST_CONFIG: SamplingAuditConfig = {
  gapMedianMultiplier: 5,
  gapRobustScaleMultiplier: 10,
  minimumBaselineSamples: 3,
}

function createFrames(
  timestampsMs: readonly number[],
): readonly NormalizedTelemetryFrame[] {
  return timestampsMs.map(
    (timestampMs, sourceIndex) =>
      new NormalizedTelemetryFrame({
        sourceIndex,
        timestampMs,
        recordedLapNumber: 1,
        normalizedTrackPosition: sourceIndex / timestampsMs.length,
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
      }),
  )
}

describe('analyzeSamplingGaps', () => {
  test('derives the threshold and detects an unusually long interval', () => {
    const result = analyzeSamplingGaps(
      createFrames([0, 50, 100, 150, 650, 700, 750]),
      TEST_CONFIG,
    )

    expect(result.diagnostics).toEqual({
      positiveDeltaCount: 6,
      medianDeltaMs: 50,
      madDeltaMs: 0,
      scaledMadDeltaMs: 0,
      maximumGapMs: 250,
      gapMedianMultiplier: 5,
      gapRobustScaleMultiplier: 10,
      detectedGapCount: 1,
    })
    expect(result.gaps).toEqual([
      {
        fromSourceIndex: 3,
        toSourceIndex: 4,
        fromTimestampMs: 150,
        toTimestampMs: 650,
        durationMs: 500,
      },
    ])
  })

  test('retains ordinary irregular sampling below the derived limit', () => {
    const result = analyzeSamplingGaps(
      createFrames([0, 45, 100, 160, 210, 265]),
      TEST_CONFIG,
    )

    expect(result.gaps).toEqual([])
    expect(result.diagnostics.medianDeltaMs).toBe(55)
    expect(result.diagnostics.maximumGapMs).toBe(275)
  })

  test('does not classify gaps without enough baseline samples', () => {
    const result = analyzeSamplingGaps(
      createFrames([0, 50, 1_000]),
      {
        ...TEST_CONFIG,
        minimumBaselineSamples: 3,
      },
    )

    expect(result.gaps).toEqual([])
    expect(result.diagnostics).toMatchObject({
      positiveDeltaCount: 2,
      medianDeltaMs: null,
      maximumGapMs: null,
      detectedGapCount: 0,
    })
  })
})
