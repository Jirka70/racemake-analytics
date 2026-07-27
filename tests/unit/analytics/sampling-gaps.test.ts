import { describe, expect, test } from 'bun:test'
import type { SamplingAuditConfig } from '../../../src/analytics/frame-audit-types'
import {
  computeSamplingIntervalBaseline,
  findGapsExceedingMaximumGap,
} from '../../../src/analytics/sampling-gaps'
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

describe('sampling audit steps', () => {
  test('computes the robust sampling baseline independently', () => {
    const baseline = computeSamplingIntervalBaseline(
      createFrames([0, 50, 100, 150, 650, 700, 750]),
      TEST_CONFIG,
    )

    expect(baseline).toEqual({
      positiveDeltaCount: 6,
      medianDeltaMs: 50,
      madDeltaMs: 0,
      robustScaleMs: 0,
      maximumGapMs: 250,
    })
  })

  test('uses a supplied limit and ignores non-positive intervals', () => {
    const gaps = findGapsExceedingMaximumGap(
      createFrames([0, 50, 50, 40, 400]),
      200,
    )

    expect(gaps).toEqual([
      {
        fromSourceIndex: 3,
        toSourceIndex: 4,
        fromTimestampMs: 40,
        toTimestampMs: 400,
        durationMs: 360,
      },
    ])
    expect(findGapsExceedingMaximumGap(createFrames([0, 500]), null))
      .toEqual([])
  })
})
