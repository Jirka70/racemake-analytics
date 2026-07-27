import { describe, expect, test } from 'bun:test'
import { createAuditedFrames } from '../../../src/analytics/audit/create-audit-frames'
import type {
  IsolatedChannelOutlier,
  IsolatedOutlierChannel,
} from '../../../src/analytics/frame-audit-types'
import { NormalizedTelemetryFrame } from '../../../src/analytics/telemetry-types'

function createFrame(
  sourceIndex: number,
): NormalizedTelemetryFrame {
  return new NormalizedTelemetryFrame({
    sourceIndex,
    timestampMs: sourceIndex * 50,
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
  })
}

function createOutlier(
  frame: NormalizedTelemetryFrame,
  channel: IsolatedOutlierChannel,
  usability: IsolatedChannelOutlier['usability'],
): IsolatedChannelOutlier {
  return {
    frame,
    channel,
    usability,
    previousValue: 1,
    observedValue: 10,
    nextValue: 1,
  }
}

describe('createAuditedFrames', () => {
  test('preserves frame order and leaves frames without outliers clean', () => {
    const frames = [
      createFrame(0),
      createFrame(1),
      createFrame(2),
    ]

    const auditedFrames = createAuditedFrames(
      frames,
      [],
    )

    expect(
      auditedFrames.map((auditedFrame) => auditedFrame.frame),
    ).toEqual(frames)

    for (const auditedFrame of auditedFrames) {
      expect(auditedFrame.suspectChannels).toEqual([])
      expect(auditedFrame.invalidChannels).toEqual([])
    }
  })

  test('attaches sorted unique suspect channels to the matching frame', () => {
    const frames = [
      createFrame(0),
      createFrame(1),
      createFrame(2),
    ]

    const throttleOutlier = createOutlier(
      frames[1],
      'throttleRatio',
      'suspect',
    )

    const speedOutlier = createOutlier(
      frames[1],
      'speedKmh',
      'suspect',
    )

    const auditedFrames = createAuditedFrames(
      frames,
      [
        throttleOutlier,
        speedOutlier,
        speedOutlier,
      ],
    )

    expect(auditedFrames[0]).toMatchObject({
      frame: frames[0],
      suspectChannels: [],
      invalidChannels: [],
    })

    expect(auditedFrames[1]).toMatchObject({
      frame: frames[1],
      suspectChannels: [
        'speedKmh',
        'throttleRatio',
      ],
      invalidChannels: [],
    })

    expect(auditedFrames[2]).toMatchObject({
      frame: frames[2],
      suspectChannels: [],
      invalidChannels: [],
    })
  })

  test('lets invalid classification override suspect classification', () => {
    const frame = createFrame(0)
    const suspectOutlier = createOutlier(
      frame,
      'speedKmh',
      'suspect',
    )
    const invalidOutlier = createOutlier(
      frame,
      'speedKmh',
      'invalid',
    )

    const suspectThenInvalid = createAuditedFrames(
      [frame],
      [suspectOutlier, invalidOutlier],
    )

    const invalidThenSuspect = createAuditedFrames(
      [frame],
      [invalidOutlier, suspectOutlier],
    )

    expect(suspectThenInvalid[0]).toMatchObject({
      suspectChannels: [],
      invalidChannels: ['speedKmh'],
    })

    expect(invalidThenSuspect[0]).toMatchObject({
      suspectChannels: [],
      invalidChannels: ['speedKmh'],
    })
  })

  test('keeps suspect and invalid channels separate on the same frame', () => {
    const frame = createFrame(0)

    const auditedFrames = createAuditedFrames(
      [frame],
      [
        createOutlier(
          frame,
          'steeringDegrees',
          'suspect',
        ),
        createOutlier(
          frame,
          'timestampMs',
          'invalid',
        ),
      ],
    )

    expect(auditedFrames[0]).toEqual({
      frame,
      suspectChannels: ['steeringDegrees'],
      invalidChannels: ['timestampMs'],
    })
  })

  test('returns an empty collection for empty input', () => {
    expect(createAuditedFrames([], [])).toEqual([])
  })
})
