import type { SteeringStrengthProfile } from './create-steering-strength-profile'
import { requireFiniteResult } from '../util/require-finite-result'

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
            logSteeringStrength: steeringStrengthDegrees === null
                ? null
                : requireFiniteResult(
                    Math.log1p(steeringStrengthDegrees),
                    'steering-log-transform',
                ),
        })),
    }
}
