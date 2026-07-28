import { Hono } from 'hono'
import { ZodError } from 'zod'
import { runTelemetryAuditPipeline } from './application/telemetry-audit-pipeline'
import { DEFAULT_FRAME_AUDIT_CONFIG } from './config/frame-audit-config'
import { HTTP_STATUS } from './http/http-status'

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
    const unknownPayload: unknown = await context.req.json()
    const {
      validatedWirePayload,
      normalizedTelemetry,
      auditResult,
    } =
      runTelemetryAuditPipeline(
        unknownPayload,
        DEFAULT_FRAME_AUDIT_CONFIG,
      )

    return context.json(
      {
        schema: normalizedTelemetry.schemaVersion,
        sessionId: normalizedTelemetry.sessionId,
        receivedFrames: validatedWirePayload.frames.length,
        normalizedFrames: normalizedTelemetry.frames.length,
        audit: {
          isolatedOutlierCount:
            auditResult.isolatedOutliers.length,
          excludedTimelineFrameCount:
            auditResult.usableTimeline
              ?.excludedFrames.length ?? 0,
          continuousTimelineSegmentCount:
            auditResult.continuousTimelineSegments.length,
          channelDiscontinuityCount:
            auditResult.channelDiscontinuities.length,
          issueCount: auditResult.issues.length,
          issues: auditResult.issues,
        },
      },
      HTTP_STATUS.OK,
    )
  })

  return app
}
