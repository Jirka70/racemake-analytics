import { describe, expect, test } from 'bun:test'
import { createApp } from '../../src/app'
import type { ProcessingIssue } from '../../src/analytics/frame-audit-types'
import type { PositionCalibration } from '../../src/analytics/lap-detect/lap-detect-types'
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

interface IngestResponse {
  readonly schema: string
  readonly sessionId: string
  readonly receivedFrames: number
  readonly normalizedFrames: number
  readonly audit: {
    readonly isolatedOutlierCount: number
    readonly excludedTimelineFrameCount: number
    readonly continuousTimelineSegmentCount: number
    readonly channelDiscontinuityCount: number
    readonly issueCount: number
    readonly issues: readonly ProcessingIssue[]
  }
  readonly lapDetection: {
    readonly positionCalibrationAvailable: boolean
  }
}

interface LapsResponse {
  readonly sessionId: string
  readonly positionCalibration: PositionCalibration | null
}

describe('POST /ingest', () => {
  test('returns conflict from GET /laps before a successful ingest', async () => {
    const response = await createApp().request('/laps')

    expect(response.status).toBe(HTTP_STATUS.CONFLICT)
    expect(await response.json()).toEqual({
      error: {
        code: 'NO_ACTIVE_DATASET',
        message:
          'Ingest a valid telemetry dataset before requesting laps',
      },
    })
  })

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
    const body = (await response.json()) as IngestResponse

    expect(body).toMatchObject({
      schema: stint.schema,
      sessionId: stint.session_id,
      receivedFrames: stint.frames.length,
      normalizedFrames: stint.frames.length,
    })
    expect(body.audit.isolatedOutlierCount).toBeGreaterThanOrEqual(0)
    expect(body.audit.excludedTimelineFrameCount).toBeGreaterThanOrEqual(0)
    expect(body.audit.continuousTimelineSegmentCount).toBeGreaterThan(0)
    expect(body.audit.channelDiscontinuityCount).toBeGreaterThanOrEqual(0)
    expect(body.audit.issueCount).toBe(body.audit.issues.length)
    expect(body.audit.issues.length).toBeGreaterThan(0)
    expect(new Set(body.audit.issues.map((issue) => issue.id)).size).toBe(body.audit.issues.length)
    expect(body.lapDetection.positionCalibrationAvailable).toBeTrue()
  })

  test('exposes position calibration and keeps it active after a failed ingest', async () => {
    const app = createApp()
    const stintJson = await Bun.file(stintPath).text()
    const stint = JSON.parse(stintJson) as StintEnvelope

    const ingestResponse = await app.request('/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: stintJson,
    })

    expect(ingestResponse.status).toBe(HTTP_STATUS.OK)

    const firstLapsResponse = await app.request('/laps')
    expect(firstLapsResponse.status).toBe(HTTP_STATUS.OK)

    const firstLaps = (await firstLapsResponse.json()) as LapsResponse
    expect(firstLaps.sessionId).toBe(stint.session_id)
    expect(firstLaps.positionCalibration).not.toBeNull()

    const invalidIngestResponse = await app.request('/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ frames: [] }),
    })

    expect(invalidIngestResponse.status).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY)

    const retainedLapsResponse = await app.request('/laps')
    expect(retainedLapsResponse.status).toBe(HTTP_STATUS.OK)
    expect(await retainedLapsResponse.json()).toEqual(firstLaps)
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
