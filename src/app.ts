import { Hono } from 'hono'
import { ZodError } from 'zod'
import { telemetryPayloadSchema } from './http/schemas/telemetry-payload'
import { zValidate } from './http/z-validate'

export function createApp(): Hono {
  const app = new Hono()

  app.onError((error, context) => {
    if (error instanceof SyntaxError) {
      return context.json(
        {
          error: {
            code: 'MALFORMED_JSON',
            message: 'Request body must contain valid JSON',
          },
        },
        400,
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
        422,
      )
    }

    return context.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unexpected internal error',
        },
      },
      500,
    )
  })

  app.post('/ingest', async (context) => {
    const payload = zValidate(telemetryPayloadSchema, await context.req.json())

    return context.json({
      schema: payload.schema,
      receivedFrames: payload.frame_count,
      validatedFrames: payload.frames.length,
    })
  })

  return app
}
