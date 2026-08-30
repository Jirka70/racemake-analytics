import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { bodyLimit } from 'hono/body-limit'
import { ZodError } from 'zod'
import { UnsafeTelemetryComputationError } from './analytics/util/require-finite-result'
import { DEFAULT_FRAME_AUDIT_CONFIG } from './config/frame-audit-config'
import { MAX_TELEMETRY_INGEST_SIZE_BYTES } from './config/telemetry-ingest-config'
import { createInMemoryAnalysisStore } from './http/analysis-store'
import { API_ERRORS } from './http/api-errors'
import { ApiRequestError } from './http/api-request-error'
import { getCoaching } from './http/get-coaching'
import { getDiagnostics } from './http/get-diagnostics'
import { getFragmentSeries } from './http/get-fragment-series'
import { getIdealLap } from './http/get-ideal-lap'
import { getLaps } from './http/get-laps'
import { getSeries } from './http/get-series'
import { getTimeLoss } from './http/get-time-loss'
import { getTrack } from './http/get-track'
import { HTTP_STATUS } from './http/http-status'
import { ingestTelemetryAnalysis } from './http/ingest-telemetry-analysis'
import { UNSUPPORTED_RECORDER_VALUE_MESSAGE } from './http/schemas/telemetry-payload'
import { streamIngestTelemetryAnalysis } from './http/stream-ingest-telemetry-analysis'

export function createApp(): Hono {
  const app = new Hono()
  const analysisStore = createInMemoryAnalysisStore({
    maximumEntryCount: 5,
  })
  const telemetryBodyLimit = bodyLimit({
    maxSize: MAX_TELEMETRY_INGEST_SIZE_BYTES,
    onError: (context) => {
      const { status, ...apiError } = API_ERRORS.TELEMETRY_PAYLOAD_TOO_LARGE
      return context.json({ error: apiError }, status)
    },
  })

  app.onError((error, context) => {
    if (error instanceof UnsafeTelemetryComputationError) {
      const { status, ...apiError } = API_ERRORS.UNSAFE_TELEMETRY_VALUES
      return context.json({ error: apiError }, status)
    }

    if (error instanceof ApiRequestError) {
      const { status, ...apiError } = API_ERRORS[error.code]
      return context.json(
        {
          error: {
            ...apiError,
            ...(error.issues ? { issues: error.issues } : {}),
          },
        },
        status,
      )
    }

    if (error instanceof SyntaxError) {
      const { status, ...apiError } = API_ERRORS.MALFORMED_JSON
      return context.json(
        {
          error: apiError,
        },
        status,
      )
    }

    if (error instanceof ZodError) {
      const containsUnsupportedRecorderValue = error.issues.some((issue) => {
        const field = issue.path.at(-1)
        return issue.message === UNSUPPORTED_RECORDER_VALUE_MESSAGE
          && (field === 'spd' || field === 'str')
      })
      const definition = containsUnsupportedRecorderValue
        ? API_ERRORS.UNSAFE_TELEMETRY_VALUES
        : API_ERRORS.INVALID_TELEMETRY_PAYLOAD
      const { status, ...apiError } = definition
      return context.json(
        {
          error: {
            ...apiError,
            ...(containsUnsupportedRecorderValue
              ? {}
              : {
                  issues: error.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                  })),
                }),
          },
        },
        status,
      )
    }

    const { status, ...apiError } = API_ERRORS.INTERNAL_ERROR
    return context.json(
      {
        error: apiError,
      },
      status,
    )
  })

  app.post('/ingest', telemetryBodyLimit, async (context) => {
    const input: unknown = await context.req.json()
    const response = ingestTelemetryAnalysis(
      input,
      {
        analysisStore,
        frameAuditConfig: DEFAULT_FRAME_AUDIT_CONFIG,
      },
    )

    return context.json(response, HTTP_STATUS.OK)
  })

  app.post('/ingest/stream', telemetryBodyLimit, (context) =>
    streamIngestTelemetryAnalysis(context, {
      analysisStore,
      frameAuditConfig: DEFAULT_FRAME_AUDIT_CONFIG,
    }),
  )

  app.get('/laps', (context) => {
    const response = getLaps(context.req.query(), analysisStore)
    return context.json(response, HTTP_STATUS.OK)
  })

  app.get('/track', (context) => {
    const response = getTrack(context.req.query(), analysisStore)
    return context.json(response, HTTP_STATUS.OK)
  })

  app.get('/time-loss', (context) => {
    const response = getTimeLoss(context.req.query(), analysisStore)
    return context.json(response, HTTP_STATUS.OK)
  })

  app.get('/ideal-lap', (context) => {
    const response = getIdealLap(context.req.query(), analysisStore)
    return context.json(response, HTTP_STATUS.OK)
  })

  app.get('/coaching', (context) => {
    const response = getCoaching(context.req.query(), analysisStore)
    return context.json(response, HTTP_STATUS.OK)
  })

  app.get('/series', (context) => {
    const response = getSeries(context.req.query(), analysisStore)
    return context.json(response, HTTP_STATUS.OK)
  })

  app.get('/fragment-series', (context) => {
    const response = getFragmentSeries(
      context.req.query(),
      analysisStore,
    )
    return context.json(response, HTTP_STATUS.OK)
  })

  app.get('/diagnostics', (context) => {
    const response = getDiagnostics(context.req.query(), analysisStore)
    return context.json(response, HTTP_STATUS.OK)
  })

  app.use('/assets/*', serveStatic({ root: './dist/frontend' }))
  app.get('*', serveStatic({ path: './dist/frontend/index.html' }))

  return app
}
