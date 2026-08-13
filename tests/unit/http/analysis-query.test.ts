import { describe, expect, test } from 'bun:test'
import {
  analysisIdSchema,
  analysisQuerySchema,
} from '../../../src/http/schemas/analysis-query'
import type { AnalysisId } from '../../../src/http/contracts/analysis'

const VALID_ANALYSIS_ID = `sha256:${'a1'.repeat(32)}` as AnalysisId

describe('analysisIdSchema', () => {
  test('accepts a lowercase SHA-256 analysis identifier', () => {
    expect(analysisIdSchema.parse(VALID_ANALYSIS_ID)).toBe(
      VALID_ANALYSIS_ID,
    )
  })

  test('rejects an identifier with the wrong hash format', () => {
    for (const analysisId of [
      'analysis-1',
      'sha256:abc',
      `sha256:${'A1'.repeat(32)}`,
    ]) {
      expect(analysisIdSchema.safeParse(analysisId).success).toBe(false)
    }
  })
})

describe('analysisQuerySchema', () => {
  test('accepts exactly one analysisId query parameter', () => {
    expect(
      analysisQuerySchema.parse({
        analysisId: VALID_ANALYSIS_ID,
      }),
    ).toEqual({
      analysisId: VALID_ANALYSIS_ID,
    })
  })

  test('rejects a missing analysisId and unknown query parameters', () => {
    expect(analysisQuerySchema.safeParse({}).success).toBe(false)
    expect(
      analysisQuerySchema.safeParse({
        analysisId: VALID_ANALYSIS_ID,
        unexpected: 'value',
      }).success,
    ).toBe(false)
  })
})
