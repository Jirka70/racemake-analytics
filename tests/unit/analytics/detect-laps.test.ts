import { describe, expect, test } from 'bun:test'
import { createFrameTransitions } from '../../../src/analytics/audit/create-frame-transitions'
import { createTimelineTransitions } from '../../../src/analytics/audit/create-timeline-transitions'
import type {
    AuditedFrame,
    AuditedTimelineTransition,
    LocallyAuditedSignalChannel,
    TelemetryAuditResult,
} from '../../../src/analytics/frame-audit-types'
import { DEFAULT_LAP_DETECTION_CONFIG } from '../../../src/analytics/lap-detect/config/lap-detection-config'
import { detectLaps } from '../../../src/analytics/lap-detect/detect-laps'
import type { LapDetectionConfig } from '../../../src/analytics/lap-detect/lap-detect-types'
import { derivePositionCalibration } from '../../../src/analytics/lap-detect/position-support'
import { NormalizedTelemetryFrame } from '../../../src/analytics/telemetry-types'

interface CircularStintOptions {
    readonly startProgress?: number
    readonly endProgress?: number
    readonly samplesPerLap?: number
    readonly sampleIntervalMs?: number
    readonly speedKmh?: number
    readonly omit?: (absoluteProgress: number) => boolean
}

interface CreateAuditOptions {
    readonly maximumGapMs?: number
    readonly invalidChannels?: ReadonlyMap<number, readonly LocallyAuditedSignalChannel[]>
}

function createCircularStint(options: CircularStintOptions = {}): NormalizedTelemetryFrame[] {
    const startProgress = options.startProgress ?? 0.8
    const endProgress = options.endProgress ?? 4.2
    const samplesPerLap = options.samplesPerLap ?? 240
    const sampleIntervalMs = options.sampleIntervalMs ?? 100
    const speedKmh = options.speedKmh ?? 120
    const sampleCount = Math.floor((endProgress - startProgress) * samplesPerLap) + 1
    const frames: NormalizedTelemetryFrame[] = []

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
        const absoluteProgress = startProgress + sampleIndex / samplesPerLap
        if (options.omit?.(absoluteProgress)) continue

        const normalizedTrackPosition = normalizePosition(absoluteProgress)

        frames.push(createFrame({
            sourceIndex: sampleIndex,
            timestampMs: sampleIndex * sampleIntervalMs,
            recordedLapNumber: Math.floor(absoluteProgress + 1e-9),
            normalizedTrackPosition,
            speedKmh,
        }))
    }

    return frames
}

function createExactEndpointStint(): NormalizedTelemetryFrame[] {
    const frames: NormalizedTelemetryFrame[] = []
    let sourceIndex = 0

    const appendFrame = (recordedLapNumber: number, normalizedTrackPosition: number): void => {
        frames.push(createFrame({
            sourceIndex,
            timestampMs: sourceIndex * 100,
            recordedLapNumber,
            normalizedTrackPosition,
        }))
        sourceIndex += 1
    }

    for (let step = 12; step <= 20; step += 1) appendFrame(0, step / 20)

    for (let lapNumber = 1; lapNumber <= 4; lapNumber += 1) {
        appendFrame(lapNumber, 0)
        for (let step = 1; step <= 20; step += 1) appendFrame(lapNumber, step / 20)
    }

    return frames
}

function createFrame(values: {
    readonly sourceIndex: number
    readonly timestampMs: number
    readonly recordedLapNumber: number
    readonly normalizedTrackPosition: number
    readonly speedKmh?: number
}): NormalizedTelemetryFrame {
    return new NormalizedTelemetryFrame({
        sourceIndex: values.sourceIndex,
        timestampMs: values.timestampMs,
        recordedLapNumber: values.recordedLapNumber,
        normalizedTrackPosition: values.normalizedTrackPosition,
        speedKmh: values.speedKmh ?? 120,
        throttleRatio: 0.8,
        brakeRatio: 0,
        steeringDegrees: 12 * Math.sin(2 * Math.PI * values.normalizedTrackPosition),
        gear: 4,
        engineRpm: 6_000,
        tyreCoreTemperatureC: {
            frontLeft: 90,
            frontRight: 91,
            rearLeft: 92,
            rearRight: 93,
        },
    })
}

function replacePosition(frame: NormalizedTelemetryFrame, normalizedTrackPosition: number): NormalizedTelemetryFrame {
    return new NormalizedTelemetryFrame({
        sourceIndex: frame.sourceIndex,
        timestampMs: frame.timestampMs,
        recordedLapNumber: frame.recordedLapNumber,
        normalizedTrackPosition,
        speedKmh: frame.speedKmh,
        throttleRatio: frame.throttleRatio,
        brakeRatio: frame.brakeRatio,
        steeringDegrees: frame.steeringDegrees,
        gear: frame.gear,
        engineRpm: frame.engineRpm,
        tyreCoreTemperatureC: frame.tyreCoreTemperatureC,
    })
}

function replaceRecordedLapNumber(frame: NormalizedTelemetryFrame, recordedLapNumber: number): NormalizedTelemetryFrame {
    return new NormalizedTelemetryFrame({
        sourceIndex: frame.sourceIndex,
        timestampMs: frame.timestampMs,
        recordedLapNumber,
        normalizedTrackPosition: frame.normalizedTrackPosition,
        speedKmh: frame.speedKmh,
        throttleRatio: frame.throttleRatio,
        brakeRatio: frame.brakeRatio,
        steeringDegrees: frame.steeringDegrees,
        gear: frame.gear,
        engineRpm: frame.engineRpm,
        tyreCoreTemperatureC: frame.tyreCoreTemperatureC,
    })
}

function replaceTimestamp(frame: NormalizedTelemetryFrame, timestampMs: number): NormalizedTelemetryFrame {
    return new NormalizedTelemetryFrame({
        sourceIndex: frame.sourceIndex,
        timestampMs,
        recordedLapNumber: frame.recordedLapNumber,
        normalizedTrackPosition: frame.normalizedTrackPosition,
        speedKmh: frame.speedKmh,
        throttleRatio: frame.throttleRatio,
        brakeRatio: frame.brakeRatio,
        steeringDegrees: frame.steeringDegrees,
        gear: frame.gear,
        engineRpm: frame.engineRpm,
        tyreCoreTemperatureC: frame.tyreCoreTemperatureC,
    })
}

function createAudit(frames: readonly NormalizedTelemetryFrame[], options: CreateAuditOptions = {}): TelemetryAuditResult {
    const maximumGapMs = options.maximumGapMs ?? 500
    const auditedFrames: AuditedFrame[] = frames.map((frame) => ({
        frame,
        suspectChannels: [],
        invalidChannels: options.invalidChannels?.get(frame.sourceIndex) ?? [],
    }))
    const frameTransitions = createFrameTransitions(frames)
    const timelineTransitions = createTimelineTransitions(frameTransitions)
    const auditedTransitions: AuditedTimelineTransition[] = timelineTransitions.map((transition) => ({
        ...transition,
        timeContinuity: transition.relation !== 'chronological'
            ? 'break'
            : transition.timestampDeltaMs > maximumGapMs
                ? 'gap'
                : 'continuous',
        discontinuousChannels: [],
    }))

    return {
        frameTransitions,
        timelineTransitions,
        samplingBaseline: {
            sampleCount: timelineTransitions.length,
            medianDeltaMs: 100,
            madDeltaMs: 0,
            scaledMadDeltaMs: 0,
            maximumGapMs,
        },
        isolatedOutliers: [],
        auditedFrames,
        usableTimeline: {
            frames: auditedFrames,
            excludedFrames: [],
            transitions: auditedTransitions,
        },
        continuousTimelineSegments: [],
        channelDiscontinuities: [],
        issues: [],
    }
}

function normalizePosition(absoluteProgress: number): number {
    const position = absoluteProgress - Math.floor(absoluteProgress)
    return position >= 1 - Number.EPSILON ? 0 : position
}

function expectConfidenceInUnitInterval(value: number): void {
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThanOrEqual(1)
}

describe('detectLaps', () => {
    test('detects complete moving laps and keeps opening and closing fragments separate', () => {
        const result = detectLaps(createAudit(createCircularStint()))

        expect(result.crossings).toHaveLength(4)
        expect(result.laps).toHaveLength(3)
        expect(result.includedRacingLaps).toHaveLength(3)
        expect(result.excludedLaps).toEqual([])
        expect(result.fragments.map(({ kind }) => kind)).toEqual(['opening', 'closing'])

        for (const lap of result.laps) {
            expect(lap.lapTimeMs).toBeGreaterThan(0)
            expect(lap.timingEligible).toBeTrue()
            expect(lap.realRacingLap).toBeTrue()
            expect(lap.cornerModelEligible).toBeTrue()
            expect(lap.positionComparisonEligible).toBeTrue()
            expect(lap.positionCoverage).toBeGreaterThanOrEqual(0.98)
            expect(lap.steeringCoverage).toBeGreaterThanOrEqual(0.98)

            for (const confidence of Object.values(lap.startCrossing.confidence)) {
                expectConfidenceInUnitInterval(confidence)
            }

            for (const confidence of Object.values(lap.finishCrossing.confidence)) {
                expectConfidenceInUnitInterval(confidence)
            }

            expectConfidenceInUnitInterval(lap.confidence.overall)
            expectConfidenceInUnitInterval(lap.confidence.timing)
            expectConfidenceInUnitInterval(lap.confidence.cornerModel)
        }
    })

    test('interpolates crossing time in unwrapped position space', () => {
        const frames = createCircularStint({
            startProgress: 0.803,
            endProgress: 2.2,
        })
        const result = detectLaps(createAudit(frames))
        const crossing = result.crossings[0]
        const previousFrame = frames.find(({ sourceIndex }) => sourceIndex === crossing.previousSourceIndex)
        const nextFrame = frames.find(({ sourceIndex }) => sourceIndex === crossing.nextSourceIndex)

        if (!previousFrame || !nextFrame) throw new Error('Crossing bracket frames must exist')

        const ratio = (1 - previousFrame.normalizedTrackPosition)
            / (nextFrame.normalizedTrackPosition + 1 - previousFrame.normalizedTrackPosition)
        const expectedTimestampMs = previousFrame.timestampMs
            + ratio * (nextFrame.timestampMs - previousFrame.timestampMs)

        expect(crossing.timestampMs).toBeCloseTo(expectedTimestampMs, 8)
        expect(crossing.timestampMs).toBeGreaterThan(previousFrame.timestampMs)
        expect(crossing.timestampMs).toBeLessThan(nextFrame.timestampMs)
        expect(crossing.timestampResolution.method).toBe('linear-interpolation')

        if (crossing.timestampResolution.method !== 'linear-interpolation') {
            throw new Error('Crossing timestamp must be interpolated')
        }

        expect(crossing.timestampResolution.interpolationRatio).toBeCloseTo(ratio, 8)
        expect(crossing.timestampResolution.previousSourceIndex).toBe(previousFrame.sourceIndex)
        expect(crossing.timestampResolution.nextSourceIndex).toBe(nextFrame.sourceIndex)
        expect(crossing.timestampResolution.bracketDurationMs).toBe(nextFrame.timestampMs - previousFrame.timestampMs)
        expect(crossing.confidence.timestamp).toBeLessThan(1)
    })

    test('uses the current frame timestamp when the current position is exactly zero', () => {
        const frames = createCircularStint()
        const result = detectLaps(createAudit(frames))
        const crossing = result.crossings[0]
        const currentFrame = frames.find(({ sourceIndex }) => sourceIndex === crossing.nextSourceIndex)

        if (!currentFrame) throw new Error('Current crossing frame must exist')

        expect(currentFrame.normalizedTrackPosition).toBe(0)
        expect(crossing.timestampResolution).toEqual({
            method: 'exact-current-frame',
            timestampMs: currentFrame.timestampMs,
            sourceIndex: currentFrame.sourceIndex,
        })
        expect(crossing.timestampMs).toBe(currentFrame.timestampMs)
        expect(crossing.confidence.timestamp).toBe(1)
    })

    test('reports both fragments when only one crossing is available', () => {
        const result = detectLaps(createAudit(createCircularStint({
            startProgress: 0.8,
            endProgress: 1.2,
        })))

        expect(result.crossings).toHaveLength(1)
        expect(result.laps).toEqual([])
        expect(result.fragments.map(({ kind }) => kind)).toEqual(['opening', 'closing'])
        expect(result.diagnostics.limitations).toContainEqual(expect.objectContaining({
            code: 'INSUFFICIENT_LAP_CROSSINGS',
        }))
    })

    test('accepts a position crossing when the recorder lap counter updates one frame late', () => {
        const frames = createCircularStint()
        const delayedCounterFrames = frames.map((frame, frameIndex) => {
            const previousFrame = frames[frameIndex - 1]
            const isFirstFrameAfterWrap = previousFrame !== undefined
                && frame.normalizedTrackPosition < previousFrame.normalizedTrackPosition

            return isFirstFrameAfterWrap
                ? replaceRecordedLapNumber(frame, previousFrame.recordedLapNumber)
                : frame
        })
        const result = detectLaps(createAudit(delayedCounterFrames))

        expect(result.crossings).toHaveLength(4)
        expect(result.crossings.every(({ hasLapCounterIncreasedByOne }) => !hasLapCounterIncreasedByOne)).toBeTrue()
        expect(result.crossings.every(({ counterEvidence }) => counterEvidence.agreement === 'nearby')).toBeTrue()
        expect(result.laps).toHaveLength(3)
        expect(result.laps.every(({ timingEligible }) => timingEligible)).toBeTrue()
    })

    test('detects an exact 1 to 0 endpoint crossing once at the position-1 timestamp', () => {
        const frames = createExactEndpointStint()
        const result = detectLaps(createAudit(frames))

        expect(result.crossings).toHaveLength(4)
        expect(result.laps).toHaveLength(3)

        for (const crossing of result.crossings) {
            const previousFrame = frames.find(({ sourceIndex }) => sourceIndex === crossing.previousSourceIndex)
            const nextFrame = frames.find(({ sourceIndex }) => sourceIndex === crossing.nextSourceIndex)

            if (!previousFrame || !nextFrame) throw new Error('Endpoint crossing bracket frames must exist')

            expect(previousFrame.normalizedTrackPosition).toBe(1)
            expect(nextFrame.normalizedTrackPosition).toBe(0)
            expect(crossing.timestampMs).toBe(previousFrame.timestampMs)
            expect(crossing.timestampResolution).toEqual({
                method: 'exact-previous-frame',
                timestampMs: previousFrame.timestampMs,
                sourceIndex: previousFrame.sourceIndex,
            })
            expect(crossing.confidence.timestamp).toBe(1)
            expect(crossing.evidence.circularPositionDelta).toBe(0)
        }
    })

    test('does not create a lap crossing from a counter change without a position wrap', () => {
        const frames = createCircularStint()
        const changedCounterFrames = [...frames]
        changedCounterFrames[168] = replaceRecordedLapNumber(
            changedCounterFrames[168],
            changedCounterFrames[168].recordedLapNumber + 1,
        )
        const result = detectLaps(createAudit(changedCounterFrames))

        expect(result.crossings).toHaveLength(4)
        expect(result.laps).toHaveLength(3)
    })

    test('reports missing counter agreement separately from perfect in-lap counter consistency', () => {
        const constantCounterFrames = createCircularStint().map((frame) => replaceRecordedLapNumber(frame, 7))
        const result = detectLaps(createAudit(constantCounterFrames))

        expect(result.crossings).toHaveLength(4)
        expect(result.crossings.every(({ counterEvidence }) => counterEvidence.agreement === 'missing')).toBeTrue()

        for (const crossing of result.crossings) {
            expect(crossing.confidence.timestamp).toBe(1)
            expect(crossing.confidence.boundary).toBeLessThan(crossing.confidence.timestamp)
            expect(crossing.confidence.overall).toBe(crossing.confidence.boundary)
        }

        for (const lap of result.laps) {
            expect(lap.confidence.counterAgreement).toBe(0.3)
            expect(lap.confidence.counterConsistency).toBe(1)
            expect(lap.confidence.limitations).toContainEqual(expect.objectContaining({
                code: 'LAP_COUNTER_MISSING_CHANGE',
            }))
        }
    })

    test('invalidates timing across a timestamp-order break', () => {
        const frames = createCircularStint()
        const brokenTimelineFrames = frames.map((frame) => frame.sourceIndex >= 168
            ? replaceTimestamp(frame, frame.timestampMs - 200)
            : frame)
        const result = detectLaps(createAudit(brokenTimelineFrames))

        expect(result.laps[0].timingEligible).toBeFalse()
        expect(result.laps[0].confidence.limitations).toContainEqual(expect.objectContaining({
            code: 'TIME_ORDER_BREAK',
        }))
        expect(result.laps.slice(1).every(({ timingEligible }) => timingEligible)).toBeTrue()
    })

    test('keeps timing but rejects racing-lap classification when a lap has too few source samples', () => {
        const sparseConfig: LapDetectionConfig = {
            ...DEFAULT_LAP_DETECTION_CONFIG,
            interpolation: {
                ...DEFAULT_LAP_DETECTION_CONFIG.interpolation,
                maximumAbsolutePositionSpan: 0.2,
            },
        }
        const result = detectLaps(createAudit(createCircularStint({
            startProgress: 0.6,
            endProgress: 4.4,
            samplesPerLap: 10,
        })), sparseConfig)

        expect(result.laps).toHaveLength(3)

        for (const lap of result.laps) {
            expect(lap.timingEligible).toBeTrue()
            expect(lap.realRacingLap).toBeFalse()
            expect(lap.cornerModelEligible).toBeFalse()
            expect(lap.confidence.limitations).toContainEqual(expect.objectContaining({
                code: 'INSUFFICIENT_SAMPLE_DENSITY',
                impact: 'racing-lap-classification',
            }))
        }
    })

    test('preserves crossing-to-crossing timing while masking a large sampling gap', () => {
        const frames = createCircularStint({
            omit: (progress) => progress > 1.44 && progress < 1.56,
        })
        const result = detectLaps(createAudit(frames))
        const affectedLap = result.laps.find(({ samplingGapCount }) => samplingGapCount > 0)

        expect(affectedLap).toBeDefined()
        expect(affectedLap?.timingEligible).toBeTrue()
        expect(affectedLap?.realRacingLap).toBeFalse()
        expect(affectedLap?.cornerModelEligible).toBeFalse()
        expect(affectedLap?.positionComparisonEligible).toBeFalse()
        expect(affectedLap?.maximumUnsupportedPositionSpan).toBeGreaterThan(0.05)
        expect(affectedLap?.confidence.cornerModel).toBeLessThan(affectedLap?.confidence.timing ?? 0)
        expect(affectedLap?.confidence.positionContinuity).toBe(0)
        expect(affectedLap?.confidence.limitations).toContainEqual(expect.objectContaining({
            code: 'SAMPLING_GAP',
            severity: 'warning',
        }))
    })

    test('does not classify a position-moving but stationary-speed candidate as a racing lap', () => {
        const result = detectLaps(createAudit(createCircularStint({ speedKmh: 0 })))

        expect(result.laps).toHaveLength(3)
        expect(result.includedRacingLaps).toEqual([])
        expect(result.excludedLaps).toHaveLength(3)

        for (const lap of result.excludedLaps) {
            expect(lap.timingEligible).toBeTrue()
            expect(lap.realRacingLap).toBeFalse()
            expect(lap.confidence.limitations).toContainEqual(expect.objectContaining({
                code: 'STATIONARY_LAP',
            }))
        }
    })

    test('does not classify a walking-speed service lap as a racing lap', () => {
        const result = detectLaps(createAudit(createCircularStint({ speedKmh: 2 })))

        expect(result.laps).toHaveLength(3)
        expect(result.includedRacingLaps).toEqual([])

        for (const lap of result.excludedLaps) {
            expect(lap.timingEligible).toBeTrue()
            expect(lap.realRacingLap).toBeFalse()
            expect(lap.confidence.limitations).toContainEqual(expect.objectContaining({
                code: 'STATIONARY_LAP',
            }))
        }
    })

    test('rejects an isolated false wrap and does not silently time through it', () => {
        const frames = createCircularStint()
        const corruptedFrames = [...frames]
        corruptedFrames[168] = replacePosition(corruptedFrames[168], 0.995)
        corruptedFrames[169] = replacePosition(corruptedFrames[169], 0.005)

        const result = detectLaps(createAudit(corruptedFrames))

        expect(result.crossings).toHaveLength(4)
        expect(result.laps[0].timingEligible).toBeFalse()
        expect(result.laps[0].confidence.limitations).toContainEqual(expect.objectContaining({
            code: 'UNEXPECTED_POSITION_WRAP',
        }))
        expect(result.laps.slice(1).every(({ timingEligible }) => timingEligible)).toBeTrue()
    })

    test('uses the filtered second-pass rate calibration when enough clean samples remain', () => {
        const positions: number[] = [0]
        let currentPosition = 0

        for (let index = 1; index <= 25; index += 1) {
            currentPosition += index === 12 ? 0.2 : 0.01
            positions.push(currentPosition)
        }

        const frames = positions.map((position, sourceIndex) => createFrame({
            sourceIndex,
            timestampMs: sourceIndex * 100,
            recordedLapNumber: 1,
            normalizedTrackPosition: position,
        }))
        const audit = createAudit(frames)
        const timeline = audit.usableTimeline

        if (!timeline) throw new Error('Synthetic audit must provide a usable timeline')

        const config: LapDetectionConfig = {
            ...DEFAULT_LAP_DETECTION_CONFIG,
            calibration: {
                ...DEFAULT_LAP_DETECTION_CONFIG.calibration,
                minimumSamples: 10,
            },
        }
        const frameIndex = new Map(timeline.frames.map((frame) => [frame.frame.sourceIndex, frame]))
        const calibration = derivePositionCalibration(timeline, frameIndex, config)

        expect(calibration).not.toBeNull()
        expect(calibration?.medianPositionRatePerSecond).toBeCloseTo(0.1, 8)
        expect(calibration?.globalPositionRateLimitPerSecond).toBeCloseTo(0.1, 8)
    })

    test('rejects a localized steering hole even when total steering coverage exceeds the minimum', () => {
        const frames = createCircularStint()
        const invalidChannels = new Map<number, readonly LocallyAuditedSignalChannel[]>()

        for (const frame of frames) {
            const isSteeringHole = frame.recordedLapNumber === 2
                && frame.normalizedTrackPosition > 0.3
                && frame.normalizedTrackPosition < 0.38

            if (isSteeringHole) invalidChannels.set(frame.sourceIndex, ['steeringDegrees'])
        }

        const result = detectLaps(createAudit(frames, { invalidChannels }))
        const affectedLap = result.laps.find(({ recordedLapNumber }) => recordedLapNumber === 2)

        expect(affectedLap).toBeDefined()
        expect(affectedLap?.steeringCoverage).toBeGreaterThanOrEqual(
            DEFAULT_LAP_DETECTION_CONFIG.eligibility.minimumCornerSteeringCoverage,
        )
        expect(affectedLap?.maximumUnsupportedSteeringSpan).toBeGreaterThan(
            DEFAULT_LAP_DETECTION_CONFIG.eligibility.maximumCornerUnsupportedSpan,
        )
        expect(affectedLap?.cornerModelEligible).toBeFalse()
        expect(affectedLap?.confidence.limitations).toContainEqual(expect.objectContaining({
            code: 'UNSUPPORTED_STEERING_SPAN',
        }))
    })

    test('returns an explicit limitation when position calibration has insufficient support', () => {
        const frames = createCircularStint({
            startProgress: 0.8,
            endProgress: 0.85,
        })
        const result = detectLaps(createAudit(frames))

        expect(result.laps).toEqual([])
        expect(result.fragments).toEqual([
            expect.objectContaining({
                kind: 'whole-timeline',
                frameCount: frames.length,
            }),
        ])
        expect(result.diagnostics.limitations).toEqual([
            expect.objectContaining({
                code: 'INSUFFICIENT_POSITION_BASELINE',
                severity: 'error',
            }),
        ])
    })
})
