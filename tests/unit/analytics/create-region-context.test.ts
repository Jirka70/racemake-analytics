import { describe, expect, test } from 'bun:test'
import type { DetectedCorner } from '../../../src/analytics/corner-detect/create-detected-corner-metadata'
import { createRegionContext, createRegionContextIndex, findRegionContext } from '../../../src/analytics/coach/create-region-context'
import type { CornerTrackRegion, StraightTrackRegion, TrackRegion, UnsupportedTrackRegion } from '../../../src/analytics/coach/track-region-types'

describe('createRegionContext', () => {
    test('uses the complete parent corner and its previous region for every corner phase', () => {
        const corner = createCornerRegion()
        const previousStraight = createStraightRegion('C2-C1', [6, 7])
        const regions: TrackRegion[] = [corner, createStraightRegion('C1-C2', [2, 3]), previousStraight]

        const context = createRegionContext(regions, 'C1')

        expect(context).toEqual({
            previousTrackRegion: previousStraight,
            currentTrackRegion: corner,
            contextCellIndexes: [6, 7, 8, 9, 0, 1],
        })
    })

    test('returns no previous region when only one region exists', () => {
        const region: UnsupportedTrackRegion = { type: 'unsupported', id: 'U1', cellIndexes: [0, 1, 2] }

        expect(createRegionContext([region], 'U1')).toEqual({
            previousTrackRegion: null,
            currentTrackRegion: region,
            contextCellIndexes: [0, 1, 2],
        })
    })

    test('indexes contexts by track region and returns null for an unknown region', () => {
        const regions: TrackRegion[] = [createCornerRegion(), createStraightRegion('C1-C2', [2, 3])]
        const index = createRegionContextIndex(regions)

        expect(findRegionContext(index, 'C1-C2')?.previousTrackRegion?.id).toBe('C1')
        expect(findRegionContext(index, 'C9')).toBeNull()
        expect(createRegionContext(regions, 'C9')).toBeNull()
    })
})

function createCornerRegion(): CornerTrackRegion {
    return {
        type: 'corner',
        id: 'C1',
        corner: {} as DetectedCorner,
        cellIndexes: [8, 9, 0, 1],
        phases: [
            { id: 'C1-entry', cornerId: 'C1', phase: 'entry', cellIndexes: [8, 9] },
            { id: 'C1-apex-proxy', cornerId: 'C1', phase: 'apex-proxy', cellIndexes: [0] },
            { id: 'C1-exit', cornerId: 'C1', phase: 'exit', cellIndexes: [1] },
        ],
    }
}

function createStraightRegion(id: StraightTrackRegion['id'], cellIndexes: readonly number[]): StraightTrackRegion {
    const [previousCornerId, nextCornerId] = id.split('-') as [StraightTrackRegion['previousCornerId'], StraightTrackRegion['nextCornerId']]
    return { type: 'straight', id, previousCornerId, nextCornerId, cellIndexes }
}
