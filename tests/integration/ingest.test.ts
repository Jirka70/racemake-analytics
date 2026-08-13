import { describe, expect, test } from 'bun:test'
import { createApp } from '../../src/app'
import type { AnalysisResponseContext } from '../../src/http/contracts/analysis'
import type { IngestResponse } from '../../src/http/contracts/ingest'
import type { LapsResponse } from '../../src/http/contracts/laps'
import type { SeriesResponse } from '../../src/http/contracts/series'
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

const analysisEndpointPaths = [
  '/laps',
  '/track',
  '/time-loss',
  '/coaching',
  '/series',
  '/diagnostics',
] as const

describe('POST /ingest', () => {
  test('requires analysisId for every analysis endpoint', async () => {
    const app = createApp()

    for (const path of analysisEndpointPaths) {
      const response = await app.request(path)

      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST)
      expect(await response.json()).toEqual({
        error: {
          code: 'ANALYSIS_ID_REQUIRED',
          message: 'Provide an analysisId returned by POST /ingest',
        },
      })
    }
  })

  test('Zod-validates analysis IDs for every analysis endpoint', async () => {
    const app = createApp()

    for (const path of analysisEndpointPaths) {
      const invalidResponse = await app.request(`${path}?analysisId=invalid`)

      expect(invalidResponse.status).toBe(HTTP_STATUS.BAD_REQUEST)
      expect(await invalidResponse.json()).toEqual({
        error: {
          code: 'INVALID_QUERY',
          message: 'Request query parameters are invalid',
          issues: [
            {
              path: 'analysisId',
              message:
                'analysisId must use the format sha256:<64 lowercase hexadecimal characters>',
            },
          ],
        },
      })

      const unknownAnalysisId = `sha256:${'0'.repeat(64)}`
      const unknownResponse = await app.request(
        `${path}?analysisId=${unknownAnalysisId}`,
      )

      expect(unknownResponse.status).toBe(HTTP_STATUS.NOT_FOUND)
      expect(await unknownResponse.json()).toEqual({
        error: {
          code: 'ANALYSIS_NOT_FOUND',
          message: 'The requested analysis does not exist',
        },
      })
    }
  })

  test('validates the complete official telemetry stint', async () => {
    const stintJson = await Bun.file(stintPath).text()
    const stint = JSON.parse(stintJson) as StintEnvelope
    const app = createApp()

    const response = await app.request('/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: stintJson,
    })

    expect(response.status).toBe(HTTP_STATUS.OK)
    const body = (await response.json()) as IngestResponse

    expect(body).toMatchObject({
      sessionId: stint.session_id,
      telemetrySchema: stint.schema,
      status: 'ready',
      cacheHit: false,
      receivedFrameCount: stint.frames.length,
    })
    expect(body.analysisId).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(
      body.retainedTimelineFrameCount + body.excludedTimelineFrameCount,
    ).toBe(body.receivedFrameCount)
    expect(body.detectedLapCount).toBeGreaterThan(0)
    expect(body.racingLapCount).toBeGreaterThan(0)
    expect(body.racingLapCount).toBeLessThanOrEqual(body.detectedLapCount)
    expect(body.detectedCornerCount).toBeGreaterThan(0)
    expect(body.rankedPhenomenonCount).toBeGreaterThanOrEqual(0)
    expect(body.detectorFailureCount).toBeGreaterThanOrEqual(0)

    const cachedResponse = await app.request('/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: stintJson,
    })
    const cachedBody = (await cachedResponse.json()) as IngestResponse

    expect(cachedBody).toEqual({
      ...body,
      cacheHit: true,
    })
  })

  test('returns lap analysis by ID after a later failed ingest', async () => {
    const app = createApp()
    const stintJson = await Bun.file(stintPath).text()
    const stint = JSON.parse(stintJson) as StintEnvelope

    const ingestResponse = await app.request('/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: stintJson,
    })

    expect(ingestResponse.status).toBe(HTTP_STATUS.OK)
    const ingest = (await ingestResponse.json()) as IngestResponse
    const lapsUrl = `/laps?analysisId=${encodeURIComponent(ingest.analysisId)}`

    const firstLapsResponse = await app.request(lapsUrl)
    expect(firstLapsResponse.status).toBe(HTTP_STATUS.OK)

    const firstLaps = (await firstLapsResponse.json()) as LapsResponse
    expect(firstLaps.analysisId).toBe(ingest.analysisId)
    expect(firstLaps.sessionId).toBe(stint.session_id)
    expect(firstLaps.laps.length).toBeGreaterThan(0)
    expect(
      firstLaps.laps.every(
        (lap) =>
          lap.lapNumber > 0 &&
          lap.lapTimeMs > 0 &&
          lap.confidence.overall >= 0 &&
          lap.confidence.overall <= 1,
      ),
    ).toBeTrue()
    expect(
      firstLaps.laps.some((lap) => lap.eligibility === 'racing'),
    ).toBeTrue()

    const invalidIngestResponse = await app.request('/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ frames: [] }),
    })

    expect(invalidIngestResponse.status).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY)

    const retainedLapsResponse = await app.request(lapsUrl)
    expect(retainedLapsResponse.status).toBe(HTTP_STATUS.OK)
    expect(await retainedLapsResponse.json()).toEqual(firstLaps)
  })

  test('serves every analysis response from the ingested analysis ID', async () => {
    const app = createApp()
    const stintJson = await Bun.file(stintPath).text()
    const stint = JSON.parse(stintJson) as StintEnvelope
    const ingestResponse = await app.request('/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: stintJson,
    })
    const ingest = (await ingestResponse.json()) as IngestResponse

    for (const path of analysisEndpointPaths) {
      const response = await app.request(
        `${path}?analysisId=${encodeURIComponent(ingest.analysisId)}`,
      )

      expect(response.status).toBe(HTTP_STATUS.OK)
      const body = (await response.json()) as AnalysisResponseContext
      expect(body.analysisId).toBe(ingest.analysisId)
      expect(body.sessionId).toBe(stint.session_id)
    }
  })

  test('filters series by racing lap, channel, and track position', async () => {
    const app = createApp()
    const stintJson = await Bun.file(stintPath).text()
    const ingestResponse = await app.request('/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: stintJson,
    })
    const ingest = (await ingestResponse.json()) as IngestResponse
    const lapsResponse = await app.request(
      `/laps?analysisId=${encodeURIComponent(ingest.analysisId)}`,
    )
    const laps = (await lapsResponse.json()) as LapsResponse
    const racingLap = laps.laps.find(
      (lap) => lap.eligibility === 'racing',
    )
    if (!racingLap) throw new Error('Expected at least one racing lap')

    const response = await app.request(
      `/series?analysisId=${encodeURIComponent(ingest.analysisId)}`
      + `&laps=${racingLap.lapNumber}`
      + '&channels=speedKmh,brakeRatio'
      + '&positionFrom=0.18&positionTo=0.26',
    )

    expect(response.status).toBe(HTTP_STATUS.OK)
    const series = (await response.json()) as SeriesResponse
    expect(series.selection).toEqual({
      lapNumbers: [racingLap.lapNumber],
      channels: ['speedKmh', 'brakeRatio'],
      positionFrom: 0.18,
      positionTo: 0.26,
    })
    expect(series.laps).toHaveLength(1)
    expect(Object.keys(series.laps[0]?.channels ?? {})).toEqual([
      'speedKmh',
      'brakeRatio',
    ])
    expect(series.grid.normalizedTrackPositions.length).toBeGreaterThan(0)
    expect(
      series.grid.normalizedTrackPositions.every(
        (position) => position >= 0.18 && position <= 0.26,
      ),
    ).toBeTrue()
    expect(series.laps[0]?.lapElapsedMs).toHaveLength(
      series.grid.normalizedTrackPositions.length,
    )
    expect(series.laps[0]?.channels.speedKmh).toHaveLength(
      series.grid.normalizedTrackPositions.length,
    )
    expect(series.laps[0]?.channels.brakeRatio).toHaveLength(
      series.grid.normalizedTrackPositions.length,
    )
  })

  test('rejects invalid series filters and unavailable racing laps', async () => {
    const app = createApp()
    const stintJson = await Bun.file(stintPath).text()
    const ingestResponse = await app.request('/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: stintJson,
    })
    const ingest = (await ingestResponse.json()) as IngestResponse
    const analysisId = encodeURIComponent(ingest.analysisId)

    const invalidChannelResponse = await app.request(
      `/series?analysisId=${analysisId}&channels=speedKmh,unknown`,
    )
    expect(invalidChannelResponse.status).toBe(HTTP_STATUS.BAD_REQUEST)
    expect(
      (await invalidChannelResponse.json() as ErrorResponse).error.code,
    ).toBe('INVALID_QUERY')

    const unavailableLapResponse = await app.request(
      `/series?analysisId=${analysisId}&laps=999999`,
    )
    expect(unavailableLapResponse.status).toBe(HTTP_STATUS.BAD_REQUEST)
    expect(await unavailableLapResponse.json()).toEqual({
      error: {
        code: 'INVALID_QUERY',
        message: 'Request query parameters are invalid',
        issues: [{
          path: 'laps',
          message:
            'Lap 999999 is not available as a racing lap in this analysis',
        }],
      },
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
