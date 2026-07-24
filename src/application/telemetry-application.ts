import { normalizeTelemetryPayload } from '../analytics/normalize-telemetry'
import type {
  NormalizedTelemetryStint,
  WireTelemetryPayload,
} from '../analytics/telemetry-types'

export interface TelemetryApplication {
  ingest(payload: WireTelemetryPayload): NormalizedTelemetryStint
}

export function createTelemetryApplication(): TelemetryApplication {
  return {
    ingest(payload) {
      return normalizeTelemetryPayload(payload)
    },
  }
}
