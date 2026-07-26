import { describe, expect, test } from 'bun:test'
import type {
  AuditedFrame,
  ProcessingIssue,
  SamplingGap,
} from '../../../src/analytics/frame-audit-types'
import {
  classifyFramePairsAsContinuousGapOrDiscontinuous,
  findDuplicateFrames,
  findTimelineIntegrityIssues,
  findTimestampOrderViolations,
  splitFramesAtContinuityBreaks,
} from '../../../src/analytics/timeline-audit'
import { NormalizedTelemetryFrame } from '../../../src/analytics/telemetry-types'

interface FrameOverrides {
  readonly sourceIndex: number
  readonly timestampMs?: number
  readonly speedKmh?: number
}

function createFrame({
  sourceIndex,
  timestampMs = 100,
  speedKmh = 200,
}: FrameOverrides): NormalizedTelemetryFrame {
  return new NormalizedTelemetryFrame({
    sourceIndex,
    timestampMs,
    recordedLapNumber: 1,
    normalizedTrackPosition: 0.5,
    speedKmh,
    throttleRatio: 0.8,
    brakeRatio: 0,
    steeringDegrees: 2,
    gear: 4,
    engineRpm: 6_000,
    tyreCoreTemperatureC: {
      frontLeft: 90,
      frontRight: 91,
      rearLeft: 92,
      rearRight: 93,
    },
  })
}

describe('findDuplicateFrames', () => {
  test('keeps the first frame and reports every duplicate in a run', () => {
    const result = findDuplicateFrames([
      createFrame({ sourceIndex: 10 }),
      createFrame({ sourceIndex: 11 }),
      createFrame({ sourceIndex: 12 }),
      createFrame({ sourceIndex: 13, speedKmh: 201 }),
    ])

    expect(result).toEqual([
      {
        retainedSourceIndex: 10,
        duplicateSourceIndex: 11,
        timestampMs: 100,
      },
      {
        retainedSourceIndex: 10,
        duplicateSourceIndex: 12,
        timestampMs: 100,
      },
    ])
    expect(Object.isFrozen(result)).toBe(true)
    expect(result.every(Object.isFrozen)).toBe(true)
  })

  test('does not confuse a timestamp conflict with an exact duplicate', () => {
    const result = findDuplicateFrames([
      createFrame({ sourceIndex: 0 }),
      createFrame({ sourceIndex: 1, speedKmh: 201 }),
      createFrame({
        sourceIndex: 2,
        timestampMs: 101,
        speedKmh: 201,
      }),
    ])

    expect(result).toEqual([])
  })
})

describe('findTimestampOrderViolations', () => {
  test('distinguishes conflicting timestamps from timestamp regressions', () => {
    const result = findTimestampOrderViolations([
      createFrame({ sourceIndex: 0, timestampMs: 100 }),
      createFrame({
        sourceIndex: 1,
        timestampMs: 100,
        speedKmh: 201,
      }),
      createFrame({
        sourceIndex: 2,
        timestampMs: 90,
        speedKmh: 202,
      }),
    ])

    expect(result.map(({ kind, durationMs }) => ({ kind, durationMs })))
      .toEqual([
        { kind: 'duplicate-timestamp', durationMs: 0 },
        { kind: 'timestamp-regression', durationMs: -10 },
      ])
  })

  test('leaves exact duplicates to the duplicate-frame detector', () => {
    expect(
      findTimestampOrderViolations([
        createFrame({ sourceIndex: 0 }),
        createFrame({ sourceIndex: 1 }),
      ]),
    ).toEqual([])
  })
})

describe('timeline issues and transitions', () => {
  test('turns findings into explicit issues and transition classes', () => {
    const frames = [
      createFrame({ sourceIndex: 0, timestampMs: 0 }),
      createFrame({ sourceIndex: 1, timestampMs: 50 }),
      createFrame({ sourceIndex: 2, timestampMs: 500 }),
      createFrame({
        sourceIndex: 3,
        timestampMs: 500,
        speedKmh: 201,
      }),
    ]
    const duplicates = findDuplicateFrames(frames)
    const violations = findTimestampOrderViolations(frames)
    const gaps: readonly SamplingGap[] = [
      {
        fromSourceIndex: 1,
        toSourceIndex: 2,
        fromTimestampMs: 50,
        toTimestampMs: 500,
        durationMs: 450,
      },
    ]
    const issues = findTimelineIntegrityIssues(
      duplicates,
      violations,
      gaps,
      {
        positiveDeltaCount: 2,
        medianDeltaMs: 50,
        madDeltaMs: 0,
        robustScaleMs: 0,
        maximumGapMs: 250,
      },
    )
    const transitions =
      classifyFramePairsAsContinuousGapOrDiscontinuous(
        frames,
        duplicates,
        violations,
        gaps,
        issues,
      )

    expect(issues.map((issue) => issue.code)).toEqual([
      'TIME_ORDER_VIOLATION',
      'SAMPLING_GAP',
    ])
    expect(transitions.map((transition) => transition.continuity))
      .toEqual(['continuous', 'gap', 'discontinuous'])
    expect(transitions[0].interpolationBlockedChannels).toEqual([])
    expect(transitions[1].interpolationBlockedChannels).toContain(
      'speedKmh',
    )
  })

  test('reports an insufficient sampling baseline without rejecting data', () => {
    const issues = findTimelineIntegrityIssues([], [], [], {
      positiveDeltaCount: 2,
      medianDeltaMs: null,
      madDeltaMs: null,
      robustScaleMs: null,
      maximumGapMs: null,
    })

    expect(issues).toEqual([
      expect.objectContaining({
        code: 'INSUFFICIENT_BASELINE',
        severity: 'warning',
        action: 'retain',
        scope: 'dataset',
      }),
    ])
  })
})

describe('splitFramesAtContinuityBreaks', () => {
  test('creates maximal usable segments and excludes rejected frames', () => {
    const frames = [0, 1, 2, 3].map((sourceIndex) =>
      createFrame({
        sourceIndex,
        timestampMs: sourceIndex * 50,
      }),
    )
    const rejectedIssue: ProcessingIssue = {
      code: 'DUPLICATE_SAMPLE',
      reason: 'test',
      severity: 'error',
      action: 'exclude-frame',
      scope: 'frame',
      sourceIndex: 2,
      message: 'test',
    }
    const auditedFrames: readonly AuditedFrame[] = frames.map(
      (frame) => ({
        frame,
        disposition:
          frame.sourceIndex === 2 ? 'rejected' : 'accepted',
        invalidChannels: [],
        issues: frame.sourceIndex === 2 ? [rejectedIssue] : [],
      }),
    )
    const transitions =
      classifyFramePairsAsContinuousGapOrDiscontinuous(
        frames,
        [],
        [],
        [
          {
            fromSourceIndex: 0,
            toSourceIndex: 1,
            fromTimestampMs: 0,
            toTimestampMs: 50,
            durationMs: 50,
          },
        ],
        [],
      )

    expect(splitFramesAtContinuityBreaks(auditedFrames, transitions))
      .toEqual([
        {
          id: 'segment-1',
          startSourceIndex: 0,
          endSourceIndex: 0,
          startTimestampMs: 0,
          endTimestampMs: 0,
          frameCount: 1,
        },
        {
          id: 'segment-2',
          startSourceIndex: 1,
          endSourceIndex: 1,
          startTimestampMs: 50,
          endTimestampMs: 50,
          frameCount: 1,
        },
        {
          id: 'segment-3',
          startSourceIndex: 3,
          endSourceIndex: 3,
          startTimestampMs: 150,
          endTimestampMs: 150,
          frameCount: 1,
        },
      ])
  })
})
