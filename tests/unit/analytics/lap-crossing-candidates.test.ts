import { describe, expect, test } from 'bun:test'
import { createFrameTransitions } from '../../../src/analytics/audit/create-frame-transitions'
import { createTimelineTransitions } from '../../../src/analytics/audit/create-timeline-transitions'
import type { AuditedFrame, AuditedTimelineTransition, SamplingBaseline, UsableTimeline } from '../../../src/analytics/frame-audit-types'
import { DEFAULT_LAP_DETECTION_CONFIG } from '../../../src/analytics/lap-detect/config/lap-detection-config'
import { createDetectedLaps } from '../../../src/analytics/lap-detect/create-detected-laps'
import { createDetectedLapFragments } from '../../../src/analytics/lap-detect/create-detected-lap-fragments'
import { deriveLinearLapGrid } from '../../../src/analytics/lap-detect/derive-linear-lap-grid'
import { evaluateLapEligibility } from '../../../src/analytics/lap-detect/evaluate-lap-eligibility'
import { evaluateLapTimeEligibility } from '../../../src/analytics/lap-detect/evaluate-lap-time-eligibility'
import { indexAuditedFrames } from '../../../src/analytics/lap-detect/index-audited-frames'
import { findLapCrossingCandidates } from '../../../src/analytics/lap-detect/lap-crossing-candidates'
import { selectValidLapCrossings } from '../../../src/analytics/lap-detect/lap-crossing-selection'
import { findLapCrossings } from '../../../src/analytics/lap-detect/lap-crossings'
import type { LinearLapGrid, PositionCalibration } from '../../../src/analytics/lap-detect/lap-detect-types'
import { linearizeLap } from '../../../src/analytics/lap-detect/linearize-lap'
import { derivePositionCalibration } from '../../../src/analytics/lap-detect/position-support'
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

    test('gives missing counter evidence weak support and mismatch no support', () => {
        const missingTimeline = createTimeline([0.9, 0.98, 0.02, 0.1])
        const mismatchTimeline = createTimeline([0.9, 0.98, 0.02, 0.1], { recordedLapNumbers: [1, 1, 3, 3] })
        const missingCrossing = findLapCrossings(missingTimeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(missingTimeline), DEFAULT_LAP_DETECTION_CONFIG)[0]
        const mismatchCrossing = findLapCrossings(mismatchTimeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(mismatchTimeline), DEFAULT_LAP_DETECTION_CONFIG)[0]

        expect(missingCrossing.confidence.components.lapCounterAgreement).toBe(0.1)
        expect(mismatchCrossing.confidence.components.lapCounterAgreement).toBe(0)
        expect(missingCrossing.limitations.map(({ code }) => code)).toContain('LAP_COUNTER_CONFIRMATION_MISSING')
        expect(mismatchCrossing.limitations.map(({ code }) => code)).toContain('LAP_COUNTER_MISMATCH')
    })

    test('does not search for a counter increment across a time discontinuity', () => {
        const timeline = createTimeline([0.9, 0.98, 0.02, 0.1], {
            recordedLapNumbers: [1, 1, 1, 2],
            nonContinuousTransitionIndex: 2,
        })

        expect(findEvidence(timeline).status).toBe('missing')
    })

    test('interpolates the lap-crossing timestamp between candidate frames', () => {
        const timeline = createTimeline([0.9, 0.98, 0.02, 0.1])
        const auditedFrameBySourceIndex = indexAuditedFrames(timeline)
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, auditedFrameBySourceIndex, DEFAULT_LAP_DETECTION_CONFIG)

        expect(crossings).toHaveLength(1)
        expect(crossings[0]).toMatchObject({
            transitionIndex: 1,
            timestampMs: 150,
            positionInterpolation: {
                fromPosition: 0.98,
                toPosition: 0.02,
                unwrappedToPosition: 1.02,
            },
        })
        expect(crossings[0].positionInterpolation.positionSpan).toBeCloseTo(0.04)
        expect(crossings[0].positionInterpolation.maximumSupportedPositionSpan).toBeCloseTo(0.12)
        expect(crossings[0].positionInterpolation.maximumPlausiblePositionSpan).toBeCloseTo(0.1)
        expect(crossings[0].positionInterpolation.crossingFraction).toBeCloseTo(0.5)
        expect(crossings[0].confidence.components.interpolationSpanSupport).toBeCloseTo(
            DEFAULT_LAP_DETECTION_CONFIG.crossing.confidence.interpolationSpanConfidenceAtSupportedLimit ** (0.04 / 0.12),
        )
        expect(crossings[0].confidence.components.globalRatePlausibility).toBeCloseTo(
            DEFAULT_LAP_DETECTION_CONFIG.crossing.confidence.globalRateConfidenceAtPlausibleLimit ** (0.04 / 0.1),
        )
        expect(crossings[0].confidence.components.temporalResolution).toBeCloseTo(
            DEFAULT_LAP_DETECTION_CONFIG.crossing.confidence.temporalConfidenceAtMedianInterval,
        )
        expect(crossings[0].confidence.components.localRateConsistency).toBeCloseTo(0.25)
        expect(crossings[0].confidence.components.localRateSupport).toBeCloseTo(1 / 3)
        expect(crossings[0].confidence.components.lapCounterAgreement).toBe(
            DEFAULT_LAP_DETECTION_CONFIG.crossing.confidence.lapCounterAgreementScores.missing,
        )

        const confidence = crossings[0].confidence
        const components = confidence.components
        const boundaryWeights = DEFAULT_LAP_DETECTION_CONFIG.crossing.confidence.aggregationWeights.boundary
        const timestampWeights = DEFAULT_LAP_DETECTION_CONFIG.crossing.confidence.aggregationWeights.timestamp
        const effectiveBoundaryLocalRateWeight = boundaryWeights.localRateConsistency * components.localRateSupport
        const effectiveTimestampLocalRateWeight = timestampWeights.localRateConsistency * components.localRateSupport
        const expectedBoundaryConfidence = (
            components.localRateConsistency * effectiveBoundaryLocalRateWeight
            + components.localRateSupport * boundaryWeights.localRateSupport
            + components.globalRatePlausibility * boundaryWeights.globalRatePlausibility
            + components.lapCounterAgreement * boundaryWeights.lapCounterAgreement
        ) / (effectiveBoundaryLocalRateWeight + boundaryWeights.localRateSupport + boundaryWeights.globalRatePlausibility + boundaryWeights.lapCounterAgreement)
        const expectedTimestampConfidence = (
            components.interpolationSpanSupport * timestampWeights.interpolationSpanSupport
            + components.temporalResolution * timestampWeights.temporalResolution
            + components.localRateConsistency * effectiveTimestampLocalRateWeight
        ) / (timestampWeights.interpolationSpanSupport + timestampWeights.temporalResolution + effectiveTimestampLocalRateWeight)

        expect(confidence.boundaryConfidence).toBeCloseTo(expectedBoundaryConfidence)
        expect(confidence.timestampConfidence).toBeCloseTo(expectedTimestampConfidence)
        expect(confidence.overallConfidence).toBeCloseTo(Math.sqrt(expectedBoundaryConfidence * expectedTimestampConfidence))
    })

    test('gives exact position timing full interpolation support', () => {
        const timeline = createTimeline([0.9, 0.98, 0, 0.1], { recordedLapNumbers: [1, 1, 2, 2] })
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)

        expect(crossings).toHaveLength(1)
        expect(crossings[0].timestampMs).toBe(200)
        expect(crossings[0].confidence.components.interpolationSpanSupport).toBe(1)
        expect(crossings[0].confidence.components.temporalResolution).toBe(1)
        expect(crossings[0].confidence.components.lapCounterAgreement).toBe(
            DEFAULT_LAP_DETECTION_CONFIG.crossing.confidence.lapCounterAgreementScores.exact,
        )
    })

    test('reports interpolation beyond the dataset-supported position span', () => {
        const timeline = createTimeline([0.9, 0.98, 0.02, 0.1], { recordedLapNumbers: [1, 1, 2, 2] })
        const calibration = { ...POSITION_CALIBRATION, maximumSupportedPositionSpan: 0.03 }
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, calibration, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)

        expect(crossings).toHaveLength(1)
        expect(crossings[0].limitations).toHaveLength(1)
        const limitation = crossings[0].limitations[0]
        expect(limitation).toMatchObject({
            code: 'POSITION_INTERPOLATION_SPAN_EXCEEDED',
            severity: 'warning',
            fromPosition: 0.98,
            toPosition: 0.02,
            maximumSupportedPositionSpan: 0.03,
        })
        if (limitation.code !== 'POSITION_INTERPOLATION_SPAN_EXCEEDED') throw new Error('Expected a position-span limitation')
        expect(limitation.observedPositionSpan).toBeCloseTo(0.04)
    })

    test('reports position movement beyond the dataset-wide rate limit', () => {
        const timeline = createTimeline([0.9, 0.98, 0.02, 0.1], { recordedLapNumbers: [1, 1, 2, 2] })
        const calibration = { ...POSITION_CALIBRATION, globalPositionRateLimitPerSecond: 0.3 }
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, calibration, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)

        expect(crossings).toHaveLength(1)
        expect(crossings[0].limitations).toHaveLength(1)
        const limitation = crossings[0].limitations[0]
        expect(limitation).toMatchObject({
            code: 'POSITION_RATE_LIMIT_EXCEEDED',
            severity: 'warning',
            fromPosition: 0.98,
            toPosition: 0.02,
            transitionDurationMs: 100,
            globalPositionRateLimitPerSecond: 0.3,
        })
        if (limitation.code !== 'POSITION_RATE_LIMIT_EXCEEDED') throw new Error('Expected a position-rate limitation')
        expect(limitation.observedPositionRatePerSecond).toBeCloseTo(0.4)
    })

    test('gives full local-rate support when both sides contain enough usable transitions', () => {
        const timeline = createTimeline([0.7, 0.8, 0.9, 0.98, 0.02, 0.1, 0.2, 0.3])
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)

        expect(crossings).toHaveLength(1)
        expect(crossings[0].confidence.components.localRateSupport).toBe(1)
    })

    test('does not collect local-rate support across a time discontinuity', () => {
        const timeline = createTimeline([0.7, 0.8, 0.9, 0.98, 0.02, 0.1, 0.2, 0.3], { nonContinuousTransitionIndex: 4 })
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)

        expect(crossings).toHaveLength(1)
        expect(crossings[0].confidence.components.localRateSupport).toBe(0)
        expect(crossings[0].limitations).toContainEqual({
            code: 'LOCAL_POSITION_RATE_CONTEXT_UNAVAILABLE',
            severity: 'warning',
            message: 'Usable position-rate context was unavailable on at least one side of the lap crossing',
            usablePositionRateSamplesBefore: 3,
            usablePositionRateSamplesAfter: 0,
        })
    })

    test('decreases temporal resolution exponentially for a longer interpolation interval', () => {
        const timeline = createTimeline([0.9, 0.98, 0.02, 0.1], { timestampStepMs: 200 })
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)

        expect(crossings).toHaveLength(1)
        expect(crossings[0].confidence.components.temporalResolution).toBeCloseTo(
            DEFAULT_LAP_DETECTION_CONFIG.crossing.confidence.temporalConfidenceAtMedianInterval ** 2,
        )
    })

    test('derives maximum supported position span from the position-step distribution', () => {
        const timeline = createTimeline(Array.from({ length: 31 }, (_, index) => index * 0.01))
        const calibration = derivePositionCalibration(timeline, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)

        expect(calibration).not.toBeNull()
        expect(calibration?.medianPositionStep).toBeCloseTo(0.01)
        expect(calibration?.maximumSupportedPositionSpan).toBeCloseTo(0.01)
    })

    test('groups lap crossings into sequences separated by timeline breaks', () => {
        const positions = [0.9, 0.98, 0.02, 0.9, 0.98, 0.02]
        const continuousTimeline = createTimeline(positions)
        const continuousCrossings = findLapCrossings(continuousTimeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(continuousTimeline), DEFAULT_LAP_DETECTION_CONFIG)
        const brokenTimeline = createTimeline(positions, { breakTransitionIndex: 3 })
        const brokenCrossings = findLapCrossings(brokenTimeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(brokenTimeline), DEFAULT_LAP_DETECTION_CONFIG)

        const distinctLapCalibration = { ...POSITION_CALIBRATION, globalPositionRateLimitPerSecond: 10 }

        expect(selectValidLapCrossings(continuousTimeline, [...continuousCrossings].reverse(), distinctLapCalibration)).toEqual(continuousCrossings)
        expect(selectValidLapCrossings(brokenTimeline, [...brokenCrossings].reverse(), distinctLapCalibration)).toEqual(brokenCrossings)
    })

    test('keeps the preferred crossing when two candidates cannot represent distinct lap boundaries', () => {
        const timeline = createTimeline([0.9, 0.98, 0.02, 0.9, 0.98, 0.02])
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)
        const firstCrossing = withConfidence(crossings[0], 0.7, 0.9)
        const secondCrossing = withConfidence(crossings[1], 0.8, 0.1)

        expect(selectValidLapCrossings(timeline, [firstCrossing, secondCrossing], POSITION_CALIBRATION)).toEqual([secondCrossing])
    })

    test('creates one complete lap between consecutive crossings without a timeline break', () => {
        const positions = [0.9, 0.98, 0.02, 0.9, 0.98, 0.02]
        const timeline = createTimeline(positions)
        const detectedCrossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)
        const calibration = { ...POSITION_CALIBRATION, globalPositionRateLimitPerSecond: 10 }
        const selectedCrossings = selectValidLapCrossings(timeline, detectedCrossings, calibration)

        const laps = createDetectedLaps(timeline, selectedCrossings)

        expect(laps).toHaveLength(1)
        expect(laps[0]).toMatchObject({
            lapNumber: 1,
            startCrossing: selectedCrossings[0],
            endCrossing: selectedCrossings[1],
            lapTimeMs: selectedCrossings[1].timestampMs - selectedCrossings[0].timestampMs,
        })
        expect(laps[0].confidence.boundaryConfidence).toBeCloseTo(Math.sqrt(
            selectedCrossings[0].confidence.boundaryConfidence * selectedCrossings[1].confidence.boundaryConfidence,
        ))
        expect(laps[0].confidence.lapTimeConfidence).toBeCloseTo(Math.sqrt(
            selectedCrossings[0].confidence.timestampConfidence * selectedCrossings[1].confidence.timestampConfidence,
        ))
        expect(laps[0].confidence.overallConfidence).toBeCloseTo(Math.sqrt(
            laps[0].confidence.boundaryConfidence * laps[0].confidence.lapTimeConfidence,
        ))
    })

    test('marks a defensible positive lap time as eligible', () => {
        const lap = createLapWithConfidence(0.8, 0.9)

        expect(evaluateLapTimeEligibility(lap, DEFAULT_LAP_DETECTION_CONFIG.eligibility.time)).toEqual({
            eligible: true,
            reasons: [],
        })
    })

    test('reports every failed lap-time eligibility requirement', () => {
        const lap = {
            ...createLapWithConfidence(0.4, 0.3),
            lapTimeMs: 0,
        }

        expect(evaluateLapTimeEligibility(lap, DEFAULT_LAP_DETECTION_CONFIG.eligibility.time)).toEqual({
            eligible: false,
            reasons: [
                { code: 'NON_POSITIVE_LAP_TIME', lapTimeMs: 0 },
                { code: 'BOUNDARY_CONFIDENCE_BELOW_MINIMUM', observedValue: 0.4, requiredMinimum: 0.5 },
                { code: 'LAP_TIME_CONFIDENCE_BELOW_MINIMUM', observedValue: 0.3, requiredMinimum: 0.5 },
            ],
        })
    })

    test('marks a time-eligible lap as real-racing', () => {
        const lap = createLapWithConfidence(0.8, 0.9)
        const eligibility = evaluateLapEligibility(
            lap,
            DEFAULT_LAP_DETECTION_CONFIG.eligibility,
        )

        expect(eligibility).toEqual({
            timeEligible: { eligible: true, reasons: [] },
            realRacing: { eligible: true, reasons: [] },
        })
    })

    test('keeps a time-eligible lap real-racing despite a sampling gap', () => {
        const lap = {
            ...createLapWithConfidence(0.8, 0.9),
            limitations: [{
                code: 'SAMPLING_GAP_WITHIN_LAP' as const,
                severity: 'warning' as const,
                message: 'A sampling gap occurs within the detected lap',
                gapStartTimestampMs: 200,
                gapEndTimestampMs: 300,
                gapDurationMs: 100,
                fromPosition: 0.2,
                toPosition: 0.4,
                mayContainLapBoundary: false,
            }],
        }
        const eligibility = evaluateLapEligibility(
            lap,
            DEFAULT_LAP_DETECTION_CONFIG.eligibility,
        )

        expect(eligibility.realRacing).toEqual({ eligible: true, reasons: [] })
    })

    test('excludes a detected lap when a sampling gap may hide another lap boundary', () => {
        const positions = [
            0.9, 0.98, 0.02,
            0.9, 0.98, 0.02,
            0.9, 0.98, 0.02,
        ]
        const timeline = createTimeline(positions, {
            recordedLapNumbers: [1, 1, 2, 2, 2, 3, 3, 3, 4],
            nonContinuousTransitionIndex: 4,
        })
        const crossings = findLapCrossings(
            timeline,
            SAMPLING_BASELINE,
            POSITION_CALIBRATION,
            indexAuditedFrames(timeline),
            DEFAULT_LAP_DETECTION_CONFIG,
        )
        const lap = createDetectedLaps(timeline, crossings)[0]
        const eligibility = evaluateLapEligibility(
            lap,
            DEFAULT_LAP_DETECTION_CONFIG.eligibility,
        )

        expect(crossings).toHaveLength(2)
        expect(lap.limitations).toContainEqual(expect.objectContaining({
            code: 'SAMPLING_GAP_WITHIN_LAP',
            fromPosition: 0.98,
            toPosition: 0.02,
            mayContainLapBoundary: true,
        }))
        expect(eligibility.timeEligible.eligible).toBeFalse()
        expect(eligibility.timeEligible.reasons).toContainEqual({
            code: 'SAMPLING_GAP_WITHIN_LAP',
        })
        expect(eligibility.realRacing).toEqual(eligibility.timeEligible)
    })

    test('uses a lap-counter change across a non-wrapping gap only as an eligibility veto', () => {
        const positions = [0.9, 0.98, 0.02, 0.3, 0.4, 0.6, 0.9, 0.98, 0.02]
        const timeline = createTimeline(positions, {
            recordedLapNumbers: [1, 1, 2, 2, 3, 3, 3, 3, 4],
            nonContinuousTransitionIndex: 3,
        })
        const crossings = findLapCrossings(
            timeline,
            SAMPLING_BASELINE,
            POSITION_CALIBRATION,
            indexAuditedFrames(timeline),
            DEFAULT_LAP_DETECTION_CONFIG,
        )
        const lap = createDetectedLaps(timeline, crossings)[0]

        expect(crossings).toHaveLength(2)
        expect(lap.limitations).toContainEqual(expect.objectContaining({
            code: 'SAMPLING_GAP_WITHIN_LAP',
            fromPosition: 0.3,
            toPosition: 0.4,
            mayContainLapBoundary: true,
        }))
        expect(evaluateLapEligibility(
            lap,
            DEFAULT_LAP_DETECTION_CONFIG.eligibility,
        ).timeEligible.eligible).toBeFalse()
    })

    test('copies failed lap-time requirements into the real-racing decision', () => {
        const lap = {
            ...createLapWithConfidence(0.4, 0.3),
            lapTimeMs: 0,
        }
        const eligibility = evaluateLapEligibility(
            lap,
            DEFAULT_LAP_DETECTION_CONFIG.eligibility,
        )

        expect(eligibility.realRacing).toEqual(eligibility.timeEligible)
        expect(eligibility.realRacing).toEqual({
            eligible: false,
            reasons: [
                { code: 'NON_POSITIVE_LAP_TIME', lapTimeMs: 0 },
                { code: 'BOUNDARY_CONFIDENCE_BELOW_MINIMUM', observedValue: 0.4, requiredMinimum: 0.5 },
                { code: 'LAP_TIME_CONFIDENCE_BELOW_MINIMUM', observedValue: 0.3, requiredMinimum: 0.5 },
            ],
        })
    })

    test('does not create a lap across a timeline break', () => {
        const positions = [0.9, 0.98, 0.02, 0.9, 0.98, 0.02]
        const timeline = createTimeline(positions, { breakTransitionIndex: 3 })
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)

        expect(createDetectedLaps(timeline, crossings)).toEqual([])
    })

    test('reports the opening and closing fragments outside complete laps', () => {
        const timeline = createTimeline([0.4, 0.9, 0.98, 0.02, 0.4, 0.9, 0.98, 0.02, 0.42])
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)

        expect(createDetectedLapFragments(timeline, crossings)).toEqual([
            { startPosition: 0.4, endPosition: 1, startFrameIndex: 0, endFrameIndex: 3 },
            { startPosition: 0, endPosition: 0.42, startFrameIndex: 6, endFrameIndex: 8 },
        ])
    })

    test('reports a whole timeline segment as one fragment without a lap crossing', () => {
        const timeline = createTimeline([0.2, 0.3, 0.4])

        expect(createDetectedLapFragments(timeline, [])).toEqual([
            { startPosition: 0.2, endPosition: 0.4, startFrameIndex: 0, endFrameIndex: 2 },
        ])
    })

    test('splits fragments at a timeline break but not at a sampling gap', () => {
        const positions = [0.4, 0.9, 0.98, 0.02, 0.3, 0.9, 0.98, 0.02, 0.2]
        const brokenTimeline = createTimeline(positions, { breakTransitionIndex: 3 })
        const brokenCrossings = findLapCrossings(brokenTimeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(brokenTimeline), DEFAULT_LAP_DETECTION_CONFIG)
        const gappedTimeline = createTimeline(positions, { nonContinuousTransitionIndex: 3 })
        const gappedCrossings = findLapCrossings(gappedTimeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(gappedTimeline), DEFAULT_LAP_DETECTION_CONFIG)

        expect(createDetectedLapFragments(brokenTimeline, brokenCrossings)).toEqual([
            { startPosition: 0.4, endPosition: 1, startFrameIndex: 0, endFrameIndex: 3 },
            { startPosition: 0, endPosition: 0.02, startFrameIndex: 2, endFrameIndex: 3 },
            { startPosition: 0.3, endPosition: 1, startFrameIndex: 4, endFrameIndex: 7 },
            { startPosition: 0, endPosition: 0.2, startFrameIndex: 6, endFrameIndex: 8 },
        ])
        expect(createDetectedLapFragments(gappedTimeline, gappedCrossings)).toEqual([
            { startPosition: 0.4, endPosition: 1, startFrameIndex: 0, endFrameIndex: 3 },
            { startPosition: 0, endPosition: 0.2, startFrameIndex: 6, endFrameIndex: 8 },
        ])
    })

    test('reports every sampling gap within a detected lap', () => {
        const positions = [0.9, 0.98, 0.02, 0.9, 0.98, 0.02]
        const timeline = createTimeline(positions, { nonContinuousTransitionIndex: 3 })
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)
        const laps = createDetectedLaps(timeline, crossings)

        expect(laps).toHaveLength(1)
        expect(laps[0].limitations).toEqual([{
            code: 'SAMPLING_GAP_WITHIN_LAP',
            severity: 'warning',
            message: 'A sampling gap occurs within the detected lap',
            gapStartTimestampMs: 300,
            gapEndTimestampMs: 400,
            gapDurationMs: 100,
            fromPosition: 0.9,
            toPosition: 0.98,
            mayContainLapBoundary: false,
        }])
    })

    test('derives linear grid resolution from the median usable position sample count per lap', () => {
        const positions = [0.9, 0.98, 0.02, 0.3, 0.6, 0.98, 0.02, 0.5, 0.98, 0.02]
        const timeline = createTimeline(positions)
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)
        const laps = createDetectedLaps(timeline, crossings)

        expect(deriveLinearLapGrid(timeline, laps)).toEqual({
            cellCount: 3,
            positionStep: 1 / 3,
            positions: [0, 1 / 3, 2 / 3, 1],
            medianUsablePositionSampleCountPerLap: 3.5,
        })
    })

    test('linearly interpolates elapsed timestamps and steering on the shared grid', () => {
        const positions = [0.9, 0.98, 0.02, 0.3, 0.6, 0.98, 0.02]
        const timeline = createTimeline(positions, { steeringDegrees: positions.map((position) => position * 100) })
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)
        const lap = createDetectedLaps(timeline, crossings)[0]
        const linearized = linearizeLap(timeline, lap, LINEARIZATION_GRID, LINEARIZATION_CALIBRATION, indexAuditedFrames(timeline))

        expect(linearized.elapsedTimestampsMs[0]).toBeCloseTo(0)
        expect(linearized.elapsedTimestampsMs[1]).toBeCloseTo(132.142857)
        expect(linearized.elapsedTimestampsMs[2]).toBeCloseTo(216.666667)
        expect(linearized.elapsedTimestampsMs[3]).toBeCloseTo(289.473684)
        expect(linearized.elapsedTimestampsMs[4]).toBeCloseTo(400)
        expect(linearized.steeringDegrees[0]).toBeCloseTo(50)
        expect(linearized.steeringDegrees[1]).toBeCloseTo(25)
        expect(linearized.steeringDegrees[2]).toBeCloseTo(50)
        expect(linearized.steeringDegrees[3]).toBeCloseTo(75)
        expect(linearized.steeringDegrees[4]).toBeCloseTo(50)
        expect(linearized.coverage.position.supportMask).toEqual([true, true, true, true, true])
        expect(linearized.coverage.steering.supportMask).toEqual([true, true, true, true, true])
        expect(linearized.issues).toEqual(LINEARIZATION_GRID.positions.map((normalizedTrackPosition, gridIndex) => ({ code: 'INTERPOLATED', gridIndex, normalizedTrackPosition })))
    })

    test('leaves grid points null when the bracketing position span exceeds calibrated support', () => {
        const positions = [0.9, 0.98, 0.02, 0.3, 0.6, 0.98, 0.02]
        const timeline = createTimeline(positions, { steeringDegrees: positions.map((position) => position * 100) })
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)
        const lap = createDetectedLaps(timeline, crossings)[0]
        const calibration = { ...LINEARIZATION_CALIBRATION, maximumSupportedPositionSpan: 0.2 }
        const linearized = linearizeLap(timeline, lap, LINEARIZATION_GRID, calibration, indexAuditedFrames(timeline))

        expect(linearized.elapsedTimestampsMs).toEqual([0, null, null, null, 400])
        expect(linearized.steeringDegrees).toEqual([50, null, null, null, 50])
        expect(linearized.issues).toEqual([
            { code: 'INTERPOLATED', gridIndex: 0, normalizedTrackPosition: 0 },
            { code: 'POSITION_SPAN_EXCEEDED', gridIndex: 1, normalizedTrackPosition: 0.25 },
            { code: 'POSITION_SPAN_EXCEEDED', gridIndex: 2, normalizedTrackPosition: 0.5 },
            { code: 'POSITION_SPAN_EXCEEDED', gridIndex: 3, normalizedTrackPosition: 0.75 },
            { code: 'INTERPOLATED', gridIndex: 4, normalizedTrackPosition: 1 },
        ])
        expect(linearized.coverage.position).toMatchObject({ supportMask: [true, false, false, false, true], coverageRatio: 0.4, longestUnsupportedNormalizedPositionSpan: 0.75 })
    })

    test('leaves grid points null when the bracketing position rate exceeds calibrated support', () => {
        const positions = [0.9, 0.98, 0.02, 0.3, 0.6, 0.98, 0.02]
        const timeline = createTimeline(positions)
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)
        const lap = createDetectedLaps(timeline, crossings)[0]
        const calibration = { ...LINEARIZATION_CALIBRATION, globalPositionRateLimitPerSecond: 2.5 }
        const linearized = linearizeLap(timeline, lap, LINEARIZATION_GRID, calibration, indexAuditedFrames(timeline))

        expect(linearized.issues).toEqual([
            { code: 'INTERPOLATED', gridIndex: 0, normalizedTrackPosition: 0 },
            { code: 'POSITION_RATE_EXCEEDED', gridIndex: 1, normalizedTrackPosition: 0.25 },
            { code: 'POSITION_RATE_EXCEEDED', gridIndex: 2, normalizedTrackPosition: 0.5 },
            { code: 'POSITION_RATE_EXCEEDED', gridIndex: 3, normalizedTrackPosition: 0.75 },
            { code: 'INTERPOLATED', gridIndex: 4, normalizedTrackPosition: 1 },
        ])
    })

    test('keeps elapsed timestamps but leaves steering null across an unusable steering transition', () => {
        const positions = [0.9, 0.98, 0.02, 0.3, 0.6, 0.98, 0.02]
        const timeline = createTimeline(positions, { invalidSteeringSourceIndex: 3, steeringDegrees: positions.map((position) => position * 100) })
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)
        const lap = createDetectedLaps(timeline, crossings)[0]
        const linearized = linearizeLap(timeline, lap, LINEARIZATION_GRID, LINEARIZATION_CALIBRATION, indexAuditedFrames(timeline))

        expect(linearized.elapsedTimestampsMs.every((value) => value !== null)).toBeTrue()
        expect(linearized.steeringDegrees).toEqual([50, null, null, 75, 50])
        expect(linearized.issues).toEqual([
            { code: 'INTERPOLATED', gridIndex: 0, normalizedTrackPosition: 0 },
            { code: 'INTERPOLATED', gridIndex: 1, normalizedTrackPosition: 0.25 },
            { code: 'STEERING_TRANSITION_UNUSABLE', gridIndex: 1, normalizedTrackPosition: 0.25 },
            { code: 'INTERPOLATED', gridIndex: 2, normalizedTrackPosition: 0.5 },
            { code: 'STEERING_TRANSITION_UNUSABLE', gridIndex: 2, normalizedTrackPosition: 0.5 },
            { code: 'INTERPOLATED', gridIndex: 3, normalizedTrackPosition: 0.75 },
            { code: 'INTERPOLATED', gridIndex: 4, normalizedTrackPosition: 1 },
        ])
    })

    test('does not interpolate any channel across a non-continuous transition', () => {
        const positions = [0.9, 0.98, 0.02, 0.3, 0.6, 0.98, 0.02]
        const timeline = createTimeline(positions, { nonContinuousTransitionIndex: 3, steeringDegrees: positions.map((position) => position * 100) })
        const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)
        const lap = createDetectedLaps(timeline, crossings)[0]
        const linearized = linearizeLap(timeline, lap, LINEARIZATION_GRID, LINEARIZATION_CALIBRATION, indexAuditedFrames(timeline))

        expect(linearized.elapsedTimestampsMs[2]).toBeNull()
        expect(linearized.steeringDegrees[2]).toBeNull()
        expect(linearized.issues).toContainEqual({ code: 'POSITION_TRANSITION_UNUSABLE', gridIndex: 2, normalizedTrackPosition: 0.5 })
    })
})

const POSITION_CALIBRATION: PositionCalibration = {
    medianPositionStep: 0.02,
    maximumSupportedPositionSpan: 0.12,
    medianPositionRatePerSecond: 0.2,
    globalPositionRateLimitPerSecond: 1,
}

const LINEARIZATION_CALIBRATION: PositionCalibration = {
    ...POSITION_CALIBRATION,
    maximumSupportedPositionSpan: 0.4,
    globalPositionRateLimitPerSecond: 4,
}

const LINEARIZATION_GRID: LinearLapGrid = {
    cellCount: 4,
    positionStep: 0.25,
    positions: [0, 0.25, 0.5, 0.75, 1],
    medianUsablePositionSampleCountPerLap: 4,
}

const SAMPLING_BASELINE: SamplingBaseline = {
    sampleCount: 100,
    medianDeltaMs: 100,
    madDeltaMs: 0,
    scaledMadDeltaMs: 0,
    maximumGapMs: 500,
}

interface TimelineOptions {
    readonly invalidPositionSourceIndex?: number
    readonly invalidSteeringSourceIndex?: number
    readonly recordedLapNumbers?: readonly number[]
    readonly nonContinuousTransitionIndex?: number
    readonly breakTransitionIndex?: number
    readonly timestampStepMs?: number
    readonly speedKmh?: readonly number[]
    readonly steeringDegrees?: readonly number[]
}

function findEvidence(timeline: UsableTimeline) {
    const candidates = findLapCrossingCandidates(timeline, indexAuditedFrames(timeline), 1)
    if (candidates.length !== 1) throw new Error(`Expected one lap-crossing candidate, received ${candidates.length}`)
    return candidates[0].lapCounterEvidence
}

function withConfidence(crossing: ReturnType<typeof findLapCrossings>[number], boundaryConfidence: number, timestampConfidence: number) {
    return {
        ...crossing,
        confidence: { ...crossing.confidence, boundaryConfidence, timestampConfidence },
    }
}

function createLapWithConfidence(boundaryConfidence: number, lapTimeConfidence: number) {
    const timeline = createTimeline([0.9, 0.98, 0.02, 0.9, 0.98, 0.02])
    const crossings = findLapCrossings(timeline, SAMPLING_BASELINE, POSITION_CALIBRATION, indexAuditedFrames(timeline), DEFAULT_LAP_DETECTION_CONFIG)
    const lap = createDetectedLaps(timeline, crossings)[0]

    return {
        ...lap,
        confidence: { ...lap.confidence, boundaryConfidence, lapTimeConfidence },
    }
}

function createTimeline(positions: readonly number[], options: TimelineOptions = {}): UsableTimeline {
    const frames = positions.map((normalizedTrackPosition, sourceIndex) => createFrame(
        sourceIndex,
        normalizedTrackPosition,
        options.recordedLapNumbers?.[sourceIndex] ?? 1,
        options.timestampStepMs ?? 100,
        options.speedKmh?.[sourceIndex] ?? 100,
        options.steeringDegrees?.[sourceIndex] ?? 0,
    ))
    const auditedFrames: AuditedFrame[] = frames.map((frame) => ({
        frame,
        suspectChannels: [],
        invalidChannels: [
            ...(frame.sourceIndex === options.invalidPositionSourceIndex ? ['normalizedTrackPosition' as const] : []),
            ...(frame.sourceIndex === options.invalidSteeringSourceIndex ? ['steeringDegrees' as const] : []),
        ],
    }))
    const transitions: AuditedTimelineTransition[] = createTimelineTransitions(createFrameTransitions(frames)).map((transition, transitionIndex) => {
        const timeContinuity = transitionIndex === options.breakTransitionIndex
            ? 'break'
            : transitionIndex === options.nonContinuousTransitionIndex ? 'gap' : 'continuous'

        return { ...transition, timeContinuity, discontinuousChannels: [] }
    })

    return { frames: auditedFrames, excludedFrames: [], transitions }
}

function createFrame(sourceIndex: number, normalizedTrackPosition: number, recordedLapNumber: number, timestampStepMs: number, speedKmh: number, steeringDegrees: number): NormalizedTelemetryFrame {
    return new NormalizedTelemetryFrame({
        sourceIndex,
        timestampMs: sourceIndex * timestampStepMs,
        recordedLapNumber,
        normalizedTrackPosition,
        speedKmh,
        throttleRatio: 0.5,
        brakeRatio: 0,
        steeringDegrees,
        gear: 4,
        engineRpm: 5_000,
        tyreCoreTemperatureC: { frontLeft: 90, frontRight: 90, rearLeft: 90, rearRight: 90 },
    })
}
