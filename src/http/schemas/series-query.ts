import { z } from 'zod'
import {
  SERIES_CHANNELS,
  type SeriesQuery,
} from '../contracts/series'
import { analysisIdSchema } from './analysis-query'

const commaSeparatedLapNumbersSchema = z
  .string()
  .transform((value) => value.split(',').map((item) => item.trim()))
  .pipe(
    z.array(
      z
        .string()
        .regex(/^\d+$/, 'Lap number must be a positive integer')
        .transform(Number)
        .pipe(z.number().int().positive()),
    )
      .min(1)
      .max(5, 'Select no more than 5 laps'),
  )
  .refine(
    (lapNumbers) =>
      new Set(lapNumbers).size === lapNumbers.length,
    'Lap numbers must be unique',
  )

const commaSeparatedChannelsSchema = z
  .string()
  .transform((value) => value.split(',').map((item) => item.trim()))
  .pipe(z.array(z.enum(SERIES_CHANNELS)).min(1))
  .refine(
    (channels) =>
      new Set(channels).size === channels.length,
    'Series channels must be unique',
  )

const normalizedTrackPositionSchema = z.coerce
  .number()
  .min(0)
  .max(1)

export const seriesQuerySchema: z.ZodType<SeriesQuery> =
  z.strictObject({
    analysisId: analysisIdSchema,
    laps: commaSeparatedLapNumbersSchema,
    channels: commaSeparatedChannelsSchema.optional(),
    positionFrom: normalizedTrackPositionSchema.optional(),
    positionTo: normalizedTrackPositionSchema.optional(),
  })
