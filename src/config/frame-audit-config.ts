import type {
  FrameAuditConfig,
  SamplingConfig,
} from '../analytics/frame-audit-types'
import {
  DEFAULT_ISOLATED_OUTLIER_CONFIG,
} from '../analytics/audit/find-isolated-outliers'

export const DEFAULT_SAMPLING_CONFIG: SamplingConfig = Object.freeze({
  minimumSampleCount: 30,
  gapMedianMultiplier: 5,
  gapMadMultiplier: 10,
})

export const DEFAULT_FRAME_AUDIT_CONFIG: FrameAuditConfig = Object.freeze({
  sampling: DEFAULT_SAMPLING_CONFIG,
  isolatedOutlier: DEFAULT_ISOLATED_OUTLIER_CONFIG,
})
