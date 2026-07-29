import type { LapDetectionConfig } from '../lap-detect-types'

export const DEFAULT_LAP_DETECTION_CONFIG: LapDetectionConfig = Object.freeze({
    calibration: {
        minimumSamples: 30,
        positionRateMadMultiplier: 12,
        positionRateIqrMultiplier: 3,
    },

    crossing: {
        localWindowDurationMultiplier: 5,
        minimumLocalTransitions: 3,
        minimumConfidence: 0.65,
        counterUpdateToleranceFrames: 1,
        confidenceWeights: {
            boundaryLocalRateConsistency: 0.8,
            boundaryCounterAgreement: 0.2,
            timestampTemporalResolution: 0.5,
            timestampPositionResolution: 0.3,
            timestampLocalRateConsistency: 0.2,
        },
    },

    interpolation: {
        positionGapMedianMultiplier: 6,
        maximumAbsolutePositionSpan: 0.01,
    },

    linearGrid: {
        minimumCellCount: 200,
        maximumCellCount: 2_000,
        minimumUsablePositionSampleCount: 200,
        minimumRelativePositionSampleRatio: 0.6,
    },

    eligibility: {
        minimumRacingPositionCoverage: 0.9,
        maximumRacingUnsupportedPositionSpan: 0.05,
        minimumCornerPositionCoverage: 0.9,
        minimumCornerSteeringCoverage: 0.9,
        maximumCornerUnsupportedSpan: 0.05,
        minimumComparisonCoverage: 0.98,
        maximumComparisonUnsupportedSpan: 0.02,
    },

    motion: {
        stationarySpeedKmh: 5,
        minimumSpeedEvidenceFraction: 0.8,
        minimumMovingFraction: 0.8,
        maximumStationaryFraction: 0.1,
    },
})
