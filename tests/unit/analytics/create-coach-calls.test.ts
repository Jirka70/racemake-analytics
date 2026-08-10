import { describe, expect, test } from 'bun:test'
import { createCoachCalls } from '../../../src/analytics/coach/create-coach-calls'
import type { DetectedLap, DetectedLapEligibilityResult, LapDetectionResult } from '../../../src/analytics/lap-detect/lap-detect-types'

describe('createCoachCalls', () => {
    test('selects the fastest and slowest real-racing laps', () => {
        const result = createCoachCalls(createLapDetection([
            [1, 92_000, false],
            [2, 90_000, true],
            [3, 93_000, true],
            [4, 91_000, true],
        ]))

        expect(result.racingLapComparison?.bestLap.lapNumber).toBe(2)
        expect(result.racingLapComparison?.worstLap.lapNumber).toBe(3)
    })

    test('returns no comparison without two real-racing laps', () => {
        const result = createCoachCalls(createLapDetection([
            [1, 90_000, true],
            [2, 91_000, false],
        ]))

        expect(result.racingLapComparison).toBeNull()
    })

    test('breaks equal lap-time ties deterministically by lap number', () => {
        const result = createCoachCalls(createLapDetection([
            [3, 90_000, true],
            [1, 90_000, true],
            [2, 90_000, true],
        ]))

        expect(result.racingLapComparison?.bestLap.lapNumber).toBe(1)
        expect(result.racingLapComparison?.worstLap.lapNumber).toBe(3)
    })
})

function createLapDetection(laps: ReadonlyArray<readonly [lapNumber: number, lapTimeMs: number, realRacingEligible: boolean]>): LapDetectionResult {
    return {
        positionCalibration: null,
        linearGrid: null,
        lapCrossings: [],
        laps: laps.map(([lapNumber, lapTimeMs]) => createLap(lapNumber, lapTimeMs)),
        linearizedLaps: [],
        lapGridCoverages: [],
        lapEligibilityResults: laps.map(([lapNumber, , eligible]) => createEligibility(lapNumber, eligible)),
    }
}

function createLap(lapNumber: number, lapTimeMs: number): DetectedLap {
    return {
        lapNumber,
        lapTimeMs,
        startCrossing: {} as DetectedLap['startCrossing'],
        endCrossing: {} as DetectedLap['endCrossing'],
        confidence: { boundaryConfidence: 1, lapTimeConfidence: 1, overallConfidence: 1 },
        limitations: [],
    }
}

function createEligibility(lapNumber: number, eligible: boolean): DetectedLapEligibilityResult {
    const decision = { eligible, reasons: [] }
    return {
        lapNumber,
        movement: {
            observedDurationMs: 1,
            movementObservationTimeRatio: 1,
            movingDurationMs: 1,
            movingObservedTimeRatio: 1,
            longestStationaryIntervalMs: 0,
            longestStationaryIntervalLapTimeRatio: 0,
        },
        eligibility: { timeEligible: decision, realRacing: decision, cornerEligible: decision },
    }
}
