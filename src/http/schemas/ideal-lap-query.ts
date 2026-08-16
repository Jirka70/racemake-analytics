import { z } from 'zod'
import type { IdealLapQuery } from '../contracts/ideal-lap'
import { SERIES_CHANNELS } from '../contracts/series'
import { analysisIdSchema } from './analysis-query'

const commaSeparatedChannelsSchema = z
  .string()
  .transform((value) => value.split(',').map((item) => item.trim()))
  .pipe(z.array(z.enum(SERIES_CHANNELS)).min(1))
  .refine(
    (channels) => new Set(channels).size === channels.length,
    'Series channels must be unique',
  )

const normalizedTrackPositionSchema = z.coerce.number().min(0).max(1)

export const idealLapQuerySchema: z.ZodType<IdealLapQuery> = z.strictObject({
  analysisId: analysisIdSchema,
  channels: commaSeparatedChannelsSchema.optional(),
  positionFrom: normalizedTrackPositionSchema.optional(),
  positionTo: normalizedTrackPositionSchema.optional(),
})
