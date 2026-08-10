import type { CellAlignedRacingTelemetry } from '../../cell-aligned-racing-telemetry-types'
import type { RegionContextIndex } from '../../coach-calls-types'
import type { RacingLapRegionComparisonIndex } from '../../track-region-timing-types'
import type { CoachingPhenomenonResult } from '../coaching-phenomenon-types'
import { createCoachingPhenomenonDetectors } from './create-coaching-phenomenon-detectors'
import { deriveCoachingSignalThresholds } from './derive-coaching-signal-thresholds'
import { findCoachingPhenomena } from './find-coaching-phenomena'
import type { CoachingSignalThresholdResults } from './coaching-signal-threshold-types'

export interface CoachingPhenomenaResult {
    readonly signalThresholdResults: CoachingSignalThresholdResults
    readonly phenomenonResults: readonly CoachingPhenomenonResult[]
}

export function createCoachingPhenomena(telemetry: CellAlignedRacingTelemetry, comparisonIndex: RacingLapRegionComparisonIndex, regionContextIndex: RegionContextIndex): CoachingPhenomenaResult {
    const signalThresholdResults = deriveCoachingSignalThresholds(telemetry)
    const detectors = createCoachingPhenomenonDetectors(signalThresholdResults)
    const phenomenonResults = findCoachingPhenomena(detectors, comparisonIndex, regionContextIndex, telemetry)
    return { signalThresholdResults, phenomenonResults }
}
