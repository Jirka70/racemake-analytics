import type { LapDetectionConfig } from '../lap-detect-types'

export const DEFAULT_LAP_DETECTION_CONFIG: LapDetectionConfig = Object.freeze({
    calibration: {
        minimumSamples: 30,
        positionRateMadMultiplier: 12,
        positionRateIqrMultiplier: 3,
    },

    interpolation: {
        positionGapMedianMultiplier: 6,
        maximumAbsolutePositionSpan: 0.01,
    },

    crossing: {
        lapCounterSearchRadiusFrames: 1,
    },
})
