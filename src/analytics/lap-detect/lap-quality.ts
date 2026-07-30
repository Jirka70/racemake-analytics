import type { AuditedFrame, AuditedTimelineTransition } from '../frame-audit-types'
import type {
    CoverageResult,
    DetectedLap,
    LapCandidate,
    LapConfidence,
    LapDetectionConfig,
    LapGridSupport,
    LapLimitation,
    LinearGrid,
    MotionResult,
    PositionCalibration,
    RecordedLapMode,
} from './lap-detect-types'
import { calculateChannelCoverage } from './linear-grid'
import {
    isPositionFrameUsable,
    looksLikeForwardPositionWrap,
    POSITION_CHANNEL,
    SPEED_CHANNEL,
    STEERING_CHANNEL,
} from './position-support'
import { isChannelUsable } from './util/usable-channels'

interface EvaluateLapCandidateArguments {
    readonly candidate: LapCandidate
    readonly grid: LinearGrid
    readonly calibration: PositionCalibration
    readonly auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>
    readonly config: LapDetectionConfig
}

interface CalculateLapConfidenceArguments {
    readonly candidate: LapCandidate
    readonly positionCoverage: number
    readonly steeringCoverage: number
    readonly positionContinuity: number
    readonly steeringContinuity: number
    readonly sampleDensity: number
    readonly motionEvidence: number
    readonly counterAgreement: number
    readonly counterConsistency: number
    readonly timingEligible: boolean
    readonly realRacingLap: boolean
    readonly cornerModelEligible: boolean
    readonly limitations: readonly LapLimitation[]
}

export interface EvaluatedLapCandidate {
    readonly lap: DetectedLap
    readonly gridSupport: LapGridSupport
}

export function evaluateLapCandidate(args: EvaluateLapCandidateArguments): EvaluatedLapCandidate {
    const { candidate, grid, calibration, auditedFrameBySourceIndex, config } = args

    const positionCoverage = calculateChannelCoverage({
        candidate,
        linearGridCellCount: grid.cellCount,
        channel: POSITION_CHANNEL,
        maximumInterpolationSpan: calibration.maximumInterpolationSpan,
        auditedFrameBySourceIndex,
    })

    const steeringCoverage = calculateChannelCoverage({
        candidate,
        linearGridCellCount: grid.cellCount,
        channel: STEERING_CHANNEL,
        maximumInterpolationSpan: calibration.maximumInterpolationSpan,
        auditedFrameBySourceIndex,
    })
    const cornerDetectionSupportedCellMask = positionCoverage.supportedCellMask.map(
        (positionSupported, cellIndex) => positionSupported && steeringCoverage.supportedCellMask[cellIndex],
    )

    const lapTimeMs = candidate.finishCrossing.crossing.timestampMs - candidate.startCrossing.crossing.timestampMs
    const usablePositionSampleCount = candidate.frames.filter(isPositionFrameUsable).length
    const recordedLap = calculateRecordedLapMode(candidate.frames)
    const motion = calculateMotionQuality(candidate.transitions, auditedFrameBySourceIndex, config.motion.stationarySpeedKmh)
    const samplingGaps = candidate.transitions.filter((transition) => transition.timeContinuity === 'gap')
    const hasTimeOrderBreak = candidate.transitions.some((transition) => transition.timeContinuity === 'break')
    const hasUnexpectedPositionWrap = candidate.transitions
        .slice(0, -1)
        .some(looksLikeForwardPositionWrap)

    const largestSamplingGapMs = samplingGaps.length > 0
        ? Math.max(...samplingGaps.map((transition) => transition.timestampDeltaMs))
        : 0

    const speedEvidenceFraction = lapTimeMs > 0 ? clamp01(motion.observedDurationMs / lapTimeMs) : 0
    const hasSufficientSpeedEvidence = speedEvidenceFraction >= config.motion.minimumSpeedEvidenceFraction
    const hasSufficientPositionDensity = usablePositionSampleCount >= grid.requiredUsablePositionSampleCountPerLap
    const hasSufficientRacingPositionCoverage = positionCoverage.coverage
        >= config.eligibility.minimumRacingPositionCoverage
    const hasSufficientRacingPositionContinuity = positionCoverage.maximumUnsupportedSpan
        <= config.eligibility.maximumRacingUnsupportedPositionSpan
    const maximumStationaryDurationMs = lapTimeMs * config.motion.maximumStationaryFraction
    const stationary = hasSufficientSpeedEvidence && (
        motion.movingFraction < config.motion.minimumMovingFraction
        || motion.longestStationaryDurationMs > maximumStationaryDurationMs
    )

    const timingEligible = lapTimeMs > 0
        && !hasTimeOrderBreak
        && !hasUnexpectedPositionWrap
        && candidate.startCrossing.crossing.confidence.overall >= config.crossing.minimumConfidence
        && candidate.finishCrossing.crossing.confidence.overall >= config.crossing.minimumConfidence

    const realRacingLap = timingEligible
        && hasSufficientSpeedEvidence
        && hasSufficientPositionDensity
        && hasSufficientRacingPositionCoverage
        && hasSufficientRacingPositionContinuity
        && !stationary
    const cornerModelEligible = realRacingLap
        && cornerDetectionSupportedCellMask.every(Boolean)

    const positionComparisonEligible = realRacingLap
        && positionCoverage.coverage >= config.eligibility.minimumComparisonCoverage
        && positionCoverage.maximumUnsupportedSpan <= config.eligibility.maximumComparisonUnsupportedSpan

    const limitations = createLapLimitations({
        candidate,
        grid,
        positionCoverage,
        steeringCoverage,
        usablePositionSampleCount,
        samplingGapCount: samplingGaps.length,
        hasTimeOrderBreak,
        hasUnexpectedPositionWrap,
        hasSufficientSpeedEvidence,
        hasSufficientPositionDensity,
        hasSufficientRacingPositionCoverage,
        hasSufficientRacingPositionContinuity,
        realRacingLap,
        cornerDetectionSupportedCellCount: cornerDetectionSupportedCellMask.filter(Boolean).length,
        stationary,
        recordedLap,
        config,
    })

    const motionEvidence = Math.min(speedEvidenceFraction, motion.movingFraction)
    const confidence = calculateLapConfidence({
        candidate,
        positionCoverage: positionCoverage.coverage,
        steeringCoverage: steeringCoverage.coverage,
        positionContinuity: calculateContinuityConfidence(
            positionCoverage.maximumUnsupportedSpan,
            config.eligibility.maximumCornerUnsupportedSpan,
        ),
        steeringContinuity: calculateContinuityConfidence(
            steeringCoverage.maximumUnsupportedSpan,
            config.eligibility.maximumCornerUnsupportedSpan,
        ),
        sampleDensity: clamp01(usablePositionSampleCount / grid.requiredUsablePositionSampleCountPerLap),
        motionEvidence,
        counterAgreement: Math.min(
            candidate.startCrossing.crossing.counterEvidence.score,
            candidate.finishCrossing.crossing.counterEvidence.score,
        ),
        counterConsistency: recordedLap.supportFraction,
        timingEligible,
        realRacingLap,
        cornerModelEligible,
        limitations,
    })

    const lapId = `lap-${candidate.sequenceNumber}`

    return {
        lap: {
            id: lapId,
            sequenceNumber: candidate.sequenceNumber,
            recordedLapNumber: recordedLap.value,
            startCrossing: candidate.startCrossing.crossing,
            finishCrossing: candidate.finishCrossing.crossing,
            startTimestampMs: candidate.startCrossing.crossing.timestampMs,
            finishTimestampMs: candidate.finishCrossing.crossing.timestampMs,
            lapTimeMs,
            startSourceIndex: candidate.frames[0]?.frame.sourceIndex ?? candidate.startCrossing.crossing.nextSourceIndex,
            endSourceIndex: candidate.frames.at(-1)?.frame.sourceIndex ?? candidate.finishCrossing.crossing.previousSourceIndex,
            frameCount: candidate.frames.length,
            positionCoverage: positionCoverage.coverage,
            steeringCoverage: steeringCoverage.coverage,
            maximumUnsupportedPositionSpan: positionCoverage.maximumUnsupportedSpan,
            maximumUnsupportedSteeringSpan: steeringCoverage.maximumUnsupportedSpan,
            usablePositionSampleCount,
            requiredPositionSampleCount: grid.requiredUsablePositionSampleCountPerLap,
            samplingGapCount: samplingGaps.length,
            largestSamplingGapMs,
            speedEvidenceFraction,
            movingFraction: motion.movingFraction,
            longestStationaryDurationMs: motion.longestStationaryDurationMs,
            timingEligible,
            realRacingLap,
            cornerModelEligible,
            positionComparisonEligible,
            confidence,
        },
        gridSupport: {
            lapId,
            positionSupportedCellMask: positionCoverage.supportedCellMask,
            steeringSupportedCellMask: steeringCoverage.supportedCellMask,
            cornerDetectionSupportedCellMask,
        },
    }
}

interface CreateLapLimitationsArguments {
    readonly candidate: LapCandidate
    readonly grid: LinearGrid
    readonly positionCoverage: CoverageResult
    readonly steeringCoverage: CoverageResult
    readonly usablePositionSampleCount: number
    readonly samplingGapCount: number
    readonly hasTimeOrderBreak: boolean
    readonly hasUnexpectedPositionWrap: boolean
    readonly hasSufficientSpeedEvidence: boolean
    readonly hasSufficientPositionDensity: boolean
    readonly hasSufficientRacingPositionCoverage: boolean
    readonly hasSufficientRacingPositionContinuity: boolean
    readonly realRacingLap: boolean
    readonly cornerDetectionSupportedCellCount: number
    readonly stationary: boolean
    readonly recordedLap: RecordedLapMode
    readonly config: LapDetectionConfig
}

function createLapLimitations(args: CreateLapLimitationsArguments): LapLimitation[] {
    const limitations: LapLimitation[] = [
        ...args.candidate.startCrossing.crossing.limitations,
        ...args.candidate.finishCrossing.crossing.limitations,
    ]

    if (args.hasTimeOrderBreak) {
        limitations.push({
            code: 'TIME_ORDER_BREAK',
            severity: 'error',
            impact: 'timing',
            message: 'The lap crosses a timestamp ordering break',
        })
    }

    if (args.hasUnexpectedPositionWrap) {
        limitations.push({
            code: 'UNEXPECTED_POSITION_WRAP',
            severity: 'error',
            impact: 'all-analysis',
            message: 'The candidate contains another position wrap that was not accepted as a lap crossing',
        })
    }

    if (args.samplingGapCount > 0) {
        limitations.push({
            code: 'SAMPLING_GAP',
            severity: 'warning',
            impact: 'corner-detection',
            message: `The lap contains ${args.samplingGapCount} sampling gap(s); unsupported position regions remain masked`,
        })
    }

    if (!args.hasSufficientPositionDensity) {
        limitations.push({
            code: 'INSUFFICIENT_SAMPLE_DENSITY',
            severity: 'error',
            impact: 'racing-lap-classification',
            message: `The lap contains ${args.usablePositionSampleCount} usable position samples; ${args.grid.requiredUsablePositionSampleCountPerLap} are required`,
        })
    }

    const hasInsufficientPositionCoverage = !args.hasSufficientRacingPositionCoverage
        || args.positionCoverage.coverage < args.config.eligibility.minimumCornerPositionCoverage

    if (hasInsufficientPositionCoverage) {
        limitations.push({
            code: 'INSUFFICIENT_POSITION_COVERAGE',
            severity: 'error',
            impact: args.hasSufficientRacingPositionCoverage
                ? 'corner-detection'
                : 'racing-lap-classification',
            message: `Position coverage is ${round(args.positionCoverage.coverage * 100, 1)}%`,
        })
    }

    if (args.steeringCoverage.coverage < args.config.eligibility.minimumCornerSteeringCoverage) {
        limitations.push({
            code: 'INSUFFICIENT_STEERING_COVERAGE',
            severity: 'error',
            impact: 'corner-detection',
            message: `Steering coverage is ${round(args.steeringCoverage.coverage * 100, 1)}%`,
        })
    }

    const hasUnsupportedPositionSpan = !args.hasSufficientRacingPositionContinuity
        || args.positionCoverage.maximumUnsupportedSpan > args.config.eligibility.maximumCornerUnsupportedSpan

    if (hasUnsupportedPositionSpan) {
        limitations.push({
            code: 'UNSUPPORTED_POSITION_SPAN',
            severity: 'error',
            impact: args.hasSufficientRacingPositionContinuity
                ? 'corner-detection'
                : 'racing-lap-classification',
            message: `Largest unsupported position span is ${round(args.positionCoverage.maximumUnsupportedSpan * 100, 1)}% of the lap`,
        })
    }

    if (args.steeringCoverage.maximumUnsupportedSpan > args.config.eligibility.maximumCornerUnsupportedSpan) {
        limitations.push({
            code: 'UNSUPPORTED_STEERING_SPAN',
            severity: 'error',
            impact: 'corner-detection',
            message: `Largest unsupported steering span is ${round(args.steeringCoverage.maximumUnsupportedSpan * 100, 1)}% of the lap`,
        })
    }

    if (args.realRacingLap && args.cornerDetectionSupportedCellCount < args.grid.cellCount) {
        limitations.push({
            code: 'PARTIAL_CORNER_GRID_SUPPORT',
            severity: 'warning',
            impact: 'corner-detection',
            message: `Corner detection can use ${args.cornerDetectionSupportedCellCount} of ${args.grid.cellCount} grid cells from this racing lap; unsupported cells remain masked`,
        })
    }

    if (args.recordedLap.supportFraction < 0.95) {
        limitations.push({
            code: 'LAP_COUNTER_INCONSISTENT',
            severity: 'warning',
            impact: 'timing',
            message: `The dominant recorder lap number has support from only ${round(args.recordedLap.supportFraction * 100, 1)}% of the lap`,
        })
    }

    if (!args.hasSufficientSpeedEvidence) {
        limitations.push({
            code: 'INSUFFICIENT_SPEED_EVIDENCE',
            severity: 'error',
            impact: 'all-analysis',
            message: 'The lap does not contain enough valid speed data to prove racing movement',
        })
    }

    if (args.stationary) {
        limitations.push({
            code: 'STATIONARY_LAP',
            severity: 'error',
            impact: 'all-analysis',
            message: 'The candidate contains too much stationary or near-stationary time to be classified as a racing lap',
        })
    }

    return deduplicateLimitations(limitations)
}

function calculateMotionQuality(transitions: readonly AuditedTimelineTransition[], auditedFrameBySourceIndex: ReadonlyMap<number, AuditedFrame>, stationarySpeedKmh: number): MotionResult {
    let observedDurationMs = 0
    let movingDurationMs = 0
    let currentStationaryDurationMs = 0
    let longestStationaryDurationMs = 0

    for (const transition of transitions) {
        if (transition.timeContinuity !== 'continuous') {
            currentStationaryDurationMs = 0
            continue
        }

        const previous = auditedFrameBySourceIndex.get(transition.previous.sourceIndex)
        const current = auditedFrameBySourceIndex.get(transition.current.sourceIndex)

        const speedIsUsable = previous !== undefined
            && current !== undefined
            && isChannelUsable(previous, SPEED_CHANNEL)
            && isChannelUsable(current, SPEED_CHANNEL)
            && !transition.discontinuousChannels.includes(SPEED_CHANNEL)

        if (!speedIsUsable) {
            currentStationaryDurationMs = 0
            continue
        }

        observedDurationMs += transition.timestampDeltaMs
        const averageSpeedKmh = (transition.previous.speedKmh + transition.current.speedKmh) / 2

        if (averageSpeedKmh > stationarySpeedKmh) {
            movingDurationMs += transition.timestampDeltaMs
            currentStationaryDurationMs = 0
        } else {
            currentStationaryDurationMs += transition.timestampDeltaMs
            longestStationaryDurationMs = Math.max(longestStationaryDurationMs, currentStationaryDurationMs)
        }
    }

    return {
        observedDurationMs,
        movingFraction: observedDurationMs > 0 ? movingDurationMs / observedDurationMs : 0,
        longestStationaryDurationMs,
    }
}

function calculateRecordedLapMode(frames: readonly AuditedFrame[]): RecordedLapMode {
    if (frames.length === 0) return { value: null, supportFraction: 0 }

    const counts = new Map<number, number>()

    for (const { frame } of frames) {
        counts.set(frame.recordedLapNumber, (counts.get(frame.recordedLapNumber) ?? 0) + 1)
    }

    const orderedCounts = [...counts.entries()].sort(
        ([leftLap, leftCount], [rightLap, rightCount]) => rightCount - leftCount || leftLap - rightLap,
    )
    const [value, count] = orderedCounts[0]

    return {
        value,
        supportFraction: count / frames.length,
    }
}

function calculateLapConfidence(args: CalculateLapConfidenceArguments): LapConfidence {
    const startCrossing = args.candidate.startCrossing.crossing.confidence.overall
    const finishCrossing = args.candidate.finishCrossing.crossing.confidence.overall
    const weakestCrossing = Math.min(startCrossing, finishCrossing)
    const continuityEvidence = args.timingEligible ? 1 : 0

    let timing = clamp01(round(
        0.6 * weakestCrossing
            + 0.15 * args.counterAgreement
            + 0.1 * args.counterConsistency
            + 0.15 * continuityEvidence,
        3,
    ))

    if (!args.timingEligible) timing = Math.min(timing, 0.4)

    let overall = clamp01(round(0.6 * timing + 0.4 * args.motionEvidence, 3))
    if (!args.realRacingLap) overall = Math.min(overall, 0.49)

    let cornerModel = clamp01(round(
        0.2 * timing
            + 0.2 * args.positionCoverage
            + 0.15 * args.steeringCoverage
            + 0.15 * args.positionContinuity
            + 0.15 * args.steeringContinuity
            + 0.15 * args.sampleDensity,
        3,
    ))

    if (!args.cornerModelEligible) cornerModel = Math.min(cornerModel, 0.49)

    return {
        overall,
        timing,
        cornerModel,
        startCrossing,
        finishCrossing,
        positionCoverage: args.positionCoverage,
        steeringCoverage: args.steeringCoverage,
        positionContinuity: args.positionContinuity,
        steeringContinuity: args.steeringContinuity,
        sampleDensity: args.sampleDensity,
        motionEvidence: args.motionEvidence,
        counterAgreement: args.counterAgreement,
        counterConsistency: args.counterConsistency,
        limitations: args.limitations,
    }
}

function deduplicateLimitations(limitations: readonly LapLimitation[]): LapLimitation[] {
    const seen = new Set<string>()

    return limitations.filter((limitation) => {
        const key = `${limitation.code}:${limitation.message}`
        if (seen.has(key)) return false

        seen.add(key)
        return true
    })
}

function calculateContinuityConfidence(maximumUnsupportedSpan: number, maximumEligibleSpan: number): number {
    if (maximumEligibleSpan <= 0) return maximumUnsupportedSpan === 0 ? 1 : 0
    return clamp01(1 - maximumUnsupportedSpan / maximumEligibleSpan)
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value))
}

function round(value: number, decimalPlaces: number): number {
    const factor = 10 ** decimalPlaces
    return Math.round(value * factor) / factor
}
