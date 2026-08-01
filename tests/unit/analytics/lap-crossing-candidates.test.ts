import { describe, expect, test } from 'bun:test'
import { createFrameTransitions } from '../../../src/analytics/audit/create-frame-transitions'
import { createTimelineTransitions } from '../../../src/analytics/audit/create-timeline-transitions'
import type { AuditedFrame, AuditedTimelineTransition, UsableTimeline } from '../../../src/analytics/frame-audit-types'
import { indexAuditedFrames } from '../../../src/analytics/lap-detect/index-audited-frames'
import { findLapCrossingCandidates } from '../../../src/analytics/lap-detect/lap-crossing-candidates'
import { NormalizedTelemetryFrame } from '../../../src/analytics/telemetry-types'

describe('findLapCrossingCandidates', () => {
    test('returns a usable transition whose position wraps across the lap boundary', () => {
        const timeline = createTimeline([0.9, 0.98, 0.02, 0.1])
        const candidates = findLapCrossingCandidates(timeline, indexAuditedFrames(timeline), 1)

        expect(candidates).toEqual([{
            transitionIndex: 1,
            transition: timeline.transitions[1],
            lapCounterEvidence: {
                status: 'missing',
                frameOffset: null,
                previousLapNumber: 1,
                observedLapNumber: null,
            },
        }])
    })

    test('requires valid position channels on both wrap endpoints', () => {
        for (const invalidPositionSourceIndex of [1, 2]) {
            const timeline = createTimeline([0.9, 0.98, 0.02, 0.1], { invalidPositionSourceIndex })
            const candidates = findLapCrossingCandidates(timeline, indexAuditedFrames(timeline), 1)

            expect(candidates).toEqual([])
        }
    })

    test('classifies an increment on the candidate transition as exact', () => {
        const evidence = findEvidence(createTimeline([0.9, 0.98, 0.02, 0.1], { recordedLapNumbers: [1, 1, 2, 2] }))

        expect(evidence).toEqual({ status: 'exact', frameOffset: 0, previousLapNumber: 1, observedLapNumber: 2 })
    })

    test('classifies one surrounding increment as nearby', () => {
        const evidence = findEvidence(createTimeline([0.9, 0.98, 0.02, 0.1], { recordedLapNumbers: [1, 1, 1, 2] }))

        expect(evidence).toEqual({ status: 'nearby', frameOffset: 1, previousLapNumber: 1, observedLapNumber: 2 })
    })

    test('classifies no counter change as missing', () => {
        const evidence = findEvidence(createTimeline([0.9, 0.98, 0.02, 0.1]))

        expect(evidence).toEqual({ status: 'missing', frameOffset: null, previousLapNumber: 1, observedLapNumber: null })
    })

    test('classifies another non-zero counter change as mismatch', () => {
        const evidence = findEvidence(createTimeline([0.9, 0.98, 0.02, 0.1], { recordedLapNumbers: [1, 1, 3, 3] }))

        expect(evidence).toEqual({ status: 'mismatch', frameOffset: 0, previousLapNumber: 1, observedLapNumber: 3 })
    })

    test('does not search for a counter increment across a time discontinuity', () => {
        const timeline = createTimeline([0.9, 0.98, 0.02, 0.1], {
            recordedLapNumbers: [1, 1, 1, 2],
            nonContinuousTransitionIndex: 2,
        })

        expect(findEvidence(timeline).status).toBe('missing')
    })
})

interface TimelineOptions {
    readonly invalidPositionSourceIndex?: number
    readonly recordedLapNumbers?: readonly number[]
    readonly nonContinuousTransitionIndex?: number
}

function findEvidence(timeline: UsableTimeline) {
    const candidates = findLapCrossingCandidates(timeline, indexAuditedFrames(timeline), 1)
    if (candidates.length !== 1) throw new Error(`Expected one lap-crossing candidate, received ${candidates.length}`)
    return candidates[0].lapCounterEvidence
}

function createTimeline(positions: readonly number[], options: TimelineOptions = {}): UsableTimeline {
    const frames = positions.map((normalizedTrackPosition, sourceIndex) => createFrame(
        sourceIndex,
        normalizedTrackPosition,
        options.recordedLapNumbers?.[sourceIndex] ?? 1,
    ))
    const auditedFrames: AuditedFrame[] = frames.map((frame) => ({
        frame,
        suspectChannels: [],
        invalidChannels: frame.sourceIndex === options.invalidPositionSourceIndex ? ['normalizedTrackPosition'] : [],
    }))
    const transitions: AuditedTimelineTransition[] = createTimelineTransitions(createFrameTransitions(frames)).map((transition, transitionIndex) => ({
        ...transition,
        timeContinuity: transitionIndex === options.nonContinuousTransitionIndex ? 'gap' : 'continuous',
        discontinuousChannels: [],
    }))

    return { frames: auditedFrames, excludedFrames: [], transitions }
}

function createFrame(sourceIndex: number, normalizedTrackPosition: number, recordedLapNumber: number): NormalizedTelemetryFrame {
    return new NormalizedTelemetryFrame({
        sourceIndex,
        timestampMs: sourceIndex * 100,
        recordedLapNumber,
        normalizedTrackPosition,
        speedKmh: 100,
        throttleRatio: 0.5,
        brakeRatio: 0,
        steeringDegrees: 0,
        gear: 4,
        engineRpm: 5_000,
        tyreCoreTemperatureC: { frontLeft: 90, frontRight: 90, rearLeft: 90, rearRight: 90 },
    })
}
