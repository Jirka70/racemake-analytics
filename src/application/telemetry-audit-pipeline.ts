import { auditTelemetry } from '../analytics/audit-telemetry'
import type {
  FrameAuditConfig,
  TelemetryAuditResult,
} from '../analytics/frame-audit-types'
import { normalizeTelemetryPayload } from '../analytics/normalize-telemetry'
import type {
  NormalizedTelemetryStint,
  WireTelemetryPayload,
} from '../analytics/telemetry-types'
import { telemetryPayloadSchema } from '../http/schemas/telemetry-payload'
import { zValidate } from '../http/z-validate'

export interface TelemetryAuditPipelineResult {
  readonly validatedWirePayload: WireTelemetryPayload
  readonly normalizedTelemetry: NormalizedTelemetryStint
  readonly auditResult: TelemetryAuditResult
}

/**
 * Runs the complete pre-analysis pipeline in production order.
 *
 * Keeping these stages together gives the CLI runner and integration tests one
 * path to exercise while the individual operations remain independently
 * testable.
 */
export function runTelemetryAuditPipeline(
  input: unknown,
  config: FrameAuditConfig,
): TelemetryAuditPipelineResult {
  // Intentional debug stops for walking an ingest request through each phase.
  const validatedWirePayload = zValidate(telemetryPayloadSchema, input)
  const normalizedTelemetry = normalizeTelemetryPayload(validatedWirePayload)
  const auditResult = auditTelemetry(normalizedTelemetry, config)
  debugger

  return Object.freeze({
    validatedWirePayload,
    normalizedTelemetry,
    auditResult,
  })
}
