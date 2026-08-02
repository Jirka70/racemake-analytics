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
        realRacing: {
            // Observed masks are conservative because multiple samples can map to the same grid point.
            minimumPositionCoverageRatio: 0.8,
            maximumUnsupportedNormalizedPositionSpan: 0.02, // Do not accept one missing region spanning more than 2% of the lap.
            stationarySpeedUpperBoundKmh: 5, // Speeds at or below this domain guardrail count as stationary or near-stationary.
            minimumMovementObservationTimeRatio: 0.9, // Require usable speed evidence for at least 90% of crossing-to-crossing time.
            minimumMovingObservedTimeRatio: 0.9, // Require movement for at least 90% of time with usable speed evidence.
            maximumStationaryIntervalLapTimeRatio: 0.05, // Reject one stationary interval longer than 5% of total lap time.
        },
        corner: {
            minimumSteeringCoverageRatio: 0.8, // Observed steering must cover at least 80% of grid positions.
            maximumUnsupportedSteeringPositionSpan: 0.02, // No single steering hole may span more than 2% of the lap.
        },
    },
})
