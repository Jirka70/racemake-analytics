import { describe, expect, test } from 'bun:test'
import { createApp } from '../../src/app'
import { HTTP_STATUS } from '../../src/http/http-status'

const stintPath = `${import.meta.dir}/../../data/stint.telemetry.json`

interface StintEnvelope {
  schema: string
  session_id: string
  frame_count: number
  frames: readonly unknown[]
}

interface ErrorResponse {
  error: {
    code: string
    issues: Array<{
      path: string
    }>
  }
}

describe('POST /ingest', () => {
  test('validates the complete official telemetry stint', async () => {
    const stintJson = await Bun.file(stintPath).text()
    const stint = JSON.parse(stintJson) as StintEnvelope

    const response = await createApp().request('/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: stintJson,
    })

    expect(response.status).toBe(HTTP_STATUS.OK)
    expect(await response.json()).toEqual({
      schema: stint.schema,
      sessionId: stint.session_id,
      receivedFrames: stint.frame_count,
      validatedFrames: stint.frames.length,
    })
  })

  test('returns unprocessable entity for an invalid payload', async () => {
    const response = await createApp().request('/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        schema: 'racemake.telemetry.stint.v1',
        recorder: {
          name: 'racemake-agent',
          version: '0.1.2874',
        },
        session_id: '7f3a9c1e-0b52-4d84-9a6e-2c1d5f8b41a0',
        note: 'invalid test payload',
        frame_count: 1,
        frames: [],
      }),
    })

    expect(response.status).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY)
    const body = (await response.json()) as ErrorResponse

    expect(body.error.code).toBe('INVALID_TELEMETRY_PAYLOAD')
    expect(body.error.issues.map((issue) => issue.path)).toEqual([
      'frames',
      'frame_count',
    ])
  })
})
