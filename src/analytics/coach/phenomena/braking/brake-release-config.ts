export interface BrakeReleasePhenomenonConfig {
    readonly minimumDifferenceMs: number
    readonly minimumTimeLossMs: number
    readonly minimumSpeedDifferenceKmh: number
}

export const DEFAULT_BRAKE_RELEASE_PHENOMENON_CONFIG: BrakeReleasePhenomenonConfig = Object.freeze({
    // Smaller differences remain unclassified so normal release timing variation is not turned into coaching advice.
    minimumDifferenceMs: 250,
    minimumTimeLossMs: 50,
    minimumSpeedDifferenceKmh: 1,
})
