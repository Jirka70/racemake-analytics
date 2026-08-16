import { describe, expect, test } from 'bun:test'
import type { AnalysisId } from '../../../src/http/contracts/analysis'
import { idealLapQuerySchema } from '../../../src/http/schemas/ideal-lap-query'

const VALID_ANALYSIS_ID = `sha256:${'a1'.repeat(32)}` as AnalysisId

describe('idealLapQuerySchema', () => {
  test('parses optional channel and position filters without lap numbers', () => {
    expect(
      idealLapQuerySchema.parse({
        analysisId: VALID_ANALYSIS_ID,
        channels: 'speedKmh,brakeRatio',
        positionFrom: '0.18',
        positionTo: '0.26',
      }),
    ).toEqual({
      analysisId: VALID_ANALYSIS_ID,
      channels: ['speedKmh', 'brakeRatio'],
      positionFrom: 0.18,
      positionTo: 0.26,
    })
  })

  test('requires only the analysis ID', () => {
    expect(
      idealLapQuerySchema.parse({
        analysisId: VALID_ANALYSIS_ID,
      }),
    ).toEqual({
      analysisId: VALID_ANALYSIS_ID,
    })
  })

  test('rejects unsupported filters and invalid values', () => {
    for (const query of [
      { analysisId: VALID_ANALYSIS_ID, laps: '2' },
      { analysisId: VALID_ANALYSIS_ID, channels: 'speedKmh,unknown' },
      { analysisId: VALID_ANALYSIS_ID, channels: 'speedKmh,speedKmh' },
      { analysisId: VALID_ANALYSIS_ID, positionFrom: '-0.1' },
      { analysisId: VALID_ANALYSIS_ID, positionTo: '1.1' },
    ]) {
      expect(idealLapQuerySchema.safeParse(query).success).toBe(false)
    }
  })
})
