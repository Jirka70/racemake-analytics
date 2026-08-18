import type { LapDetectionConfig } from '../lap-detect-types'

export const DEFAULT_LAP_DETECTION_CONFIG: LapDetectionConfig = Object.freeze({
    calibration: {
        minimumSamples: 30,
        positionRateMadMultiplier: 12,
        positionRateIqrMultiplier: 3,
        positionStepMadMultiplier: 12,
        positionStepIqrMultiplier: 3,
    },

    crossing: {
        lapCounterSearchRadiusFrames: 1,
        confidence: {
            // Reaching either calibrated reference limit halves its continuous confidence component.
            interpolationSpanConfidenceAtSupportedLimit: 0.5,
            globalRateConfidenceAtPlausibleLimit: 0.5,
            temporalConfidenceAtMedianInterval: 0.9, // A normal sampling interval retains high, but not perfect, interpolated timestamp confidence.
            localRateReferenceRelativeDifference: 0.25, // A 25% local-rate difference is the named reference point for exponential decay.
            localRateConfidenceAtReferenceDifference: 0.5,
            localRateWindowDurationMedianMultiplier: 5, // Inspect up to five typical sampling intervals on each side without crossing unusable position transitions.
            localRateFullSupportSamplesPerSide: 3, // Three usable rates on both sides provide full local-rate support.
            lapCounterAgreementScores: {
                exact: 1,
                nearby: 0.85,
                missing: 0.1,
                mismatch: 0,
            },
            aggregationWeights: {
                // Start with equal explicit weights so later policy changes remain centralized and explainable.
                boundary: {
                    localRateConsistency: 1,
                    localRateSupport: 1,
                    globalRatePlausibility: 1,
                    lapCounterAgreement: 1,
                },
                timestamp: {
                    interpolationSpanSupport: 1,
                    temporalResolution: 1,
                    localRateConsistency: 1,
                },
            },
        },
    },

    eligibility: {
        time: {
            // Both independent confidence dimensions must retain at least half of their normalized support.
            minimumBoundaryConfidence: 0.5,
            minimumLapTimeConfidence: 0.5,
        },
    },
})
