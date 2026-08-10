import type { BrakeActivityThresholdResult } from '../braking/brake-activity-thresholds'

export interface CoachingSignalThresholdResults {
    readonly brakeActivity: BrakeActivityThresholdResult
}
