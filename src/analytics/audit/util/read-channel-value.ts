import { LocallyAuditedSignalChannel } from "../../frame-audit-types"
import { NormalizedTelemetryFrame } from "../../telemetry-types"

export function readChannelValue(
  frame: NormalizedTelemetryFrame,
  channel: LocallyAuditedSignalChannel,
): number {
  switch (channel) {
    case 'normalizedTrackPosition':
      return frame.normalizedTrackPosition

    case 'speedKmh':
      return frame.speedKmh

    case 'throttleRatio':
      return frame.throttleRatio

    case 'brakeRatio':
      return frame.brakeRatio

    case 'steeringDegrees':
      return frame.steeringDegrees

    case 'engineRpm':
      return frame.engineRpm

    case 'tyreCoreTemperatureC.frontLeft':
      return frame.tyreCoreTemperatureC.frontLeft

    case 'tyreCoreTemperatureC.frontRight':
      return frame.tyreCoreTemperatureC.frontRight

    case 'tyreCoreTemperatureC.rearLeft':
      return frame.tyreCoreTemperatureC.rearLeft

    case 'tyreCoreTemperatureC.rearRight':
      return frame.tyreCoreTemperatureC.rearRight
  }
}