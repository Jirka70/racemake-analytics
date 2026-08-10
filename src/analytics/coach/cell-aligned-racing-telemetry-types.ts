import type { LocallyAuditedSignalChannel } from '../frame-audit-types'
import type { TyreCoreTemperatureC } from '../telemetry-types'

export interface CellBoundary {
    readonly normalizedTrackPosition: number
    readonly lapElapsedMs: number | null
}

export interface CellCenterTelemetry extends CellBoundary {
    readonly speedKmh: number | null
    readonly brakeRatio: number | null
    readonly throttleRatio: number | null
    readonly steeringDegrees: number | null
    readonly gear: number | null
    readonly engineRpm: number | null
    readonly tyreCoreTemperatureC: TyreCoreTemperatureC | null
}

export interface CellTelemetryQuality {
    readonly timelineContinuous: boolean
    readonly discontinuousChannels: readonly LocallyAuditedSignalChannel[]
}

export interface CellAlignedRacingLapCell {
    readonly cellIndex: number
    readonly from: CellBoundary
    readonly center: CellCenterTelemetry
    readonly to: CellBoundary
    readonly quality: CellTelemetryQuality
}

export interface CellAlignedRacingLap {
    readonly lapNumber: number
    readonly lapTimeMs: number
    readonly cells: readonly CellAlignedRacingLapCell[]
}

export interface CellAlignedRacingTelemetry {
    readonly laps: readonly CellAlignedRacingLap[]
}
