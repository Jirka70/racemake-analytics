import type { CoachingEvidenceMargins } from '../coaching-phenomenon-types'

export interface BrakingOnsetPhenomenonConfig {
    readonly minimumDifferenceMs: number
}

export const DEFAULT_BRAKING_ONSET_PHENOMENON_CONFIG: BrakingOnsetPhenomenonConfig = Object.freeze({
    // Smaller differences remain unclassified so normal input timing variation is not turned into coaching advice.
    minimumDifferenceMs: 250,
})

export const DEFAULT_UNNECESSARY_BRAKING_EVIDENCE_MARGINS: CoachingEvidenceMargins = Object.freeze({
    minimumTimeLossMs: 50,
    minimumSpeedDifferenceKmh: 1,
})
