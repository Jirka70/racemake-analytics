import { describe, expect, test } from 'bun:test'
import { ZodError } from 'zod'
import { runTelemetryAuditPipeline } from '../../src/application/telemetry-audit-pipeline'
import { DEFAULT_FRAME_AUDIT_CONFIG } from '../../src/config/frame-audit-config'

const stintPath = `${import.meta.dir}/../../data/stint.telemetry.json`

describe('telemetry audit pipeline', () => {
  test('validates, normalizes, and audits the official stint in one pass', async () => {
    const unknownPayload: unknown = await Bun.file(stintPath).json()
    const result = runTelemetryAuditPipeline(
      unknownPayload,
      DEFAULT_FRAME_AUDIT_CONFIG,
    )

    const wireFrames = result.validatedWirePayload.frames
    const normalizedFrames = result.normalizedTelemetry.frames
    const diagnostics = result.auditResult.diagnostics

    expect(normalizedFrames).toHaveLength(wireFrames.length)
    expect(result.auditResult.telemetry).toBe(result.normalizedTelemetry)
    expect(normalizedFrames[0]?.sourceIndex).toBe(0)
    expect(normalizedFrames[0]?.tyreCoreTemperatureC.frontLeft).toBe(
      (wireFrames[0]?.tyres.fl ?? Number.NaN) / 10,
    )
    expect(
      diagnostics.acceptedFrameCount +
        diagnostics.suspectFrameCount +
        diagnostics.rejectedFrameCount,
    ).toBe(wireFrames.length)
  })

  test('stops at Zod validation for an invalid payload', () => {
    expect(() =>
      runTelemetryAuditPipeline({}, DEFAULT_FRAME_AUDIT_CONFIG),
    ).toThrow(ZodError)
  })
})
