import type { CellAlignedRacingTelemetry } from '../../cell-aligned-racing-telemetry-types'
import { calculateBrakeActivityThreshold } from '../braking/brake-activity-thresholds'
import type { CoachingSignalThresholdResults } from './coaching-signal-threshold-types'

export function deriveCoachingSignalThresholds(telemetry: CellAlignedRacingTelemetry): CoachingSignalThresholdResults {
    return {
        brakeActivity: calculateBrakeActivityThreshold(telemetry),
    }
}
