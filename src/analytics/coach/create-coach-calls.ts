import type { UsableTimeline } from '../frame-audit-types'
import type { DetectedCorner } from '../corner-detect/create-detected-corner-metadata'
import type { DetectedLap, DetectedLapEligibility, LapDetectionResult } from '../lap-detect/lap-detect-types'
import { createCellAlignedRacingTelemetry } from './create-cell-aligned-racing-telemetry'
import type { CellAlignedRacingTelemetry } from './cell-aligned-racing-telemetry-types'
import { createRacingLapRegionComparisonIndex } from './create-racing-lap-region-comparisons'
import { createRegionContextIndex } from './create-region-context'
import { createTrackRegionBenchmarks } from './create-track-region-benchmarks'
import { createTrackRegions } from './create-track-regions'
import { createTrackRegionTimings } from './create-track-region-timings'
import type { RacingLapRegionComparisonIndex, TrackRegionBenchmark, TrackRegionTiming } from './track-region-timing-types'
import type { TrackRegion } from './track-region-types'
import type { RegionContextIndex } from './coach-calls-types'
import { createCoachingPhenomena, type CoachingPhenomenaResult } from './phenomena/orchestration/create-coaching-phenomena'

export interface RacingLapComparison {
    readonly bestLap: DetectedLap
    readonly worstLap: DetectedLap
    readonly lapTimeDifferenceMs: number
}

export interface CoachCallsResult {
    readonly racingLaps: readonly DetectedLap[]
    readonly racingLapComparison: RacingLapComparison | null
    readonly cellAlignedRacingTelemetry: CellAlignedRacingTelemetry
    readonly trackRegions: readonly TrackRegion[]
    readonly trackRegionTimings: readonly TrackRegionTiming[]
    readonly trackRegionBenchmarks: readonly TrackRegionBenchmark[]
    readonly racingLapRegionComparisonIndex: RacingLapRegionComparisonIndex
    readonly regionContextIndex: RegionContextIndex
    readonly coachingPhenomena: CoachingPhenomenaResult
}

export function createCoachCalls(timeline: UsableTimeline | null, lapDetection: LapDetectionResult, corners: readonly DetectedCorner[] = []): CoachCallsResult {
    const racingLaps = findRacingLaps(lapDetection)
    const racingLapComparison = computeBestWorstLap(racingLaps)
    const cellAlignedRacingTelemetry = createCellAlignedRacingTelemetry(timeline, lapDetection, racingLaps)
    const trackRegions = createTrackRegions(corners, lapDetection.linearGrid?.cellCount ?? 0)
    const regionContextIndex = createRegionContextIndex(trackRegions)
    const trackRegionTimings = createTrackRegionTimings(trackRegions, cellAlignedRacingTelemetry)
    const trackRegionBenchmarks = createTrackRegionBenchmarks(trackRegionTimings)
    const racingLapRegionComparisonIndex = createRacingLapRegionComparisonIndex(trackRegionTimings, trackRegionBenchmarks)
    const coachingPhenomena = createCoachingPhenomena(cellAlignedRacingTelemetry, racingLapRegionComparisonIndex, regionContextIndex)
    return { racingLaps, racingLapComparison, cellAlignedRacingTelemetry, trackRegions, trackRegionTimings, trackRegionBenchmarks, racingLapRegionComparisonIndex, regionContextIndex, coachingPhenomena }
}

function findRacingLaps(lapDetection: LapDetectionResult): readonly DetectedLap[] {
    const eligibilityByLapNumber = new Map(lapDetection.lapEligibilityResults.map(({ lapNumber, eligibility }) => [lapNumber, eligibility]))
    return lapDetection.laps
        .filter((lap) => isLapEligibleForRacing(lap, eligibilityByLapNumber))
}

function computeBestWorstLap(racingLaps: readonly DetectedLap[]): RacingLapComparison | null {
    return findBestAndWorstLap(racingLaps)
}

function isLapEligibleForRacing(lap: DetectedLap, eligibilityByLapNumber: ReadonlyMap<number, DetectedLapEligibility>): boolean {
    return eligibilityByLapNumber.get(lap.lapNumber)?.realRacing.eligible ?? false
}

function findBestAndWorstLap(racingLaps: readonly DetectedLap[]): RacingLapComparison | null {
    if (racingLaps.length < 2) return null

    const orderedRacingLaps = [...racingLaps]
        .sort((first, second) => first.lapTimeMs - second.lapTimeMs || first.lapNumber - second.lapNumber)

    const bestLap = orderedRacingLaps[0]
    const worstLap = orderedRacingLaps[orderedRacingLaps.length - 1]
    return { bestLap, worstLap, lapTimeDifferenceMs: worstLap.lapTimeMs - bestLap.lapTimeMs }
}
