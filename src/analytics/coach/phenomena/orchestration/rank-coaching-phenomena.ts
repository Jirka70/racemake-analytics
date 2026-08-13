import type { CoachingFinding, CoachingPhenomenonResult } from '../coaching-phenomenon-types'

export interface RankedCoachingPhenomenon {
    readonly rank: number
    readonly priority: number
    readonly finding: CoachingFinding
}

export function calculatePhenomenaPriority(
    impactTimeLossMs: number,
    maximumImpactTimeLossMs: number,
): number {
    if (maximumImpactTimeLossMs <= 0) return 0

    return Math.min(
        Math.max(impactTimeLossMs, 0) / maximumImpactTimeLossMs,
        1,
    )
}

export function rankCoachingPhenomena(
    phenomenonResults: readonly CoachingPhenomenonResult[],
): readonly RankedCoachingPhenomenon[] {
    const findings = phenomenonResults.flatMap((result) =>
        result.status === 'detected' ? [result.finding] : [],
    )
    const maximumImpactTimeLossMs = Math.max(
        0,
        ...findings.map((finding) => finding.impactTimeLossMs),
    )

    return findings
        .map((finding) => ({
            priority: calculatePhenomenaPriority(
                finding.impactTimeLossMs,
                maximumImpactTimeLossMs,
            ),
            finding,
        }))
        .sort(compareRankedPhenomena)
        .map((rankedPhenomenon, index) => ({
            rank: index + 1,
            ...rankedPhenomenon,
        }))
}

function compareRankedPhenomena(
    first: Omit<RankedCoachingPhenomenon, 'rank'>,
    second: Omit<RankedCoachingPhenomenon, 'rank'>,
): number {
    return second.priority - first.priority
        || first.finding.lapNumber - second.finding.lapNumber
        || first.finding.occurredAtLapElapsedMs - second.finding.occurredAtLapElapsedMs
        || first.finding.analysisRegionId.localeCompare(second.finding.analysisRegionId)
        || first.finding.phenomenon.localeCompare(second.finding.phenomenon)
}
