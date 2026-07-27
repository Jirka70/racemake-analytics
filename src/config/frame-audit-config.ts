import type { FrameAuditConfig } from '../analytics/frame-audit-types'
import { DEFAULT_SAMPLING_AUDIT_CONFIG } from '../analytics/sampling-gaps'

export const DEFAULT_FRAME_AUDIT_CONFIG: FrameAuditConfig = Object.freeze({
  sampling: DEFAULT_SAMPLING_AUDIT_CONFIG,
  localOutlier: Object.freeze({
    spikeMadMultiplier: 12,
    persistenceWindowDeltaMultiplier: 5,
    minimumWindowSamples: 2,
    fallbackQuantile: 0.99,
  }),
})
