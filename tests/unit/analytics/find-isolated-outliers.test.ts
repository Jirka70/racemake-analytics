import { describe, expect, test } from 'bun:test'
import {
  findChannelOutliers,
} from '../../../src/analytics/audit/find-isolated-outliers'
import { runTelemetryAuditPipeline } from '../../../src/application/telemetry-audit-pipeline'
import { DEFAULT_FRAME_AUDIT_CONFIG } from '../../../src/config/frame-audit-config'
import type {
  IsolatedChannelOutlier,
  IsolatedOutlierConfig,
  SamplingBaseline,
} from '../../../src/analytics/frame-audit-types'
import { NormalizedTelemetryFrame } from '../../../src/analytics/telemetry-types'

const stintPath =
  `${import.meta.dir}/../../../data/stint.telemetry.json`

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
  minimumReturnRateRatio: 0.25,
  fallbackIqrMultiplier: 3,
  minimumResidualBySignalChannel: {
    normalizedTrackPosition: 0.0001,
    speedKmh: 0.1,
  },
}

function createFrames(
  positions: readonly number[],
  speeds: readonly number[] = positions.map(() => 100),
  throttles: readonly number[] = positions.map(() => 0.8),
): readonly NormalizedTelemetryFrame[] {
  return positions.map(
    (normalizedTrackPosition, sourceIndex) =>
      new NormalizedTelemetryFrame({
        sourceIndex,
        timestampMs: sourceIndex * 50,
        recordedLapNumber: 1,
        normalizedTrackPosition,
        speedKmh: speeds[sourceIndex],
        throttleRatio: throttles[sourceIndex],
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
        usability: 'invalid',
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
        usability: 'invalid',
        observedValue: 1_000,
        predictedValue: 103,
        residual: 897,
      }),
    )
  })

  test('does not audit a driver input when MAD and IQR are zero', () => {
    const positions = Array.from(
      { length: 35 },
      (_, index) => index / 35,
    )
    const throttles = positions.map(() => 0)
    throttles[17] = 0.1
    const frames = createFrames(
      positions,
      positions.map(() => 100),
      throttles,
    )

    const throttleOutliers = findChannelOutliers(
      frames,
      SAMPLING_BASELINE,
      OUTLIER_CONFIG,
    ).filter(
      (outlier) => outlier.channel === 'throttleRatio',
    )

    expect(throttleOutliers).toEqual([])
  })

  test('keeps a detected driver-input outlier suspect instead of invalid', () => {
    const positions = Array.from({ length: 35 }, (_, index) => index / 35)
    const throttles = positions.map((_, index) => 0.5 + 0.01 * Math.sin(index))
    throttles[17] = 1
    const frames = createFrames(positions, positions.map(() => 100), throttles)
    const throttleOutliers = findChannelOutliers(frames, SAMPLING_BASELINE, { ...OUTLIER_CONFIG, driverInputMadMultiplier: 8 }).filter((outlier) => outlier.channel === 'throttleRatio')

    expect(throttleOutliers).toEqual([expect.objectContaining({ frame: frames[17], usability: 'suspect' })])
  })

  test('uses IQR when MAD is zero but IQR provides scale', () => {
    const positions = Array.from(
      { length: 41 },
      (_, index) => index / 41,
    )
    const speeds = positions.map(() => 100)

    for (const index of [5, 11, 17, 23]) {
      speeds[index] = 102
    }

    speeds[31] = 120

    const frames = createFrames(positions, speeds)
    const speedOutliers = findChannelOutliers(
      frames,
      SAMPLING_BASELINE,
      OUTLIER_CONFIG,
    ).filter(
      (outlier) => outlier.channel === 'speedKmh',
    )

    expect(speedOutliers).toEqual([
      expect.objectContaining({
        frame: frames[31],
        usability: 'invalid',
        observedValue: 120,
        predictedValue: 100,
        residual: 20,
        threshold: 4,
      }),
    ])
  })

  test('does not audit a zero-scale sensor without a configured residual floor', () => {
    const positions = Array.from(
      { length: 35 },
      (_, index) => index / 35,
    )
    const speeds = positions.map(() => 100)
    speeds[17] = 1_000
    const frames = createFrames(positions, speeds)
    const configWithoutSpeedFloor: IsolatedOutlierConfig = {
      ...OUTLIER_CONFIG,
      minimumResidualBySignalChannel: {
        normalizedTrackPosition: 0.0001,
      },
    }

    const speedOutliers = findChannelOutliers(
      frames,
      SAMPLING_BASELINE,
      configWithoutSpeedFloor,
    ).filter(
      (outlier) => outlier.channel === 'speedKmh',
    )

    expect(speedOutliers).toEqual([])
  })

  test('finds an isolated sensor spike with a configured residual floor', () => {
    const positions = Array.from(
      { length: 35 },
      (_, index) => index / 35,
    )
    const speeds = positions.map(() => 100)
    speeds[17] = 1_000
    const frames = createFrames(positions, speeds)

    const speedOutliers = findChannelOutliers(
      frames,
      SAMPLING_BASELINE,
      OUTLIER_CONFIG,
    ).filter(
      (outlier) => outlier.channel === 'speedKmh',
    )

    expect(speedOutliers).toEqual([
      expect.objectContaining({
        frame: frames[17],
        usability: 'invalid',
        observedValue: 1_000,
        predictedValue: 100,
        residual: 900,
        threshold: 0.1,
      }),
    ])
  })

  test('ignores a zero-scale sensor residual at its configured floor', () => {
    const positions = Array.from(
      { length: 35 },
      (_, index) => index / 35,
    )
    const speeds = positions.map(() => 100)
    speeds[17] = 100.1
    const frames = createFrames(positions, speeds)

    const speedOutliers = findChannelOutliers(
      frames,
      SAMPLING_BASELINE,
      OUTLIER_CONFIG,
    ).filter(
      (outlier) => outlier.channel === 'speedKmh',
    )

    expect(speedOutliers).toEqual([])
  })
})

describe('findChannelOutliers on the official stint', () => {
  test('returns only samples with a balanced immediate return', async () => {
    const result = await auditOfficialStint()
    const signalOutliers =
      result.auditResult.isolatedOutliers.filter(
        (outlier) => outlier.channel !== 'timestampMs',
      )

    expect(signalOutliers.length).toBeGreaterThan(0)
    expect(
      signalOutliers.every(
        ({ residual, threshold }) =>
          residual !== undefined &&
          threshold !== undefined &&
          Number.isFinite(residual) &&
          Number.isFinite(threshold) &&
          residual > threshold,
      ),
    ).toBeTrue()

    for (const outlier of signalOutliers) {
      const returnRates = calculateReturnRates(
        outlier,
        result.normalizedTelemetry.frames,
      )

      expect(
        returnRates.incoming * returnRates.outgoing,
      ).toBeLessThan(0)
      expect(returnRates.balanceRatio)
        .toBeGreaterThanOrEqual(
          DEFAULT_FRAME_AUDIT_CONFIG.isolatedOutlier
            .minimumReturnRateRatio,
        )
    }
  })

  test('classifies isolated sensor outliers as invalid channel values', async () => {
    const result = await auditOfficialStint()
    const sensorOutliers = result.auditResult.isolatedOutliers.filter((outlier) => outlier.channel !== 'timestampMs' && outlier.channel !== 'throttleRatio' && outlier.channel !== 'brakeRatio' && outlier.channel !== 'steeringDegrees')

    expect(sensorOutliers.length).toBeGreaterThan(0)
    expect(sensorOutliers.every((outlier) => outlier.usability === 'invalid')).toBeTrue()

    for (const outlier of sensorOutliers) {
      expect(result.auditResult.auditedFrames[outlier.frame.sourceIndex].invalidChannels).toContain(outlier.channel)
    }
  })

  test('does not label adjacent frames in one channel as isolated', async () => {
    const result = await auditOfficialStint()
    const outlierKeys = new Set(
      result.auditResult.isolatedOutliers.map(
        (outlier) =>
          `${outlier.channel}:${outlier.frame.sourceIndex}`,
      ),
    )

    for (const outlier of result.auditResult.isolatedOutliers) {
      expect(
        outlierKeys.has(
          `${outlier.channel}:${outlier.frame.sourceIndex + 1}`,
        ),
      ).toBeFalse()
    }
  })

  test('does not treat normal start-finish wraps as position outliers', async () => {
    const result = await auditOfficialStint()
    const positionOutlierIndexes = new Set(
      result.auditResult.isolatedOutliers
        .filter(
          (outlier) =>
            outlier.channel === 'normalizedTrackPosition',
        )
        .map((outlier) => outlier.frame.sourceIndex),
    )
    const frames = result.normalizedTelemetry.frames

    for (let index = 1; index < frames.length; index++) {
      const previous = frames[index - 1]
      const current = frames[index]
      const isStartFinishWrap =
        previous.normalizedTrackPosition > 0.9 &&
        current.normalizedTrackPosition < 0.1

      if (isStartFinishWrap) {
        expect(positionOutlierIndexes.has(current.sourceIndex))
          .toBeFalse()
      }
    }
  })
})

async function auditOfficialStint() {
  const unknownPayload: unknown = await Bun.file(stintPath).json()

  return runTelemetryAuditPipeline(
    unknownPayload,
    DEFAULT_FRAME_AUDIT_CONFIG,
  )
}

interface ReturnRates {
  readonly incoming: number
  readonly outgoing: number
  readonly balanceRatio: number
}

function calculateReturnRates(
  outlier: IsolatedChannelOutlier,
  frames: readonly NormalizedTelemetryFrame[],
): ReturnRates {
  const frameIndex = frames.indexOf(outlier.frame)
  const previous = frames[frameIndex - 1]
  const next = frames[frameIndex + 1]
  const incomingDurationMs =
    outlier.frame.timestampMs - previous.timestampMs
  const outgoingDurationMs =
    next.timestampMs - outlier.frame.timestampMs
  const values = valuesForRateComparison(outlier)
  const incomingRate =
    (values.observed - values.previous) /
    incomingDurationMs
  const outgoingRate =
    (values.next - values.observed) /
    outgoingDurationMs

  return {
    incoming: incomingRate,
    outgoing: outgoingRate,
    balanceRatio:
      Math.min(
        Math.abs(incomingRate),
        Math.abs(outgoingRate),
      ) / Math.max(
        Math.abs(incomingRate),
        Math.abs(outgoingRate),
      ),
  }
}

interface RateComparisonValues {
  readonly previous: number
  readonly observed: number
  readonly next: number
}

function valuesForRateComparison(
  outlier: IsolatedChannelOutlier,
): RateComparisonValues {
  if (outlier.channel !== 'normalizedTrackPosition') {
    return {
      previous: outlier.previousValue,
      observed: outlier.observedValue,
      next: outlier.nextValue,
    }
  }

  const reference =
    outlier.predictedValue ?? outlier.observedValue

  return {
    previous: unwrapPosition(outlier.previousValue, reference),
    observed: unwrapPosition(outlier.observedValue, reference),
    next: unwrapPosition(outlier.nextValue, reference),
  }
}

function unwrapPosition(
  position: number,
  reference: number,
): number {
  const wrappedDelta = (position - reference) % 1

  if (wrappedDelta > 0.5) {
    return reference + wrappedDelta - 1
  }

  if (wrappedDelta < -0.5) {
    return reference + wrappedDelta + 1
  }

  return reference + wrappedDelta
}
