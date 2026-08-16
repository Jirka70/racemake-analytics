import { z } from 'zod'
import {
  ANALYSIS_STAGES,
  type AnalysisProgressDetails,
  type IngestResponse,
  type IngestStreamEvent,
} from '../../../../src/http/contracts'
import {
  API_ERRORS,
  type ApiErrorCode,
} from '../../../../src/http/api-errors'
import { analysisIdSchema } from '../../../../src/http/schemas/analysis-query'

const nonnegativeIntegerSchema = z.int().nonnegative()
const apiErrorCodeSchema = z.custom<ApiErrorCode>(
  (value) =>
    typeof value === 'string'
    && Object.hasOwn(API_ERRORS, value),
)

const analysisProgressDetailsSchema:
  z.ZodType<AnalysisProgressDetails> = z.strictObject({
    receivedFrameCount: nonnegativeIntegerSchema.optional(),
    retainedTimelineFrameCount: nonnegativeIntegerSchema.optional(),
    excludedTimelineFrameCount: nonnegativeIntegerSchema.optional(),
    detectedLapCount: nonnegativeIntegerSchema.optional(),
    racingLapCount: nonnegativeIntegerSchema.optional(),
    detectedCornerCount: nonnegativeIntegerSchema.optional(),
    rankedPhenomenonCount: nonnegativeIntegerSchema.optional(),
    detectorFailureCount: nonnegativeIntegerSchema.optional(),
  })

const ingestResponseSchema: z.ZodType<IngestResponse> = z.strictObject({
  analysisId: analysisIdSchema,
  sessionId: z.string(),
  telemetrySchema: z.string(),
  status: z.literal('ready'),
  cacheHit: z.boolean(),
  receivedFrameCount: nonnegativeIntegerSchema,
  retainedTimelineFrameCount: nonnegativeIntegerSchema,
  excludedTimelineFrameCount: nonnegativeIntegerSchema,
  detectedLapCount: nonnegativeIntegerSchema,
  racingLapCount: nonnegativeIntegerSchema,
  detectedCornerCount: nonnegativeIntegerSchema,
  rankedPhenomenonCount: nonnegativeIntegerSchema,
  detectorFailureCount: nonnegativeIntegerSchema,
})

const progressEventSchema = z.strictObject({
  type: z.literal('progress'),
  stage: z.enum(ANALYSIS_STAGES),
  status: z.enum(['running', 'completed']),
  completedStageCount: nonnegativeIntegerSchema,
  totalStageCount: z.int().positive(),
  details: analysisProgressDetailsSchema.optional(),
})

const completedEventSchema = z.strictObject({
  type: z.literal('completed'),
  response: ingestResponseSchema,
})

const failedEventSchema = z.strictObject({
  type: z.literal('failed'),
  error: z.strictObject({
    code: apiErrorCodeSchema,
    message: z.string(),
    issues: z.array(z.strictObject({
      path: z.string(),
      message: z.string(),
    })).optional(),
  }),
})

export const ingestStreamEventSchema: z.ZodType<IngestStreamEvent> =
  z.discriminatedUnion('type', [
    progressEventSchema,
    completedEventSchema,
    failedEventSchema,
  ])
