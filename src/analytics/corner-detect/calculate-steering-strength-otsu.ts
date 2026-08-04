import { calculateOtsuThreshold, type OtsuResult } from '../otsu'
import type { SteeringStrengthProfile } from './create-steering-strength-profile'

export function calculateSteeringStrengthOtsu(profile: SteeringStrengthProfile): OtsuResult {
    const values = profile.cells.flatMap(({ steeringStrengthDegrees }) => steeringStrengthDegrees === null ? [] : [steeringStrengthDegrees])
    return calculateOtsuThreshold(values)
}
