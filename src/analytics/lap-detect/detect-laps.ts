import type { TelemetryAuditResult } from '../frame-audit-types'
import { DEFAULT_LAP_DETECTION_CONFIG } from './config/lap-detection-config'
import { indexAuditedFrames } from './index-audited-frames'
import { createLapCandidates, createLapFragments } from './lap-candidates'
import { detectLapCrossings } from './lap-crossings'
import type { LapDetectionConfig, LapDetectionResult, LapLimitation } from './lap-detect-types'
import { deriveLinearGrid } from './linear-grid'
import { evaluateLapCandidate } from './lap-quality'
import { derivePositionCalibration } from './position-support'

export function detectLaps(audit: TelemetryAuditResult, config: LapDetectionConfig = DEFAULT_LAP_DETECTION_CONFIG): LapDetectionResult {
    const timeline = audit.usableTimeline
    const sampling = audit.samplingBaseline

    if (!timeline || !sampling) {
        return createEmptyLapDetectionResult({
            code: 'INSUFFICIENT_POSITION_BASELINE',
            severity: 'error',
            impact: 'all-analysis',
            message: 'The dataset does not contain a usable audited timeline',
        })
    }

    const auditedFrameBySourceIndex = indexAuditedFrames(timeline)
    const calibration = derivePositionCalibration(timeline, auditedFrameBySourceIndex, config)

    if (!calibration) {
        return createEmptyLapDetectionResult({
            code: 'INSUFFICIENT_POSITION_BASELINE',
            severity: 'error',
            impact: 'all-analysis',
            message: 'A defensible position baseline could not be derived',
        }, createLapFragments(timeline, []))
    }

    const internalCrossings = detectLapCrossings(
        timeline,
        sampling,
        calibration,
        auditedFrameBySourceIndex,
        config,
    )
    const candidates = createLapCandidates(timeline, internalCrossings)
    const grid = deriveLinearGrid(candidates, calibration, config)
    const evaluatedLaps = candidates.map((candidate) => evaluateLapCandidate({
        candidate,
        grid,
        calibration,
        auditedFrameBySourceIndex,
        config,
    }))
    const laps = evaluatedLaps.map(({ lap }) => lap)

    const limitations: LapLimitation[] = internalCrossings.length >= 2 ? [] : [{
        code: 'INSUFFICIENT_LAP_CROSSINGS',
        severity: 'error',
        impact: 'all-analysis',
        message: `At least two supported start/finish crossings are required; detected ${internalCrossings.length}`,
    }]

    return {
        linearGrid: grid,
        lapGridSupport: evaluatedLaps.map(({ gridSupport }) => gridSupport),
        crossings: internalCrossings.map(({ crossing }) => crossing),
        laps,
        includedRacingLaps: laps.filter((lap) => lap.realRacingLap),
        excludedLaps: laps.filter((lap) => !lap.realRacingLap),
        fragments: createLapFragments(timeline, internalCrossings),
        diagnostics: {
            gridSize: grid.cellCount,
            gridPositionStep: grid.normalizedPositionCellWidth,
            medianPositionStep: calibration.medianPositionStep,
            maximumInterpolationSpan: calibration.maximumInterpolationSpan,
            medianPositionRatePerSecond: calibration.medianPositionRatePerSecond,
            globalPositionRateLimitPerSecond: calibration.globalPositionRateLimitPerSecond,
            medianUsablePositionSamplesPerLap: grid.referenceUsablePositionSampleCountPerLap,
            requiredPositionSamplesPerLap: grid.requiredUsablePositionSampleCountPerLap,
            limitations,
        },
    }
}

function createEmptyLapDetectionResult(limitation: LapLimitation, fragments: LapDetectionResult['fragments'] = []): LapDetectionResult {
    return {
        linearGrid: null,
        lapGridSupport: [],
        crossings: [],
        laps: [],
        includedRacingLaps: [],
        excludedLaps: [],
        fragments,
        diagnostics: {
            gridSize: 0,
            gridPositionStep: 0,
            medianPositionStep: null,
            maximumInterpolationSpan: null,
            medianPositionRatePerSecond: null,
            globalPositionRateLimitPerSecond: null,
            medianUsablePositionSamplesPerLap: null,
            requiredPositionSamplesPerLap: null,
            limitations: [limitation],
        },
    }
}
