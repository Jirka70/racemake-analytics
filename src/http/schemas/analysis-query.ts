import { z } from 'zod'
import type {
  AnalysisId,
  AnalysisQuery,
} from '../contracts/analysis'

const SHA256_ANALYSIS_ID_PATTERN = /^sha256:[0-9a-f]{64}$/

export const analysisIdSchema = z
  .string()
  .regex(
    SHA256_ANALYSIS_ID_PATTERN,
    'analysisId must use the format sha256:<64 lowercase hexadecimal characters>',
  )
  .transform((analysisId): AnalysisId => analysisId as AnalysisId)

export const analysisQuerySchema: z.ZodType<AnalysisQuery> = z.strictObject({
  analysisId: analysisIdSchema,
})
