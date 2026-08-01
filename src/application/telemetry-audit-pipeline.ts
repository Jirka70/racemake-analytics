import { auditTelemetry } from '../analytics/audit-telemetry'
import { detectLaps } from '../analytics/lap-detect/detect-laps'
import type {
  FrameAuditConfig,
  TelemetryAuditResult,
} from '../analytics/frame-audit-types'
import type {
  LapDetectionConfig,
  LapDetectionResult,
} from '../analytics/lap-detect/lap-detect-types'
import { DEFAULT_LAP_DETECTION_CONFIG } from '../analytics/lap-detect/config/lap-detection-config'
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
  readonly lapDetectionResult: LapDetectionResult
}

/**
 * Runs the production pipeline through the current lap-detection scaffold.
 *
 * Keeping these stages together gives the CLI runner and integration tests one
 * path to exercise while position calibration is rebuilt into lap detection.
 */
export function runTelemetryAuditPipeline(
  input: unknown,
  config: FrameAuditConfig,
  lapDetectionConfig: LapDetectionConfig =
    DEFAULT_LAP_DETECTION_CONFIG,
): TelemetryAuditPipelineResult {
  const validatedWirePayload = zValidate(telemetryPayloadSchema, input)
  const normalizedTelemetry = normalizeTelemetryPayload(validatedWirePayload)
  const auditResult = auditTelemetry(normalizedTelemetry, config)
  const lapDetectionResult = detectLaps(
    auditResult,
    lapDetectionConfig,
  )

  return Object.freeze({
    validatedWirePayload,
    normalizedTelemetry,
    auditResult,
    lapDetectionResult,
  })
}
