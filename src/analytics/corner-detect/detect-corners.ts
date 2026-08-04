import type { TelemetryAuditResult } from '../frame-audit-types'
import type { LapDetectionResult } from '../lap-detect/lap-detect-types'
import type { OtsuResult } from '../otsu'
import { calculateSteeringStrengthOtsu } from './calculate-steering-strength-otsu'
import { confirmCornerCandidates, type ConfirmedCornerCandidate } from './confirm-corner-candidates'
import { createCellAlignedSteering, type CellAlignedSteering } from './create-cell-aligned-steering'
import { createSteeringStrengthProfile, type SteeringStrengthProfile } from './create-steering-strength-profile'
import { createTrackSteeringProfile, type TrackSteeringProfile } from './create-track-steering-profile'
import { deriveSteeringStrengthThresholds, type SteeringStrengthThresholdResult } from './derive-steering-strength-thresholds'
import { findCornerCandidates, type CornerCandidate } from './find-corner-candidates'
import { smoothTrackSteeringProfile, type SmoothedTrackSteeringProfile } from './smooth-track-steering-profile'

const SAVITZKY_GOLAY_POLYNOMIAL_ORDER = 2
const SAVITZKY_GOLAY_WINDOW_SIZE = 5
const MINIMUM_CORNER_CANDIDATE_CONFIDENCE = 0.5

export interface CornerDetectionResult {
    readonly cellAlignedSteering: CellAlignedSteering
    readonly trackSteeringProfile: TrackSteeringProfile
    readonly smoothedTrackSteeringProfile: SmoothedTrackSteeringProfile
    readonly steeringStrengthProfile: SteeringStrengthProfile
    readonly steeringStrengthOtsuResult: OtsuResult
    readonly steeringStrengthThresholdResult: SteeringStrengthThresholdResult
    readonly cornerCandidates: readonly CornerCandidate[]
    readonly confirmedCornerCandidates: readonly ConfirmedCornerCandidate[]
}

export function detectCorners(audit: TelemetryAuditResult, lapDetection: LapDetectionResult): CornerDetectionResult {
    const cellAlignedSteering = createCellAlignedSteering(audit, lapDetection)
    const trackSteeringProfile = createTrackSteeringProfile(cellAlignedSteering, lapDetection.laps)
    const minimumLapSupport = Math.max(2, Math.ceil(trackSteeringProfile.selectedLaps.length / 2))
    const smoothedTrackSteeringProfile = smoothTrackSteeringProfile(trackSteeringProfile, {
        polynomialOrder: SAVITZKY_GOLAY_POLYNOMIAL_ORDER,
        windowSize: SAVITZKY_GOLAY_WINDOW_SIZE,
        minimumLapSupport,
    })
    const steeringStrengthProfile = createSteeringStrengthProfile(smoothedTrackSteeringProfile)
    const steeringStrengthOtsuResult = calculateSteeringStrengthOtsu(steeringStrengthProfile)
    const steeringStrengthThresholdResult = deriveSteeringStrengthThresholds(steeringStrengthProfile, steeringStrengthOtsuResult)
    const cornerCandidates = findCornerCandidates(steeringStrengthProfile, steeringStrengthThresholdResult)
    const confirmedCornerCandidates = confirmCornerCandidates(cornerCandidates, cellAlignedSteering, steeringStrengthThresholdResult, MINIMUM_CORNER_CANDIDATE_CONFIDENCE)
    return { cellAlignedSteering, trackSteeringProfile, smoothedTrackSteeringProfile, steeringStrengthProfile, steeringStrengthOtsuResult, steeringStrengthThresholdResult, cornerCandidates, confirmedCornerCandidates }
}
