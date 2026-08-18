import type { TelemetryAuditResult } from '../frame-audit-types'
import { DEFAULT_LAP_DETECTION_CONFIG } from './config/lap-detection-config'
import { createDetectedLaps } from './create-detected-laps'
import { createDetectedLapFragments } from './create-detected-lap-fragments'
import { deriveLinearLapGrid } from './derive-linear-lap-grid'
import { evaluateLapEligibility } from './evaluate-lap-eligibility'
import { indexAuditedFrames } from './index-audited-frames'
import { selectValidLapCrossings } from './lap-crossing-selection'
import type { LapDetectionConfig, LapDetectionResult } from './lap-detect-types'
import { findLapCrossings } from './lap-crossings'
import { linearizeLap } from './linearize-lap'
import { derivePositionCalibration } from './position-support'

export function detectLaps(audit: TelemetryAuditResult, config: LapDetectionConfig = DEFAULT_LAP_DETECTION_CONFIG): LapDetectionResult {
    const timeline = audit.usableTimeline
    const sampling = audit.samplingBaseline

    if (!timeline || !sampling) {
        return { positionCalibration: null, linearGrid: null, lapCrossings: [], laps: [], lapFragments: [], linearizedLaps: [], lapGridCoverages: [], lapEligibilityResults: [] }
    }

    const auditedFrameBySourceIndex = indexAuditedFrames(timeline)
    const calibration = derivePositionCalibration(timeline, auditedFrameBySourceIndex, config)
    if (calibration === null) {
        return { positionCalibration: null, linearGrid: null, lapCrossings: [], laps: [], lapFragments: [], linearizedLaps: [], lapGridCoverages: [], lapEligibilityResults: [] }
    }

    const detectedLapCrossings = findLapCrossings(timeline, sampling, calibration, auditedFrameBySourceIndex, config)
    const lapCrossings = selectValidLapCrossings(timeline, detectedLapCrossings, calibration)
    const laps = createDetectedLaps(timeline, lapCrossings)
    const lapFragments = createDetectedLapFragments(timeline, lapCrossings)
    const linearGrid = deriveLinearLapGrid(timeline, laps)
    const linearizedLaps = linearGrid === null
        ? []
        : laps.map((lap) => linearizeLap(timeline, lap, linearGrid, calibration, auditedFrameBySourceIndex))
    const lapAssessments = linearizedLaps.map((linearizedLap, lapIndex) => {
        const lap = laps[lapIndex]
        const eligibility = evaluateLapEligibility(lap, config.eligibility)

        return { lapNumber: lap.lapNumber, coverage: linearizedLap.coverage, eligibility }
    })
    const lapGridCoverages = lapAssessments.map(({ lapNumber, coverage }) => ({ lapNumber, coverage }))
    const lapEligibilityResults = lapAssessments.map(({ lapNumber, eligibility }) => ({ lapNumber, eligibility }))

    return { positionCalibration: calibration, linearGrid, lapCrossings, laps, lapFragments, linearizedLaps, lapGridCoverages, lapEligibilityResults }
}
