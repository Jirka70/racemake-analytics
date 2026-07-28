import type { ChannelContinuityConfig, FrameAuditConfig, SamplingConfig } from "../analytics/frame-audit-types";
import { DEFAULT_ISOLATED_OUTLIER_CONFIG } from "../analytics/audit/find-isolated-outliers";

export const DEFAULT_SAMPLING_CONFIG: SamplingConfig = Object.freeze({
    minimumSampleCount: 30,
    gapMedianMultiplier: 5,
    gapMadMultiplier: 10,
})

export const DEFAULT_CHANNEL_CONTINUITY_CONFIG: ChannelContinuityConfig = Object.freeze({
    minimumRateSampleCount: 30,
    rateMadMultiplier: 12,
    rateIqrMultiplier: 3,
    windowDurationMultiplier: 5,
    minimumWindowSamples: 4,
    minimumShiftToSpreadRatio: 6,
})

export const DEFAULT_FRAME_AUDIT_CONFIG: FrameAuditConfig = Object.freeze({
    sampling: DEFAULT_SAMPLING_CONFIG,
    isolatedOutlier: DEFAULT_ISOLATED_OUTLIER_CONFIG,
    channelContinuity: DEFAULT_CHANNEL_CONTINUITY_CONFIG,
})
