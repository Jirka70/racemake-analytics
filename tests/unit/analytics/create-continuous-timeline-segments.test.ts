import { describe, expect, test } from 'bun:test'
import { createContinuousTimelineSegments } from '../../../src/analytics/audit/create-continuous-timeline-segments'
import type {
  AuditedFrame,
  AuditedTimelineTransition,
  TimelineContinuity,
  UsableTimeline,
} from '../../../src/analytics/frame-audit-types'
import { NormalizedTelemetryFrame } from '../../../src/analytics/telemetry-types'

function createAuditedFrame(
  sourceIndex: number,
  timestampMs: number,
): AuditedFrame {
  return {
    frame: new NormalizedTelemetryFrame({
      sourceIndex,
      timestampMs,
      recordedLapNumber: 1,
      normalizedTrackPosition: sourceIndex / 10,
      speedKmh: 100,
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
    suspectChannels: [],
    invalidChannels: [],
  }
}

function createTransition(
  previous: AuditedFrame,
  current: AuditedFrame,
  timeContinuity: TimelineContinuity,
): AuditedTimelineTransition {
  const timestampDeltaMs =
    current.frame.timestampMs -
    previous.frame.timestampMs

  const relation =
    timestampDeltaMs > 0
      ? 'chronological'
      : 'timestamp-regression'

  return {
    previous: previous.frame,
    current: current.frame,
    timestampDeltaMs,
    relation,
    timeContinuity,
    discontinuousChannels: [],
  }
}

function createTimeline(
  timestamps: readonly number[],
  continuities: readonly TimelineContinuity[],
): UsableTimeline {
  const frames = timestamps.map(
    (timestampMs, sourceIndex) =>
      createAuditedFrame(
        sourceIndex,
        timestampMs,
      ),
  )

  const transitions = continuities.map(
    (continuity, transitionIndex) =>
      createTransition(
        frames[transitionIndex],
        frames[transitionIndex + 1],
        continuity,
      ),
  )

  return {
    frames,
    excludedFrames: [],
    transitions,
  }
}

describe('createContinuousTimelineSegments', () => {
  test('returns no segments for an empty timeline', () => {
    const usableTimeline: UsableTimeline = {
      frames: [],
      excludedFrames: [],
      transitions: [],
    }

    expect(
      createContinuousTimelineSegments(
        usableTimeline,
      ),
    ).toEqual([])
  })

  test('creates one segment for a single frame', () => {
    const usableTimeline = createTimeline(
      [100],
      [],
    )

    expect(
      createContinuousTimelineSegments(
        usableTimeline,
      ),
    ).toEqual([
      {
        id: 'timeline-segment-1',
        frames: usableTimeline.frames,
        startSourceIndex: 0,
        endSourceIndex: 0,
        startTimestampMs: 100,
        endTimestampMs: 100,
        frameCount: 1,
      },
    ])
  })

  test('keeps continuous transitions in one segment', () => {
    const usableTimeline = createTimeline(
      [0, 50, 100, 150],
      [
        'continuous',
        'continuous',
        'continuous',
      ],
    )

    const segments =
      createContinuousTimelineSegments(
        usableTimeline,
      )

    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({
      id: 'timeline-segment-1',
      frames: usableTimeline.frames,
      startSourceIndex: 0,
      endSourceIndex: 3,
      startTimestampMs: 0,
      endTimestampMs: 150,
      frameCount: 4,
    })
  })

  test('splits segments at a sampling gap', () => {
    const usableTimeline = createTimeline(
      [0, 50, 500, 550],
      [
        'continuous',
        'gap',
        'continuous',
      ],
    )

    const segments =
      createContinuousTimelineSegments(
        usableTimeline,
      )

    expect(
      segments.map((segment) =>
        segment.frames.map(
          (auditedFrame) =>
            auditedFrame.frame.sourceIndex,
        ),
      ),
    ).toEqual([
      [0, 1],
      [2, 3],
    ])
  })

  test('splits segments at a timeline break', () => {
    const usableTimeline = createTimeline(
      [0, 50, 10, 60],
      [
        'continuous',
        'break',
        'continuous',
      ],
    )

    const segments =
      createContinuousTimelineSegments(
        usableTimeline,
      )

    expect(
      segments.map((segment) =>
        segment.frames.map(
          (auditedFrame) =>
            auditedFrame.frame.sourceIndex,
        ),
      ),
    ).toEqual([
      [0, 1],
      [2, 3],
    ])
  })

  test('preserves a single-frame segment between two boundaries', () => {
    const usableTimeline = createTimeline(
      [0, 500, 100],
      [
        'gap',
        'break',
      ],
    )

    const segments =
      createContinuousTimelineSegments(
        usableTimeline,
      )

    expect(
      segments.map((segment) =>
        segment.frames.map(
          (auditedFrame) =>
            auditedFrame.frame.sourceIndex,
        ),
      ),
    ).toEqual([
      [0],
      [1],
      [2],
    ])
  })

  test('rejects a timeline with a missing transition', () => {
    const usableTimeline = createTimeline(
      [0, 50],
      [],
    )

    expect(() =>
      createContinuousTimelineSegments(
        usableTimeline,
      ),
    ).toThrow(
      'Usable timeline must contain one transition between every retained frame pair',
    )
  })

  test('rejects a transition connected to different frames', () => {
    const usableTimeline = createTimeline(
      [0, 50],
      ['continuous'],
    )

    const invalidTimeline: UsableTimeline = {
      ...usableTimeline,
      transitions: [
        {
          ...usableTimeline.transitions[0],
          previous: usableTimeline.frames[1].frame,
        },
      ],
    }

    expect(() =>
      createContinuousTimelineSegments(
        invalidTimeline,
      ),
    ).toThrow(
      'Usable timeline transition does not connect its corresponding retained frame pair',
    )
  })
})
