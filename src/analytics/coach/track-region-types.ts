import type { DetectedCorner } from '../corner-detect/create-detected-corner-metadata'

export type CornerTrackRegionId = `C${number}`
export type CornerPhase = 'entry' | 'apex-proxy' | 'exit'
export type CornerPhaseRegionId = `${CornerTrackRegionId}-${CornerPhase}`
export type StraightTrackRegionId = `${CornerTrackRegionId}-${CornerTrackRegionId}`
export type UnsupportedTrackRegionId = `U${number}`

export type TrackRegion =
    | CornerTrackRegion
    | StraightTrackRegion
    | UnsupportedTrackRegion

export interface CornerTrackRegion {
    readonly type: 'corner'
    readonly id: CornerTrackRegionId
    readonly corner: DetectedCorner
    readonly cellIndexes: readonly number[]
    readonly phases: readonly CornerPhaseRegion[]
}

export interface CornerPhaseRegion {
    readonly id: CornerPhaseRegionId
    readonly cornerId: CornerTrackRegionId
    readonly phase: CornerPhase
    readonly cellIndexes: readonly number[]
}

export interface StraightTrackRegion {
    readonly type: 'straight'
    readonly id: StraightTrackRegionId
    readonly previousCornerId: CornerTrackRegionId
    readonly nextCornerId: CornerTrackRegionId
    readonly cellIndexes: readonly number[]
}

export interface UnsupportedTrackRegion {
    readonly type: 'unsupported'
    readonly id: UnsupportedTrackRegionId
    readonly cellIndexes: readonly number[]
}
