import { describe, expect, test } from 'bun:test'
import type { WireTelemetryPayload } from '../../../src/analytics/telemetry-types'
import { createAnalysisId } from '../../../src/http/create-analysis-id'

function createPayload(): WireTelemetryPayload {
  return {
    schema: 'racemake.telemetry.stint.v1',
    recorder: { name: 'recorder', version: '1.0.0' },
    session_id: '7f3a9c1e-0b52-4d84-9a6e-2c1d5f8b41a0',
    note: 'test',
    frame_count: 1,
    frames: [{
      ts: 10,
      lap: 1,
      pos: 0.5,
      spd: 100,
      thr: 1,
      brk: 0,
      str: 2,
      gear: 3,
      rpm: 5_000,
      tyres: { fl: 900, fr: 901, rl: 902, rr: 903 },
    }],
  }
}

describe('createAnalysisId', () => {
  test('returns a stable SHA-256 identifier for the same payload', () => {
    const payload = createPayload()

    expect(createAnalysisId(payload)).toBe(createAnalysisId(payload))
    expect(createAnalysisId(payload)).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  test('changes when telemetry changes', () => {
    const payload = createPayload()
    const changedPayload = {
      ...payload,
      frames: [{
        ...payload.frames[0]!,
        spd: 101,
      }],
    }

    expect(createAnalysisId(changedPayload)).not.toBe(
      createAnalysisId(payload),
    )
  })
})
