import type { RegionContext, RegionContextIndex } from './coach-calls-types'
import type { TrackRegion } from './track-region-types'

export function createRegionContext(trackRegions: readonly TrackRegion[], currentTrackRegionId: TrackRegion['id']): RegionContext | null {
    const currentRegionIndex = trackRegions.findIndex(({ id }) => id === currentTrackRegionId)
    return currentRegionIndex === -1 ? null : createRegionContextAtIndex(trackRegions, currentRegionIndex)
}

export function createRegionContextIndex(trackRegions: readonly TrackRegion[]): RegionContextIndex {
    const byTrackRegionId = new Map<TrackRegion['id'], RegionContext>()
    for (let currentRegionIndex = 0; currentRegionIndex < trackRegions.length; currentRegionIndex++) {
        const context = createRegionContextAtIndex(trackRegions, currentRegionIndex)
        byTrackRegionId.set(context.currentTrackRegion.id, context)
    }
    return { byTrackRegionId }
}

export function findRegionContext(index: RegionContextIndex, trackRegionId: TrackRegion['id']): RegionContext | null {
    return index.byTrackRegionId.get(trackRegionId) ?? null
}

function createRegionContextAtIndex(trackRegions: readonly TrackRegion[], currentRegionIndex: number): RegionContext {
    const currentTrackRegion = trackRegions[currentRegionIndex]
    const previousTrackRegion = findPreviousTrackRegion(trackRegions, currentRegionIndex)
    return {
        previousTrackRegion,
        currentTrackRegion,
        contextCellIndexes: previousTrackRegion
            ? [...previousTrackRegion.cellIndexes, ...currentTrackRegion.cellIndexes]
            : [...currentTrackRegion.cellIndexes],
    }
}

function findPreviousTrackRegion(trackRegions: readonly TrackRegion[], currentRegionIndex: number): TrackRegion | null {
    if (trackRegions.length <= 1) return null
    const previousRegionIndex = (currentRegionIndex - 1 + trackRegions.length) % trackRegions.length
    return trackRegions[previousRegionIndex] ?? null
}
