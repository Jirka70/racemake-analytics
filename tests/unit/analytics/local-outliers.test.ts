import { describe, expect, test } from 'bun:test'
import type {
  AuditedTransition,
  FrameAuditConfig,
} from '../../../src/analytics/frame-audit-types'
import {
  blockOutlierChannelsNearAffectedFrames,
  computeSignalResidualBaselines,
  findIsolatedSignalSpikes,
  findLocalOutlierIssues,
} from '../../../src/analytics/local-outliers'
import { NormalizedTelemetryFrame } from '../../../src/analytics/telemetry-types'

const LOCAL_OUTLIER_CONFIG: FrameAuditConfig['localOutlier'] = {
  spikeMadMultiplier: 8,
  persistenceWindowDeltaMultiplier: 5,
  minimumWindowSamples: 1,
  fallbackQuantile: 0.9,
}

function createFrames(
  speeds: readonly number[],
  gears: Readonly<Record<number, number>> = {},
): readonly NormalizedTelemetryFrame[] {
  return speeds.map(
    (speedKmh, sourceIndex) =>
      new NormalizedTelemetryFrame({
        sourceIndex,
        timestampMs: sourceIndex * 50,
        recordedLapNumber: 1,
        normalizedTrackPosition:
          (0.95 + sourceIndex * 0.01) % 1,
        speedKmh,
        throttleRatio: 0.8,
        brakeRatio: 0,
        steeringDegrees: 2,
        gear: gears[sourceIndex] ?? 4,
        engineRpm: 5_000 + sourceIndex * 10,
        tyreCoreTemperatureC: {
          frontLeft: 90 + sourceIndex * 0.01,
          frontRight: 91 + sourceIndex * 0.01,
          rearLeft: 92 + sourceIndex * 0.01,
          rearRight: 93 + sourceIndex * 0.01,
        },
      }),
  )
}

function createContinuousTransitions(
  frames: readonly NormalizedTelemetryFrame[],
): readonly AuditedTransition[] {
  return frames.slice(1).map((current, index) => ({
    fromSourceIndex: frames[index].sourceIndex,
    toSourceIndex: current.sourceIndex,
    durationMs:
      current.timestampMs - frames[index].timestampMs,
    continuity: 'continuous',
    interpolationBlockedChannels: [],
    derivativesBlockedChannels: [],
    issues: [],
  }))
}

describe('local signal outliers', () => {
  test('derives per-channel baselines and finds one isolated speed spike', () => {
    const speeds = Array.from(
      { length: 25 },
      (_, index) => 100 + index * 2,
    )
    speeds[12] = 1_000
    const frames = createFrames(speeds)
    const transitions = createContinuousTransitions(frames)
    const baselines = computeSignalResidualBaselines(
      frames,
      transitions,
      LOCAL_OUTLIER_CONFIG,
    )
    const spikes = findIsolatedSignalSpikes(
      frames,
      transitions,
      baselines,
      LOCAL_OUTLIER_CONFIG,
    )
    const speedBaseline = baselines.find(
      (baseline) => baseline.channel === 'speedKmh',
    )

    expect(baselines).toHaveLength(7)
    expect(speedBaseline?.spikeThreshold).not.toBeNull()
    expect(spikes.filter((spike) => spike.channel === 'speedKmh'))
      .toEqual([
        expect.objectContaining({
          sourceIndex: 12,
          measuredValue: 1_000,
          predictedValue: 124,
          residual: 876,
        }),
      ])
    expect(
      spikes.filter(
        (spike) =>
          spike.channel === 'normalizedTrackPosition',
      ),
    ).toEqual([])
  })

  test('does not treat a persistent level change as an isolated spike', () => {
    const speeds = Array.from(
      { length: 25 },
      (_, index) => (index < 12 ? 100 : 200),
    )
    const frames = createFrames(speeds)
    const transitions = createContinuousTransitions(frames)
    const baselines = computeSignalResidualBaselines(
      frames,
      transitions,
      LOCAL_OUTLIER_CONFIG,
    )

    expect(
      findIsolatedSignalSpikes(
        frames,
        transitions,
        baselines,
        LOCAL_OUTLIER_CONFIG,
      ).filter((spike) => spike.channel === 'speedKmh'),
    ).toEqual([])
  })

  test('does not calculate a residual across a continuity break', () => {
    const speeds = Array.from(
      { length: 25 },
      (_, index) => 100 + index,
    )
    speeds[12] = 1_000
    const frames = createFrames(speeds)
    const transitions = createContinuousTransitions(frames).map(
      (transition) =>
        transition.toSourceIndex === 12
          ? { ...transition, continuity: 'gap' as const }
          : transition,
    )
    const baselines = computeSignalResidualBaselines(
      frames,
      transitions,
      LOCAL_OUTLIER_CONFIG,
    )

    expect(
      findIsolatedSignalSpikes(
        frames,
        transitions,
        baselines,
        LOCAL_OUTLIER_CONFIG,
      ).filter((spike) => spike.sourceIndex === 12),
    ).toEqual([])
  })

  test('does not classify the expected RPM change during a shift', () => {
    const gearsAfterShift = Object.fromEntries(
      Array.from({ length: 13 }, (_, offset) => [offset + 12, 5]),
    )
    const frames = createFrames(
      Array.from({ length: 25 }, () => 100),
      gearsAfterShift,
    ).map((frame, index) =>
      index === 12
        ? new NormalizedTelemetryFrame({
            sourceIndex: frame.sourceIndex,
            timestampMs: frame.timestampMs,
            recordedLapNumber: frame.recordedLapNumber,
            normalizedTrackPosition:
              frame.normalizedTrackPosition,
            speedKmh: frame.speedKmh,
            throttleRatio: frame.throttleRatio,
            brakeRatio: frame.brakeRatio,
            steeringDegrees: frame.steeringDegrees,
            gear: frame.gear,
            engineRpm: 3_000,
            tyreCoreTemperatureC:
              frame.tyreCoreTemperatureC,
          })
        : frame,
    )
    const transitions = createContinuousTransitions(frames)
    const baselines = computeSignalResidualBaselines(
      frames,
      transitions,
      LOCAL_OUTLIER_CONFIG,
    )

    expect(
      findIsolatedSignalSpikes(
        frames,
        transitions,
        baselines,
        LOCAL_OUTLIER_CONFIG,
      ).filter(
        (spike) =>
          spike.sourceIndex === 12 &&
          spike.channel === 'engineRpm',
      ),
    ).toEqual([])
  })

  test('creates evidence and blocks only the affected channel', () => {
    const transitions: readonly AuditedTransition[] = [
      {
        fromSourceIndex: 4,
        toSourceIndex: 5,
        durationMs: 50,
        continuity: 'continuous',
        interpolationBlockedChannels: [],
        derivativesBlockedChannels: [],
        issues: [],
      },
      {
        fromSourceIndex: 5,
        toSourceIndex: 6,
        durationMs: 50,
        continuity: 'continuous',
        interpolationBlockedChannels: [],
        derivativesBlockedChannels: [],
        issues: [],
      },
    ]
    const spikes = [
      {
        sourceIndex: 5,
        timestampMs: 250,
        channel: 'speedKmh' as const,
        measuredValue: 500,
        predictedValue: 150,
        residual: 350,
        threshold: 10,
      },
    ]
    const issues = findLocalOutlierIssues(spikes)
    const blocked =
      blockOutlierChannelsNearAffectedFrames(transitions, spikes)

    expect(issues).toEqual([
      expect.objectContaining({
        code: 'LOCAL_OUTLIER',
        action: 'exclude-channel-value',
        channels: ['speedKmh'],
        observed: expect.objectContaining({ residual: 350 }),
      }),
    ])
    expect(
      blocked.every((transition) =>
        transition.interpolationBlockedChannels.includes(
          'speedKmh',
        ),
      ),
    ).toBe(true)
    expect(
      blocked.some((transition) =>
        transition.interpolationBlockedChannels.includes(
          'engineRpm',
        ),
      ),
    ).toBe(false)
  })
})
