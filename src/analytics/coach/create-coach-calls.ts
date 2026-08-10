import type { DetectedLap, LapDetectionResult } from '../lap-detect/lap-detect-types'

export interface RacingLapComparison {
    readonly bestLap: DetectedLap
    readonly worstLap: DetectedLap
}

export interface CoachCallsResult {
    readonly racingLapComparison: RacingLapComparison | null
}

export function createCoachCalls(lapDetection: LapDetectionResult): CoachCallsResult {
    const eligibilityByLapNumber = new Map(lapDetection.lapEligibilityResults.map(({ lapNumber, eligibility }) => [lapNumber, eligibility]))
    const racingLaps = lapDetection.laps
        .filter(({ lapNumber }) => eligibilityByLapNumber.get(lapNumber)?.realRacing.eligible)
    return { racingLapComparison: findBestAndWorstLap(racingLaps) }
}

function findBestAndWorstLap(racingLaps: readonly DetectedLap[]): RacingLapComparison | null {
    if (racingLaps.length < 2) return null

    const orderedRacingLaps = [...racingLaps]
        .sort((first, second) => first.lapTimeMs - second.lapTimeMs || first.lapNumber - second.lapNumber)
    return { bestLap: orderedRacingLaps[0]!, worstLap: orderedRacingLaps[orderedRacingLaps.length - 1]! }
}
