import { Hono } from 'hono'
import { ZodError } from 'zod'
import { createTelemetryApplication } from './application/telemetry-application'
import { HTTP_STATUS } from './http/http-status'
import { telemetryPayloadSchema } from './http/schemas/telemetry-payload'
import { zValidate } from './http/z-validate'

export function createApp(): Hono {
  const app = new Hono()
  const telemetryApplication = createTelemetryApplication()

  app.onError((error, context) => {
    if (error instanceof SyntaxError) {
      return context.json(
        {
          error: {
            code: 'MALFORMED_JSON',
            message: 'Request body must contain valid JSON',
          },
        },
        HTTP_STATUS.BAD_REQUEST,
      )
    }

    if (error instanceof ZodError) {
      return context.json(
        {
          error: {
            code: 'INVALID_TELEMETRY_PAYLOAD',
            message: 'Telemetry payload does not match the wire contract',
            issues: error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        },
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
      )
    }

    return context.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unexpected internal error',
        },
      },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    )
  })

  app.post('/ingest', async (context) => {
    const payload = zValidate(telemetryPayloadSchema, await context.req.json())
    const normalizedStint = telemetryApplication.ingest(payload)

    return context.json(
      {
        schema: normalizedStint.schemaVersion,
        sessionId: normalizedStint.sessionId,
        receivedFrames: payload.frames.length,
        normalizedFrames: normalizedStint.frames.length,
      },
      HTTP_STATUS.OK,
    )
  })

  return app
}
