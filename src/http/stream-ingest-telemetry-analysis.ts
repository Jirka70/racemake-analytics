import type { Context } from 'hono'
import { stream } from 'hono/streaming'
import { API_ERRORS } from './api-errors'
import type { IngestStreamEvent } from './contracts/ingest-progress'
import {
  ingestValidatedTelemetryAnalysisWithProgress,
  type IngestTelemetryAnalysisDependencies,
} from './ingest-telemetry-analysis'
import { telemetryPayloadSchema } from './schemas/telemetry-payload'
import { zValidate } from './z-validate'

export async function streamIngestTelemetryAnalysis(
  context: Context,
  dependencies: IngestTelemetryAnalysisDependencies,
): Promise<Response> {
  const input: unknown = await context.req.json()
  const validatedWirePayload = zValidate(
    telemetryPayloadSchema,
    input,
  )

  context.header(
    'Content-Type',
    'application/x-ndjson; charset=utf-8',
  )
  context.header('Cache-Control', 'no-store')
  context.header('X-Content-Type-Options', 'nosniff')

  return stream(context, async (output) => {
    const writeEvent = async (
      event: IngestStreamEvent,
    ): Promise<void> => {
      await output.writeln(JSON.stringify(event))
      await output.sleep(0)
    }

    try {
      const response =
        await ingestValidatedTelemetryAnalysisWithProgress(
          validatedWirePayload,
          dependencies,
          (progress) => writeEvent({
            type: 'progress',
            ...progress,
          }),
        )

      await writeEvent({
        type: 'completed',
        response,
      })
    } catch {
      const { status: _status, ...error } = API_ERRORS.INTERNAL_ERROR

      await writeEvent({
        type: 'failed',
        error,
      })
    }
  })
}
