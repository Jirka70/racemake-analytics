import type { LocallyAuditedSignalChannel } from '../../frame-audit-types'
import type { CellAlignedRacingLap } from '../cell-aligned-racing-telemetry-types'
import type { RegionContext } from '../coach-calls-types'
import type { RacingLapRegionComparison } from '../track-region-timing-types'
import type { CornerPhaseRegionId, TrackRegion } from '../track-region-types'

export type CoachingPhenomenon =
    | 'LATE_BRAKING'
    | 'EARLY_BRAKING'
    | 'EARLY_THROTTLE_LIFT'
    | 'LATE_THROTTLE_APPLICATION'
    | 'LOWER_ENTRY_SPEED'
    | 'LOWER_EXIT_SPEED'
    | 'DIFFERENT_GEAR_SELECTION'

export type CoachingAnalysisRegionId = TrackRegion['id'] | CornerPhaseRegionId

export interface PhenomenonChannelRequirements {
    readonly requiredChannels: readonly LocallyAuditedSignalChannel[]
    readonly supportingChannels: readonly LocallyAuditedSignalChannel[]
}

export interface CoachingPhenomenonInput {
    readonly comparison: RacingLapRegionComparison
    readonly regionContext: RegionContext
    readonly comparedLap: CellAlignedRacingLap
    readonly fastestObservedLap: CellAlignedRacingLap
}

export interface AnalysisLimitation {
    readonly code: 'TIMELINE_DISCONTINUITY' 
        | 'CHANNEL_DISCONTINUITY' 
        | 'BRAKE_ACTIVITY_THRESHOLD_UNAVAILABLE' 
        | 'BRAKE_ONSET_DETECTION_UNAVAILABLE'
    readonly message: string
}

export interface CoachingFindingEvidence {
    readonly channels: readonly LocallyAuditedSignalChannel[]
    readonly message: string
}

export interface CoachingFinding {
    readonly phenomenon: CoachingPhenomenon
    readonly lapNumber: number
    readonly comparedWithLapNumber: number
    readonly analysisRegionId: CoachingAnalysisRegionId
    readonly occurredAtLapElapsedMs: number
    readonly confidence: number
    readonly message: string
    readonly evidence: readonly CoachingFindingEvidence[]
    readonly limitations: readonly AnalysisLimitation[]
}

export interface CoachingPhenomenonResultContext {
    readonly phenomenon: CoachingPhenomenon
    readonly lapNumber: number
    readonly comparedWithLapNumber: number
    readonly analysisRegionId: CoachingAnalysisRegionId
}

export interface DetectedCoachingPhenomenonResult {
    readonly status: 'detected'
    readonly finding: CoachingFinding
}

export interface NotDetectedCoachingPhenomenonResult extends CoachingPhenomenonResultContext {
    readonly status: 'not-detected'
}

export interface UnavailableCoachingPhenomenonResult extends CoachingPhenomenonResultContext {
    readonly status: 'unavailable'
    readonly limitations: readonly AnalysisLimitation[]
}

export type CoachingPhenomenonResult =
    | DetectedCoachingPhenomenonResult
    | NotDetectedCoachingPhenomenonResult
    | UnavailableCoachingPhenomenonResult

export interface CoachingPhenomenonDetector {
    readonly phenomena: readonly CoachingPhenomenon[]
    readonly channelRequirements: PhenomenonChannelRequirements
    readonly isApplicable: (input: CoachingPhenomenonInput) => boolean
    readonly find: (input: CoachingPhenomenonInput) => CoachingPhenomenonResult
}
