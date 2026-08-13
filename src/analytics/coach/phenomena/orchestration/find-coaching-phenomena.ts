import type { CellAlignedRacingLap, CellAlignedRacingTelemetry } from '../../cell-aligned-racing-telemetry-types'
import type { RegionContextIndex } from '../../coach-calls-types'
import type { RacingLapRegionComparisonIndex } from '../../track-region-timing-types'
import type { CoachingDetectorFailure, CoachingPhenomenonDetector, CoachingPhenomenonInput, CoachingPhenomenonResult } from '../coaching-phenomenon-types'

export interface FindCoachingPhenomenaResult {
    readonly phenomenonResults: readonly CoachingPhenomenonResult[]
    readonly detectorFailures: readonly CoachingDetectorFailure[]
}

export function findCoachingPhenomena(detectors: readonly CoachingPhenomenonDetector[], comparisonIndex: RacingLapRegionComparisonIndex, regionContextIndex: RegionContextIndex, telemetry: CellAlignedRacingTelemetry): FindCoachingPhenomenaResult {
    const lapByNumber = new Map(telemetry.laps.map((lap) => [lap.lapNumber, lap]))
    const phenomenonResults: CoachingPhenomenonResult[] = []
    const detectorFailures: CoachingDetectorFailure[] = []

    for (const comparisonsByTrackRegionId of comparisonIndex.byLapNumber.values()) {
        for (const comparison of comparisonsByTrackRegionId.values()) {
            const input = createPhenomenonInput(comparison, regionContextIndex, lapByNumber)
            if (!input) continue

            for (const detector of detectors) {
                try {
                    if (!detector.isApplicable(input)) continue
                    const phenomenonResult = detector.find(input)
                    phenomenonResults.push(phenomenonResult)
                } catch (error: unknown) {
                    detectorFailures.push({
                        code: 'COACHING_DETECTOR_FAILED',
                        phenomena: detector.phenomena,
                        lapNumber: input.comparedLap.lapNumber,
                        trackRegionId: input.regionContext.currentTrackRegion.id,
                        errorName: error instanceof Error ? error.name : 'UnknownError',
                    })
                }
            }
        }
    }

    return { phenomenonResults, detectorFailures }
}

function createPhenomenonInput(comparison: CoachingPhenomenonInput['comparison'], regionContextIndex: RegionContextIndex, lapByNumber: ReadonlyMap<number, CellAlignedRacingLap>): CoachingPhenomenonInput | null {
    const regionContext = regionContextIndex.byTrackRegionId.get(comparison.trackRegionId)
    const comparedLap = lapByNumber.get(comparison.comparedLapNumber)
    const fastestObservedLap = lapByNumber.get(comparison.fastestObserved.lapNumber)
    return regionContext && comparedLap && fastestObservedLap
        ? { comparison, regionContext, comparedLap, fastestObservedLap }
        : null
}
