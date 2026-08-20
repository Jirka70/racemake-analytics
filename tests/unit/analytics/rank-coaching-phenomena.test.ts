import { describe, expect, test } from 'bun:test'
import type { CoachingFinding, CoachingPhenomenonResult } from '../../../src/analytics/coach/phenomena/coaching-phenomenon-types'
import { calculatePhenomenaPriority, rankCoachingPhenomena } from '../../../src/analytics/coach/phenomena/orchestration/rank-coaching-phenomena'

describe('calculatePhenomenaPriority', () => {
    test('expresses time loss relative to the largest detected impact', () => {
        expect(calculatePhenomenaPriority(140, 320)).toBe(0.4375)
        expect(calculatePhenomenaPriority(320, 320)).toBe(1)
    })

    test('keeps priority within the zero-to-one range', () => {
        expect(calculatePhenomenaPriority(-20, 100)).toBe(0)
        expect(calculatePhenomenaPriority(120, 100)).toBe(1)
        expect(calculatePhenomenaPriority(20, 0)).toBe(0)
    })
})

describe('rankCoachingPhenomena', () => {
    test('ranks every detected finding by relative time-loss impact', () => {
        const result = rankCoachingPhenomena([
            createDetectedResult('LATE_BRAKE_RELEASE', 9, 'C6', 140, 30_000),
            createNotDetectedResult(),
            createDetectedResult('UNNECESSARY_BRAKING', 8, 'C5-entry', 320, 20_000),
            createDetectedResult('LATE_BRAKE_RELEASE', 9, 'C8', 75, 60_000),
        ])

        expect(result.map(({ rank, priority, finding }) => ({
            rank,
            priority,
            phenomenon: finding.phenomenon,
            analysisRegionId: finding.analysisRegionId,
        }))).toEqual([
            {
                rank: 1,
                priority: 1,
                phenomenon: 'UNNECESSARY_BRAKING',
                analysisRegionId: 'C5-entry',
            },
            {
                rank: 2,
                priority: 140 / 320,
                phenomenon: 'LATE_BRAKE_RELEASE',
                analysisRegionId: 'C6',
            },
            {
                rank: 3,
                priority: 75 / 320,
                phenomenon: 'LATE_BRAKE_RELEASE',
                analysisRegionId: 'C8',
            },
        ])
    })

    test('uses lap number and region identity only for deterministic ties', () => {
        const result = rankCoachingPhenomena([
            createDetectedResult('LATE_BRAKING', 9, 'C6-entry', 100, 30_000),
            createDetectedResult('EARLY_BRAKING', 8, 'C5-entry', 100, 20_000),
        ])

        expect(result.map(({ finding }) => finding.analysisRegionId)).toEqual([
            'C5-entry',
            'C6-entry',
        ])
    })

    test('returns an empty ranking when no phenomenon was detected', () => {
        expect(rankCoachingPhenomena([createNotDetectedResult()])).toEqual([])
    })
})

function createDetectedResult(
    phenomenon: CoachingFinding['phenomenon'],
    lapNumber: number,
    analysisRegionId: CoachingFinding['analysisRegionId'],
    impactTimeLossMs: number,
    occurredAtLapElapsedMs: number,
): CoachingPhenomenonResult {
    return {
        status: 'detected',
        finding: {
            phenomenon,
            lapNumber,
            comparedWithLapNumber: 1,
            analysisRegionId,
            occurredAtLapElapsedMs,
            impactTimeLossMs,
            message: 'Synthetic coaching finding.',
            evidence: [],
            metrics: [],
            limitations: [],
        },
    }
}

function createNotDetectedResult(): CoachingPhenomenonResult {
    return {
        status: 'not-detected',
        phenomenon: 'LATE_BRAKING',
        lapNumber: 2,
        comparedWithLapNumber: 1,
        analysisRegionId: 'C1-entry',
    }
}
