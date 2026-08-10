import type { TrackRegion } from './track-region-types'

export interface RegionContext {
    readonly previousTrackRegion: TrackRegion | null
    readonly currentTrackRegion: TrackRegion
    readonly contextCellIndexes: readonly number[]
    // readonly limitations: readonly RegionContextLimitation[] -- we do not have type RegionContextLimitation yet
}

export interface RegionContextIndex {
    readonly byTrackRegionId: ReadonlyMap<TrackRegion['id'], RegionContext>
}
