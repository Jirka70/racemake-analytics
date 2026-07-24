export interface WireTyres {
  readonly fl: number
  readonly fr: number
  readonly rl: number
  readonly rr: number
}

export interface WireTelemetryFrame {
  readonly ts: number
  readonly lap: number
  readonly pos: number
  readonly spd: number
  readonly thr: number
  readonly brk: number
  readonly str: number
  readonly gear: number
  readonly rpm: number
  readonly tyres: WireTyres
}

export interface WireTelemetryRecorder {
  readonly name: string
  readonly version: string
}

export interface WireTelemetryPayload {
  readonly schema: 'racemake.telemetry.stint.v1'
  readonly recorder: WireTelemetryRecorder
  readonly session_id: string
  readonly note: string
  readonly frame_count: number
  readonly frames: readonly WireTelemetryFrame[]
}

export interface TyreCoreTemperatureC {
  readonly frontLeft: number
  readonly frontRight: number
  readonly rearLeft: number
  readonly rearRight: number
}

interface NormalizedTelemetryFrameValues {
  readonly sourceIndex: number
  readonly timestampMs: number
  readonly recordedLapNumber: number
  readonly normalizedTrackPosition: number
  readonly speedKmh: number
  readonly throttleRatio: number
  readonly brakeRatio: number
  readonly steeringDegrees: number
  readonly gear: number
  readonly engineRpm: number
  readonly tyreCoreTemperatureC: TyreCoreTemperatureC
}

/**
 * Immutable message carrying one normalized telemetry sample.
 * It deliberately contains no analytics behavior.
 */
export class NormalizedTelemetryFrame {
  readonly sourceIndex: number
  readonly timestampMs: number
  readonly recordedLapNumber: number
  readonly normalizedTrackPosition: number
  readonly speedKmh: number
  readonly throttleRatio: number
  readonly brakeRatio: number
  readonly steeringDegrees: number
  readonly gear: number
  readonly engineRpm: number
  readonly tyreCoreTemperatureC: TyreCoreTemperatureC

  constructor(values: NormalizedTelemetryFrameValues) {
    this.sourceIndex = values.sourceIndex
    this.timestampMs = values.timestampMs
    this.recordedLapNumber = values.recordedLapNumber
    this.normalizedTrackPosition = values.normalizedTrackPosition
    this.speedKmh = values.speedKmh
    this.throttleRatio = values.throttleRatio
    this.brakeRatio = values.brakeRatio
    this.steeringDegrees = values.steeringDegrees
    this.gear = values.gear
    this.engineRpm = values.engineRpm
    this.tyreCoreTemperatureC = Object.freeze({
      ...values.tyreCoreTemperatureC,
    })

    Object.freeze(this)
  }
}

export interface NormalizedTelemetryStint {
  readonly schemaVersion: 'racemake.telemetry.stint.v1'
  readonly sessionId: string
  readonly recorder: Readonly<{
    name: string
    version: string
  }>
  readonly note: string
  readonly frameCount: number
  readonly frames: readonly NormalizedTelemetryFrame[]
}
