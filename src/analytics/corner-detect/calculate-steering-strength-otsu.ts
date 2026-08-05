import { calculateOtsuThreshold, type OtsuResult } from '../otsu'
import type { LogSteeringStrengthProfile } from './create-log-steering-strength-profile'

export function calculateSteeringStrengthOtsu(profile: LogSteeringStrengthProfile): OtsuResult {
    const values = profile.cells.flatMap(({ logSteeringStrength }) => logSteeringStrength === null 
        ? [] 
        : [logSteeringStrength])
    return calculateOtsuThreshold(values)
}
