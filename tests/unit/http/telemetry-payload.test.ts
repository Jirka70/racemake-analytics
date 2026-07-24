import { describe, expect, test } from 'bun:test'
import {
  telemetryPayloadSchema,
  wireTelemetryFrameSchema,
  type WireTelemetryFrame,
} from '../../../src/http/schemas/telemetry-payload'

function createValidFrame(
  overrides: Partial<WireTelemetryFrame> = {},
): WireTelemetryFrame {
  return {
    ts: 48,
    lap: 0,
    pos: 0.4,
    spd: 55.2,
    thr: 1,
    brk: 0,
    str: 0.2,
    gear: 2,
    rpm: 8_716,
    tyres: {
      fl: 579,
      fr: 551,
      rl: 574,
      rr: 541,
    },
    ...overrides,
  }
}

function createValidPayload(
  frames: WireTelemetryFrame[] = [createValidFrame()],
) {
  return {
    schema: 'racemake.telemetry.stint.v1',
    recorder: {
      name: 'racemake-agent',
      version: '0.1.2874',
    },
    session_id: '7f3a9c1e-0b52-4d84-9a6e-2c1d5f8b41a0',
    note: 'raw frames as streamed by the native recorder',
    frame_count: frames.length,
    frames,
  }
}

describe('wireTelemetryFrameSchema', () => {
  test('accepts a structurally valid recorder frame without normalizing it', () => {
    const result = wireTelemetryFrameSchema.safeParse(
      createValidFrame({
        tyres: {
          fl: 919,
          fr: 900,
          rl: 890,
          rr: 880,
        },
      }),
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tyres.fl).toBe(919)
    }
  })

  test('rejects values outside documented pedal and gear ranges', () => {
    const result = wireTelemetryFrameSchema.safeParse(
      createValidFrame({
        thr: 1.1,
        gear: 9,
      }),
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path)).toEqual([
        ['thr'],
        ['gear'],
      ])
    }
  })

  test('rejects non-finite numeric values without deprecated checks', () => {
    expect(
      wireTelemetryFrameSchema.safeParse(
        createValidFrame({
          str: Number.POSITIVE_INFINITY,
        }),
      ).success,
    ).toBe(false)

    expect(
      wireTelemetryFrameSchema.safeParse(
        createValidFrame({
          spd: Number.NaN,
        }),
      ).success,
    ).toBe(false)
  })

  test('retains representable physical outliers for the later audit', () => {
    const result = wireTelemetryFrameSchema.safeParse(
      createValidFrame({
        spd: 4_021.4,
        rpm: 64_510,
      }),
    )

    expect(result.success).toBe(true)
  })
})

describe('telemetryPayloadSchema', () => {
  test('accepts the official versioned envelope', () => {
    const result = telemetryPayloadSchema.safeParse(createValidPayload())

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.session_id).toBe(
        '7f3a9c1e-0b52-4d84-9a6e-2c1d5f8b41a0',
      )
    }
  })

  test('requires session_id', () => {
    const { session_id: _sessionId, ...payload } = createValidPayload()

    const result = telemetryPayloadSchema.safeParse(payload)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path)).toContainEqual([
        'session_id',
      ])
    }
  })

  test('rejects session_id that is not a UUID', () => {
    const payload = {
      ...createValidPayload(),
      session_id: 'not-a-uuid',
    }

    const result = telemetryPayloadSchema.safeParse(payload)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path)).toContainEqual([
        'session_id',
      ])
    }
  })

  test('rejects a declared frame count that differs from the payload', () => {
    const payload = {
      ...createValidPayload(),
      frame_count: 2,
    }

    const result = telemetryPayloadSchema.safeParse(payload)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['frame_count'],
          message: 'frame_count must equal the number of frames',
        }),
      )
    }
  })

  test('rejects unknown fields in the v1 wire contract', () => {
    const payload = {
      ...createValidPayload(),
      unexpected: true,
    }

    expect(telemetryPayloadSchema.safeParse(payload).success).toBe(false)
  })

  test('rejects a frame array without the official envelope', () => {
    expect(
      telemetryPayloadSchema.safeParse([createValidFrame()]).success,
    ).toBe(false)
  })
})
