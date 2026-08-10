import { describe, expect, test } from 'bun:test'
import type { DetectedCorner } from '../../../src/analytics/corner-detect/create-detected-corner-metadata'
import type { CellAlignedRacingLap } from '../../../src/analytics/coach/cell-aligned-racing-telemetry-types'
import type { RegionContextIndex } from '../../../src/analytics/coach/coach-calls-types'
import type { RacingLapRegionComparison, RacingLapRegionComparisonIndex } from '../../../src/analytics/coach/track-region-timing-types'
import type { CornerTrackRegion, StraightTrackRegion } from '../../../src/analytics/coach/track-region-types'
import type { CoachingPhenomenonDetector } from '../../../src/analytics/coach/phenomena/coaching-phenomenon-types'
import { findCoachingPhenomena } from '../../../src/analytics/coach/phenomena/orchestration/find-coaching-phenomena'
import { createBrakingOnsetDetector } from '../../../src/analytics/coach/phenomena/braking/braking-onset-phenomena'

describe('findCoachingPhenomena', () => {
    test('runs braking onset detection once for a corner and skips a straight and the benchmark lap', () => {
        const corner = createCornerRegion()
        const straight = createStraightRegion()
        const comparisonIndex: RacingLapRegionComparisonIndex = {
            byLapNumber: new Map([
                [1, new Map([['C1', createComparison('C1', 1)]])],
                [2, new Map([
                    ['C1', createComparison('C1', 2)],
                    ['C1-C1', createComparison('C1-C1', 2)],
                ])],
            ]),
        }
        const regionContextIndex: RegionContextIndex = {
            byTrackRegionId: new Map([
                ['C1', { previousTrackRegion: straight, currentTrackRegion: corner, contextCellIndexes: [0, 1, 2] }],
                ['C1-C1', { previousTrackRegion: corner, currentTrackRegion: straight, contextCellIndexes: [1, 2, 0] }],
            ]),
        }

        const results = findCoachingPhenomena(
            [createBrakingOnsetDetector({ status: 'unavailable', reason: 'EMPTY_SAMPLE', sampleCount: 0 })],
            comparisonIndex,
            regionContextIndex,
            { laps: [createLap(1), createLap(2)] },
        )

        expect(results).toEqual([{
            status: 'unavailable',
            phenomenon: 'LATE_BRAKING',
            lapNumber: 2,
            comparedWithLapNumber: 1,
            analysisRegionId: 'C1-entry',
            limitations: [{
                code: 'BRAKE_ACTIVITY_THRESHOLD_UNAVAILABLE',
                message: 'Brake activity threshold is unavailable: EMPTY_SAMPLE.',
            }],
        }])
    })

    test('lets each detector decide whether a fastest observed pass can be evaluated', () => {
        const evaluatedLapNumbers: number[] = []
        const detector: CoachingPhenomenonDetector = {
            phenomena: ['LATE_BRAKING'],
            channelRequirements: { requiredChannels: [], supportingChannels: [] },
            isApplicable: () => true,
            find: (input) => {
                evaluatedLapNumbers.push(input.comparedLap.lapNumber)
                return {
                    status: 'not-detected',
                    phenomenon: 'LATE_BRAKING',
                    lapNumber: input.comparedLap.lapNumber,
                    comparedWithLapNumber: input.fastestObservedLap.lapNumber,
                    analysisRegionId: input.regionContext.currentTrackRegion.id,
                }
            },
        }
        const corner = createCornerRegion()
        const comparisonIndex: RacingLapRegionComparisonIndex = {
            byLapNumber: new Map([[1, new Map([['C1', createComparison('C1', 1)]])]]),
        }
        const regionContextIndex: RegionContextIndex = {
            byTrackRegionId: new Map([['C1', { previousTrackRegion: null, currentTrackRegion: corner, contextCellIndexes: [1, 2] }]]),
        }

        findCoachingPhenomena([detector], comparisonIndex, regionContextIndex, { laps: [createLap(1)] })

        expect(evaluatedLapNumbers).toEqual([1])
    })
})

function createLap(lapNumber: number): CellAlignedRacingLap {
    return { lapNumber, lapTimeMs: lapNumber === 1 ? 90_000 : 91_000, cells: [] }
}

function createComparison(trackRegionId: RacingLapRegionComparison['trackRegionId'], comparedLapNumber: number): RacingLapRegionComparison {
    return {
        trackRegionId,
        comparedLapNumber,
        comparedLapRegionDurationMs: comparedLapNumber === 1 ? 1_000 : 1_100,
        fastestObserved: { lapNumber: 1, regionDurationMs: 1_000, comparedLapMinusObservedPassMs: comparedLapNumber === 1 ? 0 : 100 },
        slowestObserved: { lapNumber: 2, regionDurationMs: 1_100, comparedLapMinusObservedPassMs: comparedLapNumber === 1 ? -100 : 0 },
    }
}

function createCornerRegion(): CornerTrackRegion {
    return {
        type: 'corner',
        id: 'C1',
        corner: {} as DetectedCorner,
        cellIndexes: [1, 2],
        phases: [
            { id: 'C1-entry', cornerId: 'C1', phase: 'entry', cellIndexes: [1] },
            { id: 'C1-apex-proxy', cornerId: 'C1', phase: 'apex-proxy', cellIndexes: [2] },
        ],
    }
}

function createStraightRegion(): StraightTrackRegion {
    return { type: 'straight', id: 'C1-C1', previousCornerId: 'C1', nextCornerId: 'C1', cellIndexes: [0] }
}
