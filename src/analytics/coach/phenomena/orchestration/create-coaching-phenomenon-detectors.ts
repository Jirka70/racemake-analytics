import type { CoachingPhenomenonDetector } from '../coaching-phenomenon-types'
import type { CoachingSignalThresholdResults } from './coaching-signal-threshold-types'
import { createBrakeReleaseDetector } from '../braking/brake-release'
import { createBrakingOnsetDetector } from '../braking/braking-onset-phenomena'

export function createCoachingPhenomenonDetectors(thresholds: CoachingSignalThresholdResults): readonly CoachingPhenomenonDetector[] {
    return [
        createBrakingOnsetDetector(thresholds.brakeActivity),
        createBrakeReleaseDetector(thresholds.brakeActivity),
    ]
}
