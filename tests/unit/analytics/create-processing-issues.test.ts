import { describe, expect, test } from 'bun:test'
import { createProcessingIssues } from '../../../src/analytics/audit/create-processing-issues'
import type { FrameAuditConfig, IsolatedChannelOutlier, SamplingBaseline, TimelineTransition } from '../../../src/analytics/frame-audit-types'
import { NormalizedTelemetryFrame } from '../../../src/analytics/telemetry-types'

const CONFIG: FrameAuditConfig = {
    sampling: { minimumSampleCount: 0, gapMedianMultiplier: 5, gapMadMultiplier: 10 },
    isolatedOutlier: { minimumResidualSampleCount: 5, signalMadMultiplier: 12, driverInputMadMultiplier: 20, minimumReturnRateRatio: 0.25, fallbackIqrMultiplier: 3, minimumResidualBySignalChannel: {} },
    channelContinuity: { minimumRateSampleCount: 5, rateMadMultiplier: 12, rateIqrMultiplier: 3, windowDurationMultiplier: 5, minimumWindowSamples: 4, minimumBoundaryShareOfPersistentShift: 0.5, minimumShiftToSpreadRatio: 6 },
}

const SAMPLING_BASELINE: SamplingBaseline = { sampleCount: 10, medianDeltaMs: 50, madDeltaMs: 0, scaledMadDeltaMs: 0, maximumGapMs: 250 }

function createFrame(sourceIndex: number, timestampMs: number, speedKmh = 100) : NormalizedTelemetryFrame {
    return new NormalizedTelemetryFrame({
        sourceIndex,
        timestampMs,
        recordedLapNumber: 1,
        normalizedTrackPosition: sourceIndex / 10,
        speedKmh,
        throttleRatio: 0.8,
        brakeRatio: 0,
        steeringDegrees: 2,
        gear: 4,
        engineRpm: 5_000,
        tyreCoreTemperatureC: { frontLeft: 90, frontRight: 91, rearLeft: 92, rearRight: 93 },
    })
}

describe('createProcessingIssues', () => {
    test('describes conflicting values at the same timestamp', () => {
        const previous = createFrame(0, 100, 100)
        const current = createFrame(1, 100, 120)
        const transition: TimelineTransition = { previous, current, timestampDeltaMs: 0, relation: 'same-timestamp-conflict' }
        const issues = createProcessingIssues([transition], SAMPLING_BASELINE, [], null, [], CONFIG)

        expect(issues).toEqual([expect.objectContaining({
            id: 'time-order-violation:same-timestamp:0:1',
            code: 'TIME_ORDER_VIOLATION',
            action: 'exclude-frame',
            severity: 'error',
            scope: 'frame',
            reason: 'same-timestamp-conflict',
            sourceIndex: 1,
            observed: { previousSourceIndex: 0, timestampMs: 100, timestampDeltaMs: 0 },
        })])
        expect(issues[0].message).toContain('share timestamp 100 ms but contain different telemetry')
    })

    test('splits at a timestamp regression when neither endpoint is an isolated timestamp outlier', () => {
        const previous = createFrame(0, 124)
        const current = createFrame(1, 110)
        const transition: TimelineTransition = { previous, current, timestampDeltaMs: -14, relation: 'timestamp-regression' }
        const issues = createProcessingIssues([transition], SAMPLING_BASELINE, [], null, [], CONFIG)

        expect(issues).toEqual([expect.objectContaining({
            id: 'time-order-violation:timestamp-regression:0:1',
            code: 'TIME_ORDER_VIOLATION',
            action: 'split-timeline',
            severity: 'error',
            scope: 'transition',
            reason: 'timestamp-regression',
            sourceIndex: 0,
            nextSourceIndex: 1,
            observed: { previousTimestampMs: 124, currentTimestampMs: 110, timestampDeltaMs: -14 },
            thresholds: { minimumTimestampDeltaMs: 0 },
        })])
    })

    test('reports a safely removable isolated timestamp outlier without a redundant timeline split', () => {
        const previous = createFrame(0, 124)
        const current = createFrame(1, 110)
        const next = createFrame(2, 125)
        const transition: TimelineTransition = { previous, current, timestampDeltaMs: -14, relation: 'timestamp-regression' }
        const outlier: IsolatedChannelOutlier = { frame: current, channel: 'timestampMs', usability: 'invalid', previousValue: previous.timestampMs, observedValue: current.timestampMs, nextValue: next.timestampMs, threshold: 250 }
        const issues = createProcessingIssues([transition], SAMPLING_BASELINE, [outlier], null, [], CONFIG)

        expect(issues).toHaveLength(1)
        expect(issues[0]).toMatchObject({
            id: 'local-outlier:1:timestampMs',
            code: 'LOCAL_OUTLIER',
            action: 'exclude-frame',
            severity: 'error',
            scope: 'frame',
            reason: 'isolated-timestamp-outlier',
            channels: ['timestampMs'],
            thresholds: { maximumBridgeGapMs: 250 },
        })
    })
})
