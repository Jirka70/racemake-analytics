import {
  NormalizedTelemetryFrame,
  type NormalizedTelemetryStint,
  type WireTelemetryPayload,
} from './telemetry-types'

const TYRE_TEMPERATURE_WIRE_SCALE = 10

export function normalizeTelemetryPayload(
  payload: WireTelemetryPayload,
): NormalizedTelemetryStint {
  const frames = payload.frames.map(
    (frame, sourceIndex) =>
      new NormalizedTelemetryFrame({
        sourceIndex,
        timestampMs: frame.ts,
        recordedLapNumber: frame.lap,
        normalizedTrackPosition: frame.pos,
        speedKmh: frame.spd,
        throttleRatio: frame.thr,
        brakeRatio: frame.brk,
        steeringDegrees: frame.str,
        gear: frame.gear,
        engineRpm: frame.rpm,
        tyreCoreTemperatureC: {
          frontLeft: frame.tyres.fl / TYRE_TEMPERATURE_WIRE_SCALE,
          frontRight: frame.tyres.fr / TYRE_TEMPERATURE_WIRE_SCALE,
          rearLeft: frame.tyres.rl / TYRE_TEMPERATURE_WIRE_SCALE,
          rearRight: frame.tyres.rr / TYRE_TEMPERATURE_WIRE_SCALE,
        },
      }),
  )

  return Object.freeze({
    schemaVersion: payload.schema,
    sessionId: payload.session_id,
    recorder: Object.freeze({
      name: payload.recorder.name,
      version: payload.recorder.version,
    }),
    note: payload.note,
    frameCount: payload.frame_count,
    frames: Object.freeze(frames),
  })
}
