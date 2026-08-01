import type { TelemetryAuditResult } from '../frame-audit-types'
import { DEFAULT_LAP_DETECTION_CONFIG } from './config/lap-detection-config'
import { indexAuditedFrames } from './index-audited-frames'
import { findLapCrossingCandidates } from './lap-crossing-candidates'
import type { LapDetectionConfig, LapDetectionResult } from './lap-detect-types'
import { derivePositionCalibration } from './position-support'

export function detectLaps(audit: TelemetryAuditResult, config: LapDetectionConfig = DEFAULT_LAP_DETECTION_CONFIG): LapDetectionResult {
    const timeline = audit.usableTimeline
    const sampling = audit.samplingBaseline

    if (!timeline || !sampling) {
        return { positionCalibration: null, lapCrossingCandidates: [] }
    }

    const auditedFrameBySourceIndex = indexAuditedFrames(timeline)
    const calibration = derivePositionCalibration(timeline, auditedFrameBySourceIndex, config)
    const lapCrossingCandidates = findLapCrossingCandidates(timeline, auditedFrameBySourceIndex, config.crossing.lapCounterSearchRadiusFrames)

    return { positionCalibration: calibration, lapCrossingCandidates }
}
