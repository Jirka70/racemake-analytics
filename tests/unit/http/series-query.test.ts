import { describe, expect, test } from 'bun:test'
import type { AnalysisId } from '../../../src/http/contracts/analysis'
import { seriesQuerySchema } from '../../../src/http/schemas/series-query'

const VALID_ANALYSIS_ID = `sha256:${'a1'.repeat(32)}` as AnalysisId

describe('seriesQuerySchema', () => {
  test('parses lap, channel, and position filters', () => {
    expect(
      seriesQuerySchema.parse({
        analysisId: VALID_ANALYSIS_ID,
        laps: '2, 3',
        channels:
          'speedKmh,brakeRatio,throttleRatio,steeringDegrees',
        positionFrom: '0.18',
        positionTo: '0.26',
      }),
    ).toEqual({
      analysisId: VALID_ANALYSIS_ID,
      laps: [2, 3],
      channels: [
        'speedKmh',
        'brakeRatio',
        'throttleRatio',
        'steeringDegrees',
      ],
      positionFrom: 0.18,
      positionTo: 0.26,
    })
  })

  test('requires laps and keeps the remaining filters optional', () => {
    expect(
      seriesQuerySchema.parse({
        analysisId: VALID_ANALYSIS_ID,
        laps: '2',
      }),
    ).toEqual({
      analysisId: VALID_ANALYSIS_ID,
      laps: [2],
    })

    expect(
      seriesQuerySchema.safeParse({
        analysisId: VALID_ANALYSIS_ID,
      }).success,
    ).toBe(false)
  })

  test('allows a position range that crosses the start-finish line', () => {
    expect(
      seriesQuerySchema.parse({
        analysisId: VALID_ANALYSIS_ID,
        laps: '2',
        positionFrom: '0.95',
        positionTo: '0.05',
      }),
    ).toMatchObject({
      positionFrom: 0.95,
      positionTo: 0.05,
    })
  })

  test('rejects invalid or duplicate lap numbers', () => {
    for (const laps of [
      '0,2',
      '2.5,3',
      '2,2',
      'two,3',
      '',
      '1,2,3,4,5,6',
    ]) {
      expect(
        seriesQuerySchema.safeParse({
          analysisId: VALID_ANALYSIS_ID,
          laps,
        }).success,
      ).toBe(false)
    }
  })

  test('rejects unknown or duplicate channels', () => {
    for (const channels of [
      'speedKmh,unknown',
      'speedKmh,speedKmh',
      '',
    ]) {
      expect(
        seriesQuerySchema.safeParse({
          analysisId: VALID_ANALYSIS_ID,
          laps: '2',
          channels,
        }).success,
      ).toBe(false)
    }
  })

  test('rejects positions outside the normalized track range', () => {
    for (const [positionFrom, positionTo] of [
      ['-0.1', '0.5'],
      ['0.5', '1.1'],
      ['invalid', '0.5'],
    ]) {
      expect(
        seriesQuerySchema.safeParse({
          analysisId: VALID_ANALYSIS_ID,
          laps: '2',
          positionFrom,
          positionTo,
        }).success,
      ).toBe(false)
    }
  })

  test('rejects unknown query parameters', () => {
    expect(
      seriesQuerySchema.safeParse({
        analysisId: VALID_ANALYSIS_ID,
        laps: '2',
        detail: 'medium',
      }).success,
    ).toBe(false)
  })
})
