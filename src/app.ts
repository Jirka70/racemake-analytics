import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { ZodError } from 'zod'
import { DEFAULT_FRAME_AUDIT_CONFIG } from './config/frame-audit-config'
import { createInMemoryAnalysisStore } from './http/analysis-store'
import { API_ERRORS } from './http/api-errors'
import { ApiRequestError } from './http/api-request-error'
import { getCoaching } from './http/get-coaching'
import { getDiagnostics } from './http/get-diagnostics'
import { getIdealLap } from './http/get-ideal-lap'
import { getLaps } from './http/get-laps'
import { getSeries } from './http/get-series'
import { getTimeLoss } from './http/get-time-loss'
import { getTrack } from './http/get-track'
import { HTTP_STATUS } from './http/http-status'
import { ingestTelemetryAnalysis } from './http/ingest-telemetry-analysis'
import { streamIngestTelemetryAnalysis } from './http/stream-ingest-telemetry-analysis'

export function createApp(): Hono {
  const app = new Hono()
  const analysisStore = createInMemoryAnalysisStore({
    maximumEntryCount: 5,
  })

  app.onError((error, context) => {
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
      const { status, ...apiError } = API_ERRORS.INVALID_TELEMETRY_PAYLOAD
      return context.json(
        {
          error: {
            ...apiError,
            issues: error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
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

  app.post('/ingest', async (context) => {
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

  app.post('/ingest/stream', (context) =>
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

  app.get('/diagnostics', (context) => {
    const response = getDiagnostics(context.req.query(), analysisStore)
    return context.json(response, HTTP_STATUS.OK)
  })

  app.use('/assets/*', serveStatic({ root: './dist/frontend' }))
  app.get('*', serveStatic({ path: './dist/frontend/index.html' }))

  return app
}
