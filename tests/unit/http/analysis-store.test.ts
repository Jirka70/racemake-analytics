import { describe, expect, test } from 'bun:test'
import type { TelemetryAuditPipelineResult } from '../../../src/application/telemetry-audit-pipeline'
import { createInMemoryAnalysisStore } from '../../../src/http/analysis-store'
import type { AnalysisId } from '../../../src/http/contracts/analysis'

function createAnalysisId(character: string): AnalysisId {
  return `sha256:${character.repeat(64)}`
}

const FIRST_ANALYSIS = {} as TelemetryAuditPipelineResult
const SECOND_ANALYSIS = {} as TelemetryAuditPipelineResult
const THIRD_ANALYSIS = {} as TelemetryAuditPipelineResult

describe('createInMemoryAnalysisStore', () => {
  test('rejects a non-positive maximum entry count', () => {
    expect(() =>
      createInMemoryAnalysisStore({ maximumEntryCount: 0 }),
    ).toThrow(RangeError)
  })

  test('evicts the least recently used analysis', () => {
    const store = createInMemoryAnalysisStore({ maximumEntryCount: 2 })
    const firstId = createAnalysisId('1')
    const secondId = createAnalysisId('2')
    const thirdId = createAnalysisId('3')

    store.set(firstId, FIRST_ANALYSIS)
    store.set(secondId, SECOND_ANALYSIS)
    expect(store.get(firstId)).toBe(FIRST_ANALYSIS)

    store.set(thirdId, THIRD_ANALYSIS)

    expect(store.get(firstId)).toBe(FIRST_ANALYSIS)
    expect(store.get(secondId)).toBeNull()
    expect(store.get(thirdId)).toBe(THIRD_ANALYSIS)
  })
})
