import type { SteeringStrengthProfile } from './create-steering-strength-profile'

export interface LogSteeringStrengthProfileCell {
    readonly cellCenter: number
    readonly logSteeringStrength: number | null
}

export interface LogSteeringStrengthProfile {
    readonly cells: readonly LogSteeringStrengthProfileCell[]
}

export function createLogSteeringStrengthProfile(profile: SteeringStrengthProfile): LogSteeringStrengthProfile {
    return {
        cells: profile.cells.map(({ cellCenter, steeringStrengthDegrees }) => ({
            cellCenter,
            logSteeringStrength: steeringStrengthDegrees === null ? null : Math.log1p(steeringStrengthDegrees),
        })),
    }
}
