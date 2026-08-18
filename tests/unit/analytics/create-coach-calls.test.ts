import { describe, expect, test } from 'bun:test'
import { createCoachCalls } from '../../../src/analytics/coach/create-coach-calls'
import { findLeftAndRightNearestFrames, findTransitionsOverlappingGridCell } from '../../../src/analytics/coach/create-cell-aligned-racing-telemetry'
import type { AuditedFrame, AuditedTimelineTransition, UsableTimeline } from '../../../src/analytics/frame-audit-types'
import type { DetectedLap, DetectedLapEligibilityResult, LinearizedLap, LapDetectionResult } from '../../../src/analytics/lap-detect/lap-detect-types'
import { NormalizedTelemetryFrame } from '../../../src/analytics/telemetry-types'

describe('createCoachCalls', () => {
    test('creates one positional cell grid for every real-racing lap', () => {
        const lapDetection = createLapDetection([[1, 2_000, true]])
        const result = createCoachCalls(null, {
            ...lapDetection,
            linearGrid: {
                cellCount: 2,
                positionStep: 0.5,
                positions: [0, 0.5, 1],
                medianUsablePositionSampleCountPerLap: 2,
            },
            linearizedLaps: [{
                lapNumber: 1,
                elapsedTimestampsMs: [0, 900, 2_000],
                steeringDegrees: [0, 10, 0],
                coverage: {} as LinearizedLap['coverage'],
                issues: [],
            }],
        })

        const cells = result.cellAlignedRacingTelemetry.laps[0]?.cells
        expect(cells).toHaveLength(2)
        expect(cells?.map(({ cellIndex, from, center, to }) => ({ cellIndex, from, centerPosition: center.normalizedTrackPosition, to }))).toEqual([
            { cellIndex: 0, from: { normalizedTrackPosition: 0, lapElapsedMs: 0 }, centerPosition: 0.25, to: { normalizedTrackPosition: 0.5, lapElapsedMs: 900 } },
            { cellIndex: 1, from: { normalizedTrackPosition: 0.5, lapElapsedMs: 900 }, centerPosition: 0.75, to: { normalizedTrackPosition: 1, lapElapsedMs: 2_000 } },
        ])
        expect(cells?.every(({ center }) => center.lapElapsedMs === null
            && center.speedKmh === null
            && center.brakeRatio === null
            && center.throttleRatio === null
            && center.steeringDegrees === null
            && center.gear === null
            && center.engineRpm === null
            && center.tyreCoreTemperatureC === null)).toBeTrue()
    })

    test('selects the fastest and slowest real-racing laps', () => {
        const result = createCoachCalls(null, createLapDetection([
            [1, 92_000, false],
            [2, 90_000, true],
            [3, 93_000, true],
            [4, 91_000, true],
        ]))

        expect(result.racingLaps.map(({ lapNumber }) => lapNumber)).toEqual([2, 3, 4])
        expect(result.racingLapComparison?.bestLap.lapNumber).toBe(2)
        expect(result.racingLapComparison?.worstLap.lapNumber).toBe(3)
        expect(result.racingLapComparison?.lapTimeDifferenceMs).toBe(3_000)
    })

    test('returns no comparison without two real-racing laps', () => {
        const result = createCoachCalls(null, createLapDetection([
            [1, 90_000, true],
            [2, 91_000, false],
        ]))

        expect(result.racingLaps.map(({ lapNumber }) => lapNumber)).toEqual([1])
        expect(result.racingLapComparison).toBeNull()
    })

    test('breaks equal lap-time ties deterministically by lap number', () => {
        const result = createCoachCalls(null, createLapDetection([
            [3, 90_000, true],
            [1, 90_000, true],
            [2, 90_000, true],
        ]))

        expect(result.racingLapComparison?.bestLap.lapNumber).toBe(1)
        expect(result.racingLapComparison?.worstLap.lapNumber).toBe(3)
        expect(result.racingLapComparison?.lapTimeDifferenceMs).toBe(0)
    })

    test('finds the nearest frames around a grid-cell center', () => {
        const timeline = createTimeline([0.9, 0.1, 0.35, 0.8, 0.05])
        const auditedFrameBySourceIndex = new Map(timeline.frames.map((frame) => [frame.frame.sourceIndex, frame]))

        const afterStart = findLeftAndRightNearestFrames(timeline.transitions, 0.05, auditedFrameBySourceIndex)
        const middle = findLeftAndRightNearestFrames(timeline.transitions, 0.25, auditedFrameBySourceIndex)
        const beforeFinish = findLeftAndRightNearestFrames(timeline.transitions, 0.95, auditedFrameBySourceIndex)

        expect([afterStart?.left.frame.sourceIndex, afterStart?.right.frame.sourceIndex]).toEqual([0, 1])
        expect([middle?.left.frame.sourceIndex, middle?.right.frame.sourceIndex]).toEqual([1, 2])
        expect([beforeFinish?.left.frame.sourceIndex, beforeFinish?.right.frame.sourceIndex]).toEqual([3, 4])
    })

    test('finds every transition overlapping a grid cell with binary search', () => {
        const timeline = createTimeline([0.9, 0.1, 0.242, 0.245, 0.248, 0.252, 0.8, 0.05])
        const middleTransitions = findTransitionsOverlappingGridCell(timeline.transitions, 0.24, 0.25)
        const startTransitions = findTransitionsOverlappingGridCell(timeline.transitions, 0, 0.05)
        const finishTransitions = findTransitionsOverlappingGridCell(timeline.transitions, 0.95, 1)

        expect(middleTransitions.map(({ previous, current }) => [previous.sourceIndex, current.sourceIndex])).toEqual([
            [1, 2],
            [2, 3],
            [3, 4],
            [4, 5],
        ])
        expect(startTransitions.map(({ previous, current }) => [previous.sourceIndex, current.sourceIndex])).toEqual([[0, 1]])
        expect(finishTransitions.map(({ previous, current }) => [previous.sourceIndex, current.sourceIndex])).toEqual([[6, 7]])
    })

    test('interpolates continuous center telemetry and takes gear from the nearest frame', () => {
        const timeline = createTimeline([0.9, 0.1, 0.35, 0.8, 0.05])
        const cell = createCoachCalls(timeline, createCellAlignedLapDetection()).cellAlignedRacingTelemetry.laps[0]?.cells[0]

        expect(cell?.center).toEqual({
            normalizedTrackPosition: 0.25,
            lapElapsedMs: 110,
            speedKmh: 132,
            brakeRatio: 0,
            throttleRatio: 0.5,
            steeringDegrees: 16,
            gear: 3,
            engineRpm: 6_600,
            tyreCoreTemperatureC: { frontLeft: 91.6, frontRight: 91.6, rearLeft: 91.6, rearRight: 91.6 },
        })
        expect(cell?.quality).toEqual({ timelineContinuous: true, discontinuousChannels: [] })
    })

    test('preserves discontinuities from every transition overlapping the cell', () => {
        const timeline = createTimeline([0.9, 0.1, 0.35, 0.8, 0.05])
        const transitions: AuditedTimelineTransition[] = timeline.transitions.map((transition, transitionIndex) => transitionIndex === 2
            ? { ...transition, discontinuousChannels: ['engineRpm', 'speedKmh'] }
            : transition)
        const cell = createCoachCalls({ ...timeline, transitions }, createCellAlignedLapDetection()).cellAlignedRacingTelemetry.laps[0]?.cells[0]

        expect(cell?.quality).toEqual({
            timelineContinuous: true,
            discontinuousChannels: ['engineRpm', 'speedKmh'],
        })
        expect(cell?.center.speedKmh).toBe(132)
        expect(cell?.center.engineRpm).toBe(6_600)
    })
})

function createLapDetection(laps: ReadonlyArray<readonly [lapNumber: number, lapTimeMs: number, realRacingEligible: boolean]>): LapDetectionResult {
    return {
        positionCalibration: null,
        linearGrid: null,
        lapCrossings: [],
        laps: laps.map(([lapNumber, lapTimeMs]) => createLap(lapNumber, lapTimeMs)),
        lapFragments: [],
        linearizedLaps: [],
        lapGridCoverages: [],
        lapEligibilityResults: laps.map(([lapNumber, , eligible]) => createEligibility(lapNumber, eligible)),
    }
}

function createCellAlignedLapDetection(): LapDetectionResult {
    const lap = {
        ...createLap(1, 300),
        startCrossing: { transitionIndex: 0, timestampMs: 50 } as DetectedLap['startCrossing'],
        endCrossing: { transitionIndex: 3, timestampMs: 350 } as DetectedLap['endCrossing'],
    }
    return {
        ...createLapDetection([[1, 300, true]]),
        positionCalibration: {
            medianPositionStep: 0.3,
            maximumSupportedPositionSpan: 0.5,
            medianPositionRatePerSecond: 3,
            globalPositionRateLimitPerSecond: 5,
        },
        linearGrid: { cellCount: 2, positionStep: 0.5, positions: [0, 0.5, 1], medianUsablePositionSampleCountPerLap: 2 },
        laps: [lap],
        linearizedLaps: [{
            lapNumber: 1,
            elapsedTimestampsMs: [0, 150, 300],
            steeringDegrees: [0, 0, 0],
            coverage: {} as LinearizedLap['coverage'],
            issues: [],
        }],
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
        eligibility: { timeEligible: decision, realRacing: decision },
    }
}

function createFrame(sourceIndex: number, normalizedTrackPosition: number): NormalizedTelemetryFrame {
    return new NormalizedTelemetryFrame({
        sourceIndex,
        timestampMs: sourceIndex * 100,
        recordedLapNumber: 1,
        normalizedTrackPosition,
        speedKmh: 100 + sourceIndex * 20,
        throttleRatio: 0.5,
        brakeRatio: 0,
        steeringDegrees: sourceIndex * 10,
        gear: sourceIndex + 1,
        engineRpm: 5_000 + sourceIndex * 1_000,
        tyreCoreTemperatureC: {
            frontLeft: 90 + sourceIndex,
            frontRight: 90 + sourceIndex,
            rearLeft: 90 + sourceIndex,
            rearRight: 90 + sourceIndex,
        },
    })
}

function createTimeline(positions: readonly number[]): UsableTimeline {
    const normalizedFrames = positions.map((position, sourceIndex) => createFrame(sourceIndex, position))
    const frames = normalizedFrames.map((frame): AuditedFrame => ({ frame, suspectChannels: [], invalidChannels: [] }))
    const transitions = normalizedFrames.slice(1).map((current, index): AuditedTimelineTransition => ({
        previous: normalizedFrames[index], current, timestampDeltaMs: 100, relation: 'chronological', timeContinuity: 'continuous', discontinuousChannels: [],
    }))
    return { frames, transitions, excludedFrames: [] }
}
