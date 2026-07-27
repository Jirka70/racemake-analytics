import type {
  FrameAuditConfig,
  SamplingConfig,
} from '../analytics/frame-audit-types'

export const DEFAULT_SAMPLING_CONFIG: SamplingConfig = Object.freeze({
  minimumSampleCount: 30,
  gapMedianMultiplier: 5,
  gapMadMultiplier: 10,
})

export const DEFAULT_FRAME_AUDIT_CONFIG: FrameAuditConfig = Object.freeze({
  sampling: DEFAULT_SAMPLING_CONFIG,
})
