import { describe, expect, test } from 'bun:test'
import {
  formatLapDeltaMs,
  formatLapTimeMs,
} from '../../../frontend/src/components/analysis/laps/lap-time-format'

describe('lap time formatting', () => {
  test('formats a rounded lap duration as minutes, seconds and milliseconds', () => {
    expect(formatLapTimeMs(73_462.221)).toBe('1:13.462')
  })

  test('carries rounded milliseconds into the next minute', () => {
    expect(formatLapTimeMs(59_999.6)).toBe('1:00.000')
  })

  test('formats positive and negative deltas in seconds', () => {
    expect(formatLapDeltaMs(551)).toBe('+0.551 s')
    expect(formatLapDeltaMs(-72)).toBe('−0.072 s')
  })
})
