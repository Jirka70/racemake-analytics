import { describe, expect, test } from 'bun:test'
import { createAuditedFrames } from '../../../src/analytics/audit/create-audit-frames'
import { createFrameTransitions } from '../../../src/analytics/audit/create-frame-transitions'
import { createTimelineTransitions } from '../../../src/analytics/audit/create-timeline-transitions'
import { createUsableTimeline } from '../../../src/analytics/audit/create-usable-timeline'
import type {
  AuditedFrame,
  IsolatedChannelOutlier,
  SamplingBaseline,
} from '../../../src/analytics/frame-audit-types'
import { NormalizedTelemetryFrame } from '../../../src/analytics/telemetry-types'

const SAMPLING_BASELINE: SamplingBaseline = {
  sampleCount: 10,
  medianDeltaMs: 50,
  madDeltaMs: 0,
  scaledMadDeltaMs: 0,
  maximumGapMs: 250,
}

interface FrameOverrides {
  readonly speedKmh?: number
}

function createFrame(
  sourceIndex: number,
  timestampMs: number,
  overrides: FrameOverrides = {},
): NormalizedTelemetryFrame {
  return new NormalizedTelemetryFrame({
    sourceIndex,
    timestampMs,
    recordedLapNumber: 1,
    normalizedTrackPosition: sourceIndex / 10,
    speedKmh: overrides.speedKmh ?? 100,
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
  })
}

function duplicateFrame(
  frame: NormalizedTelemetryFrame,
  sourceIndex: number,
): NormalizedTelemetryFrame {
  return new NormalizedTelemetryFrame({
    sourceIndex,
    timestampMs: frame.timestampMs,
    recordedLapNumber: frame.recordedLapNumber,
    normalizedTrackPosition: frame.normalizedTrackPosition,
    speedKmh: frame.speedKmh,
    throttleRatio: frame.throttleRatio,
    brakeRatio: frame.brakeRatio,
    steeringDegrees: frame.steeringDegrees,
    gear: frame.gear,
    engineRpm: frame.engineRpm,
    tyreCoreTemperatureC: frame.tyreCoreTemperatureC,
  })
}

function createTimeline(
  frames: readonly NormalizedTelemetryFrame[],
) {
  return createTimelineTransitions(
    createFrameTransitions(frames),
  )
}

describe('createUsableTimeline', () => {
  test('excludes an exact duplicate and rebuilds the transition across it', () => {
    const first = createFrame(0, 0)
    const retained = createFrame(1, 50)
    const duplicate = duplicateFrame(retained, 2)
    const last = createFrame(3, 100)
    const frames = [first, retained, duplicate, last]

    const usableTimeline = createUsableTimeline(
      createAuditedFrames(frames, []),
      createTimeline(frames),
      SAMPLING_BASELINE,
    )

    expect(
      usableTimeline.frames.map(
        (auditedFrame) => auditedFrame.frame.sourceIndex,
      ),
    ).toEqual([0, 1, 3])

    expect(usableTimeline.excludedFrames).toEqual([
      {
        frame: duplicate,
        reason: 'exact-duplicate',
      },
    ])

    expect(usableTimeline.transitions[1]).toMatchObject({
      previous: retained,
      current: last,
      timestampDeltaMs: 50,
      relation: 'chronological',
      continuity: 'continuous',
    })
  })

  test('excludes a same-timestamp conflict and retains the first sample', () => {
    const first = createFrame(0, 0)
    const retained = createFrame(1, 50)
    const conflict = createFrame(
      2,
      50,
      { speedKmh: 150 },
    )
    const last = createFrame(3, 100)
    const frames = [first, retained, conflict, last]

    const usableTimeline = createUsableTimeline(
      createAuditedFrames(frames, []),
      createTimeline(frames),
      SAMPLING_BASELINE,
    )

    expect(
      usableTimeline.frames.map(
        (auditedFrame) => auditedFrame.frame.sourceIndex,
      ),
    ).toEqual([0, 1, 3])

    expect(usableTimeline.excludedFrames).toEqual([
      {
        frame: conflict,
        reason: 'same-timestamp-conflict',
      },
    ])
  })

  test('excludes an isolated invalid timestamp and bridges its neighbours', () => {
    const first = createFrame(0, 0)
    const invalidTimestamp = createFrame(1, 500)
    const last = createFrame(2, 100)
    const frames = [first, invalidTimestamp, last]

    const timestampOutlier: IsolatedChannelOutlier = {
      frame: invalidTimestamp,
      channel: 'timestampMs',
      usability: 'invalid',
      previousValue: first.timestampMs,
      observedValue: invalidTimestamp.timestampMs,
      nextValue: last.timestampMs,
    }

    const usableTimeline = createUsableTimeline(
      createAuditedFrames(
        frames,
        [timestampOutlier],
      ),
      createTimeline(frames),
      SAMPLING_BASELINE,
    )

    expect(
      usableTimeline.frames.map(
        (auditedFrame) => auditedFrame.frame.sourceIndex,
      ),
    ).toEqual([0, 2])

    expect(usableTimeline.excludedFrames).toEqual([
      {
        frame: invalidTimestamp,
        reason: 'isolated-invalid-timestamp',
      },
    ])

    expect(usableTimeline.transitions).toEqual([
      expect.objectContaining({
        previous: first,
        current: last,
        timestampDeltaMs: 100,
        relation: 'chronological',
        continuity: 'continuous',
      }),
    ])
  })

  test('marks a large positive timestamp delta as a gap', () => {
    const frames = [
      createFrame(0, 0),
      createFrame(1, 50),
      createFrame(2, 500),
    ]

    const usableTimeline = createUsableTimeline(
      createAuditedFrames(frames, []),
      createTimeline(frames),
      SAMPLING_BASELINE,
    )

    expect(usableTimeline.excludedFrames).toEqual([])
    expect(
      usableTimeline.transitions.map(
        (transition) => transition.continuity,
      ),
    ).toEqual(['continuous', 'gap'])
  })

  test('marks a timestamp regression as a break without excluding its endpoints', () => {
    const frames = [
      createFrame(0, 0),
      createFrame(1, 100),
      createFrame(2, 50),
    ]

    const usableTimeline = createUsableTimeline(
      createAuditedFrames(frames, []),
      createTimeline(frames),
      SAMPLING_BASELINE,
    )

    expect(usableTimeline.frames).toHaveLength(3)
    expect(usableTimeline.excludedFrames).toEqual([])
    expect(
      usableTimeline.transitions.map(
        (transition) => transition.continuity,
      ),
    ).toEqual(['continuous', 'break'])
  })

  test('retains a frame with a suspect signal channel', () => {
    const frames = [
      createFrame(0, 0),
      createFrame(1, 50),
      createFrame(2, 100),
    ]

    const speedOutlier: IsolatedChannelOutlier = {
      frame: frames[1],
      channel: 'speedKmh',
      usability: 'suspect',
      previousValue: 100,
      observedValue: 1_000,
      nextValue: 100,
    }

    const auditedFrames: readonly AuditedFrame[] =
      createAuditedFrames(
        frames,
        [speedOutlier],
      )

    const usableTimeline = createUsableTimeline(
      auditedFrames,
      createTimeline(frames),
      SAMPLING_BASELINE,
    )

    expect(usableTimeline.frames).toEqual(
      auditedFrames,
    )
    expect(usableTimeline.excludedFrames).toEqual([])
    expect(
      usableTimeline.transitions.map(
        (transition) => transition.continuity,
      ),
    ).toEqual(['continuous', 'continuous'])
  })
})
