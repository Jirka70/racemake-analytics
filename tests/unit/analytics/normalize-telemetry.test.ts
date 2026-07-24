import { describe, expect, test } from 'bun:test'
import { normalizeTelemetryPayload } from '../../../src/analytics/normalize-telemetry'
import { NormalizedTelemetryFrame } from '../../../src/analytics/telemetry-types'
import type { WireTelemetryPayload } from '../../../src/analytics/telemetry-types'

function createWirePayload(): WireTelemetryPayload {
  return {
    schema: 'racemake.telemetry.stint.v1',
    recorder: {
      name: 'racemake-agent',
      version: '0.1.2874',
    },
    session_id: '7f3a9c1e-0b52-4d84-9a6e-2c1d5f8b41a0',
    note: 'normalization fixture',
    frame_count: 1,
    frames: [
      {
        ts: 48,
        lap: 2,
        pos: 0.4,
        spd: 55.2,
        thr: 0.8,
        brk: 0.1,
        str: -12.3,
        gear: 2,
        rpm: 8_716,
        tyres: {
          fl: 919,
          fr: 900,
          rl: 881,
          rr: 862,
        },
      },
    ],
  }
}

describe('normalizeTelemetryPayload', () => {
  test('maps wire names and units to the normalized domain model', () => {
    const result = normalizeTelemetryPayload(createWirePayload())

    expect(result).toMatchObject({
      schemaVersion: 'racemake.telemetry.stint.v1',
      sessionId: '7f3a9c1e-0b52-4d84-9a6e-2c1d5f8b41a0',
      recorder: {
        name: 'racemake-agent',
        version: '0.1.2874',
      },
      note: 'normalization fixture',
      frameCount: 1,
    })
    expect(result.frames).toHaveLength(1)
    expect(result.frames[0]).toEqual(
      new NormalizedTelemetryFrame({
        sourceIndex: 0,
        timestampMs: 48,
        recordedLapNumber: 2,
        normalizedTrackPosition: 0.4,
        speedKmh: 55.2,
        throttleRatio: 0.8,
        brakeRatio: 0.1,
        steeringDegrees: -12.3,
        gear: 2,
        engineRpm: 8_716,
        tyreCoreTemperatureC: {
          frontLeft: 91.9,
          frontRight: 90,
          rearLeft: 88.1,
          rearRight: 86.2,
        },
      }),
    )
  })

  test('returns runtime-immutable messages without mutating wire input', () => {
    const payload = createWirePayload()
    const originalPayload = structuredClone(payload)

    const result = normalizeTelemetryPayload(payload)
    const frame = result.frames[0]

    expect(payload).toEqual(originalPayload)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.recorder)).toBe(true)
    expect(Object.isFrozen(result.frames)).toBe(true)
    expect(Object.isFrozen(frame)).toBe(true)
    expect(Object.isFrozen(frame.tyreCoreTemperatureC)).toBe(true)
  })

  test('is deterministic for the same validated wire payload', () => {
    const payload = createWirePayload()

    expect(normalizeTelemetryPayload(payload)).toEqual(
      normalizeTelemetryPayload(payload),
    )
  })
})
