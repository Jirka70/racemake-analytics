import type { CellAlignedRacingTelemetry } from '../../cell-aligned-racing-telemetry-types'
import type { RegionContextIndex } from '../../coach-calls-types'
import type { RacingLapRegionComparisonIndex } from '../../track-region-timing-types'
import type { CoachingDetectorFailure } from '../coaching-phenomenon-types'
import { createCoachingPhenomenonDetectors } from './create-coaching-phenomenon-detectors'
import { deriveCoachingSignalThresholds } from './derive-coaching-signal-thresholds'
import { findCoachingPhenomena } from './find-coaching-phenomena'
import type { CoachingSignalThresholdResults } from './coaching-signal-threshold-types'
import { rankCoachingPhenomena, type RankedCoachingPhenomenon } from './rank-coaching-phenomena'

export interface CoachingPhenomenaResult {
    readonly signalThresholdResults: CoachingSignalThresholdResults
    readonly rankedPhenomena: readonly RankedCoachingPhenomenon[]
    readonly detectorFailures: readonly CoachingDetectorFailure[]
}

export function createCoachingPhenomena(telemetry: CellAlignedRacingTelemetry, comparisonIndex: RacingLapRegionComparisonIndex, regionContextIndex: RegionContextIndex): CoachingPhenomenaResult {
    const signalThresholdResults = deriveCoachingSignalThresholds(telemetry)
    const detectors = createCoachingPhenomenonDetectors(signalThresholdResults)
    const { phenomenonResults, detectorFailures } = findCoachingPhenomena(detectors, comparisonIndex, regionContextIndex, telemetry)
    const rankedPhenomena = rankCoachingPhenomena(phenomenonResults)
    return { signalThresholdResults, rankedPhenomena, detectorFailures }
}
