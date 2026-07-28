import { describe, expect, test } from 'bun:test'
import { attachChannelDiscontinuities, canCalculateDerivative, canInterpolateAcrossTransition, findChannelDiscontinuities } from '../../../src/analytics/audit/find-channel-discontinuities'
import { createAuditedFrames } from '../../../src/analytics/audit/create-audit-frames'
import { createContinuousTimelineSegments } from '../../../src/analytics/audit/create-continuous-timeline-segments'
import { createFrameTransitions } from '../../../src/analytics/audit/create-frame-transitions'
import { createTimelineTransitions } from '../../../src/analytics/audit/create-timeline-transitions'
import { createUsableTimeline } from '../../../src/analytics/audit/create-usable-timeline'
import type { ChannelContinuityConfig, DerivableTelemetryChannel, IsolatedChannelOutlier, SamplingBaseline, UsableTimeline } from '../../../src/analytics/frame-audit-types'
import { NormalizedTelemetryFrame } from '../../../src/analytics/telemetry-types'

const SAMPLING_BASELINE: SamplingBaseline = {
  sampleCount: 39,
  medianDeltaMs: 50,
  madDeltaMs: 0,
  scaledMadDeltaMs: 0,
  maximumGapMs: 250,
}

const CHANNEL_CONTINUITY_CONFIG: ChannelContinuityConfig = {
  minimumRateSampleCount: 10,
  rateMadMultiplier: 12,
  rateIqrMultiplier: 3,
  windowDurationMultiplier: 5,
  minimumWindowSamples: 4,
  minimumShiftToSpreadRatio: 6,
}

interface FrameValues {
  readonly speedKmh?: number
  readonly engineRpm?: number
  readonly gear?: number
  readonly tyreTemperatureC?: number
}

type Assert<T extends true> = T
type EngineRpmDerivativeIsForbidden = Assert<'engineRpm' extends DerivableTelemetryChannel ? false : true>
type SpeedDerivativeIsAllowed = Assert<'speedKmh' extends DerivableTelemetryChannel ? true : false>

function createFrames(values: readonly FrameValues[], timestampsMs: readonly number[] = values.map((_, index) => index * 50)) : NormalizedTelemetryFrame[] {
  return values.map((value, sourceIndex) => {
    const tyreTemperatureC = value.tyreTemperatureC ?? 90

    return new NormalizedTelemetryFrame({
      sourceIndex,
      timestampMs: timestampsMs[sourceIndex],
      recordedLapNumber: 1,
      normalizedTrackPosition: sourceIndex / values.length,
      speedKmh: value.speedKmh ?? 100,
      throttleRatio: 0.8,
      brakeRatio: 0,
      steeringDegrees: 2,
      gear: value.gear ?? 4,
      engineRpm: value.engineRpm ?? 5_000,
      tyreCoreTemperatureC: {
        frontLeft: tyreTemperatureC,
        frontRight: tyreTemperatureC + 1,
        rearLeft: tyreTemperatureC + 2,
        rearRight: tyreTemperatureC + 3,
      },
    })
  })
}

function createTimeline(frames: readonly NormalizedTelemetryFrame[], outliers: readonly IsolatedChannelOutlier[] = []) : UsableTimeline {
  const auditedFrames = createAuditedFrames(frames, outliers)
  const timelineTransitions = createTimelineTransitions(createFrameTransitions(frames))

  return createUsableTimeline(auditedFrames, timelineTransitions, SAMPLING_BASELINE)
}

function transitionAt(timeline: UsableTimeline, previousSourceIndex: number) {
  const transition = timeline.transitions.find((item) => item.previous.sourceIndex === previousSourceIndex)
  if (!transition) throw new Error(`Missing transition from source index ${previousSourceIndex}`)

  return transition
}

describe('channel discontinuities', () => {
  test('blocks a persistent tyre shift only on its boundary', () => {
    const frames = createFrames(Array.from({ length: 40 }, (_, index) => ({ tyreTemperatureC: index < 20 ? 90 : 105 })))
    const timeline = createTimeline(frames)
    const findings = findChannelDiscontinuities(timeline, SAMPLING_BASELINE, CHANNEL_CONTINUITY_CONFIG)
    const auditedTimeline = attachChannelDiscontinuities(timeline, findings)
    const boundary = transitionAt(auditedTimeline, 19)
    const following = transitionAt(auditedTimeline, 20)

    expect(findings).toEqual([
      {
        previousSourceIndex: 19,
        currentSourceIndex: 20,
        channels: [
          'tyreCoreTemperatureC.frontLeft',
          'tyreCoreTemperatureC.frontRight',
          'tyreCoreTemperatureC.rearLeft',
          'tyreCoreTemperatureC.rearRight',
        ],
      },
    ])
    expect(canCalculateDerivative(boundary, 'tyreCoreTemperatureC.frontLeft')).toBeFalse()
    expect(canInterpolateAcrossTransition(boundary, 'tyreCoreTemperatureC.frontLeft')).toBeFalse()
    expect(canCalculateDerivative(following, 'tyreCoreTemperatureC.frontLeft')).toBeTrue()
    expect(createContinuousTimelineSegments(auditedTimeline)).toHaveLength(1)
  })

  test('blocks every confirmed group at a multichannel sequence break', () => {
    const frames = createFrames(Array.from({ length: 40 }, (_, index) => {
      if (index < 20) return { speedKmh: 250, engineRpm: 8_500, tyreTemperatureC: 100 }
      return { speedKmh: 150, engineRpm: 7_000, tyreTemperatureC: 90 }
    }))
    const timeline = createTimeline(frames)
    const findings = findChannelDiscontinuities(timeline, SAMPLING_BASELINE, CHANNEL_CONTINUITY_CONFIG)
    const auditedTimeline = attachChannelDiscontinuities(timeline, findings)
    const boundary = transitionAt(auditedTimeline, 19)
    const following = transitionAt(auditedTimeline, 20)

    expect(findings[0]).toEqual({
      previousSourceIndex: 19,
      currentSourceIndex: 20,
      channels: [
        'engineRpm',
        'speedKmh',
        'tyreCoreTemperatureC.frontLeft',
        'tyreCoreTemperatureC.frontRight',
        'tyreCoreTemperatureC.rearLeft',
        'tyreCoreTemperatureC.rearRight',
      ],
    })
    expect(boundary.discontinuousChannels).toEqual(findings[0].channels)
    expect(following.discontinuousChannels).toEqual([])
  })

  test('does not classify a persistent speed-only driver event as corruption', () => {
    const frames = createFrames(Array.from({ length: 40 }, (_, index) => ({ speedKmh: index < 20 ? 200 : 150 })))
    const timeline = createTimeline(frames)

    expect(findChannelDiscontinuities(timeline, SAMPLING_BASELINE, CHANNEL_CONTINUITY_CONFIG)).toEqual([])
  })

  test('keeps engine RPM available for interpolation', () => {
    const timeline = createTimeline(createFrames(Array.from({ length: 40 }, () => ({}))))

    expect(canInterpolateAcrossTransition(transitionAt(timeline, 20), 'engineRpm')).toBeTrue()
  })

  test('blocks both transitions touching an isolated invalid sensor channel', () => {
    const values = Array.from({ length: 40 }, () => ({ speedKmh: 100 }))
    values[20] = { speedKmh: 1_000 }
    const frames = createFrames(values)
    const outlier: IsolatedChannelOutlier = {
      frame: frames[20],
      channel: 'speedKmh',
      usability: 'invalid',
      previousValue: 100,
      observedValue: 1_000,
      nextValue: 100,
    }
    const timeline = createTimeline(frames, [outlier])
    const auditedTimeline = attachChannelDiscontinuities(timeline, [])

    expect(transitionAt(auditedTimeline, 19).discontinuousChannels).toEqual(['speedKmh'])
    expect(transitionAt(auditedTimeline, 20).discontinuousChannels).toEqual(['speedKmh'])
    expect(transitionAt(auditedTimeline, 21).discontinuousChannels).toEqual([])
  })

  test('time gaps block derivation without creating a channel discontinuity', () => {
    const values = Array.from({ length: 12 }, () => ({}))
    const timestamps = values.map((_, index) => index < 6 ? index * 50 : 500 + index * 50)
    const timeline = attachChannelDiscontinuities(createTimeline(createFrames(values, timestamps)), [])
    const gap = transitionAt(timeline, 5)

    expect(gap.timeContinuity).toBe('gap')
    expect(gap.discontinuousChannels).toEqual([])
    expect(canCalculateDerivative(gap, 'speedKmh')).toBeFalse()
  })
})
