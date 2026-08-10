import type { CellAlignedRacingLap, CellAlignedRacingTelemetry } from '../../cell-aligned-racing-telemetry-types'
import type { RegionContextIndex } from '../../coach-calls-types'
import type { RacingLapRegionComparisonIndex } from '../../track-region-timing-types'
import type { CoachingPhenomenonDetector, CoachingPhenomenonInput, CoachingPhenomenonResult } from '../coaching-phenomenon-types'

export function findCoachingPhenomena(detectors: readonly CoachingPhenomenonDetector[], comparisonIndex: RacingLapRegionComparisonIndex, regionContextIndex: RegionContextIndex, telemetry: CellAlignedRacingTelemetry): readonly CoachingPhenomenonResult[] {
    const lapByNumber = new Map(telemetry.laps.map((lap) => [lap.lapNumber, lap]))
    const results: CoachingPhenomenonResult[] = []

    for (const comparisonsByTrackRegionId of comparisonIndex.byLapNumber.values()) {
        for (const comparison of comparisonsByTrackRegionId.values()) {
            const input = createPhenomenonInput(comparison, regionContextIndex, lapByNumber)
            
            if (!input) continue
            for (const detector of detectors) {
                if (detector.isApplicable(input)) results.push(detector.find(input))
            }
        }
    }
    return results
}

function createPhenomenonInput(comparison: CoachingPhenomenonInput['comparison'], regionContextIndex: RegionContextIndex, lapByNumber: ReadonlyMap<number, CellAlignedRacingLap>): CoachingPhenomenonInput | null {
    const regionContext = regionContextIndex.byTrackRegionId.get(comparison.trackRegionId)
    const comparedLap = lapByNumber.get(comparison.comparedLapNumber)
    const fastestObservedLap = lapByNumber.get(comparison.fastestObserved.lapNumber)
    return regionContext && comparedLap && fastestObservedLap
        ? { comparison, regionContext, comparedLap, fastestObservedLap }
        : null
}
