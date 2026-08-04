import type { SmoothedTrackSteeringProfile } from './smooth-track-steering-profile'

export interface SteeringStrengthProfileCell {
    readonly cellCenter: number
    readonly signedSteeringDegrees: number | null
    readonly steeringStrengthDegrees: number | null
}

export interface SteeringStrengthProfile {
    readonly cells: readonly SteeringStrengthProfileCell[]
}

export function createSteeringStrengthProfile(profile: SmoothedTrackSteeringProfile): SteeringStrengthProfile {
    return {
        cells: profile.cells.map(({ cellCenter, smoothedSignedSteeringDegrees }) => ({
            cellCenter,
            signedSteeringDegrees: smoothedSignedSteeringDegrees,
            steeringStrengthDegrees: smoothedSignedSteeringDegrees === null ? null : Math.abs(smoothedSignedSteeringDegrees),
        })),
    }
}
