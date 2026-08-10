export interface BrakingOnsetPhenomenonConfig {
    readonly minimumDifferenceMs: number
}

export const DEFAULT_BRAKING_ONSET_PHENOMENON_CONFIG: BrakingOnsetPhenomenonConfig = Object.freeze({
    // Smaller differences remain unclassified so normal input timing variation is not turned into coaching advice.
    minimumDifferenceMs: 250,
})
