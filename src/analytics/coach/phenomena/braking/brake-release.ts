import type { CellAlignedRacingLap, CellAlignedRacingLapCell } from '../../cell-aligned-racing-telemetry-types'
import type { CornerTrackRegion } from '../../track-region-types'
import type { AnalysisLimitation, CoachingFindingMetric, CoachingPhenomenonDetector, CoachingPhenomenonInput, CoachingPhenomenonResult } from '../coaching-phenomenon-types'
import type { BrakeActivityThresholdResult } from './brake-activity-thresholds'
import { DEFAULT_BRAKE_RELEASE_PHENOMENON_CONFIG, type BrakeReleasePhenomenonConfig } from './brake-release-config'
import { findRelevantBrakeOnset } from './braking-onset-phenomena'
import { createEventPositionMetric, createSpeedMetric } from './braking-finding-metrics'
import { createBrakeActivityMask } from './create-brake-activity-mask'

type BrakeReleaseResult =
    | {
        readonly status: 'found'
        readonly boundary: {
            readonly lastActiveCellIndex: number
            readonly releaseCellIndex: number
        }
    }
    | {
        readonly status: 'not-found'
        readonly reason: 'BRAKING_RUN_CONTINUES_TO_CONTEXT_END'
    }
    | {
        readonly status: 'unavailable'
        readonly reason: 'UNRELIABLE_BRAKE_RELEASE_BOUNDARY'
        readonly boundaryCellIndexes: readonly [number, number]
    }

interface RegionBrakeReleaseInput {
    readonly lapCells: readonly CellAlignedRacingLapCell[]
    readonly brakingMask: readonly boolean[]
    readonly onsetCellIndex: number
}

interface RegionBrakeReleases {
    readonly comparedRegionBrakeRelease: BrakeReleaseResult
    readonly fastestRegionBrakeRelease: BrakeReleaseResult
}

export interface BrakeReleaseReportFacts {
    readonly lapNumber: number
    readonly cornerId: string
    readonly fastestRegionPassLapNumber: number
    /** Compared-region release time minus fastest-region release time. */
    readonly brakeReleaseDifferenceMs: number
    /** Compared-region entry speed minus fastest-region entry speed. */
    readonly entrySpeedDifferenceKmh: number | null
    /** Compared-region travel time minus fastest-region travel time. */
    readonly timeLossFromFastestReleaseMs: number | null
    /** Compared-region exit speed minus fastest-region exit speed. */
    readonly exitSpeedDifferenceKmh: number | null
}

export interface BrakeReleaseEvidenceMargins {
    readonly minimumTimeLossMs: number
    readonly minimumSpeedDifferenceKmh: number
}

export type BrakeReleaseReportVariant =
    | 'OVERDRIVEN_ENTRY'
    | 'LATE_RELEASE_WITH_SLOWER_EXIT'
    | 'LATE_RELEASE_WITH_TIME_LOSS'
    | 'NONE'

export function isLateBrakeRelease(
    facts: BrakeReleaseReportFacts,
    config: Pick<BrakeReleasePhenomenonConfig, 'minimumDifferenceMs'> = DEFAULT_BRAKE_RELEASE_PHENOMENON_CONFIG,
): boolean {
    return facts.brakeReleaseDifferenceMs >= config.minimumDifferenceMs
}

export function hasFasterEntry(
    facts: BrakeReleaseReportFacts,
    margins: BrakeReleaseEvidenceMargins,
): facts is BrakeReleaseReportFacts & { readonly entrySpeedDifferenceKmh: number } {
    return facts.entrySpeedDifferenceKmh !== null
        && facts.entrySpeedDifferenceKmh >= margins.minimumSpeedDifferenceKmh
}

export function hasLostTimeAfterFastestRelease(
    facts: BrakeReleaseReportFacts,
    margins: BrakeReleaseEvidenceMargins,
): facts is BrakeReleaseReportFacts & { readonly timeLossFromFastestReleaseMs: number } {
    return facts.timeLossFromFastestReleaseMs !== null
        && facts.timeLossFromFastestReleaseMs >= margins.minimumTimeLossMs
}

export function hasSlowerExit(
    facts: BrakeReleaseReportFacts,
    margins: BrakeReleaseEvidenceMargins,
): facts is BrakeReleaseReportFacts & { readonly exitSpeedDifferenceKmh: number } {
    return facts.exitSpeedDifferenceKmh !== null
        && facts.exitSpeedDifferenceKmh <= -margins.minimumSpeedDifferenceKmh
}

export function selectBrakeReleaseReportVariant(
    facts: BrakeReleaseReportFacts,
    margins: BrakeReleaseEvidenceMargins,
    config: Pick<BrakeReleasePhenomenonConfig, 'minimumDifferenceMs'> = DEFAULT_BRAKE_RELEASE_PHENOMENON_CONFIG,
): BrakeReleaseReportVariant {
    if (!isLateBrakeRelease(facts, config) || !hasLostTimeAfterFastestRelease(facts, margins)) return 'NONE'
    if (hasFasterEntry(facts, margins) && hasSlowerExit(facts, margins)) return 'OVERDRIVEN_ENTRY'
    if (hasSlowerExit(facts, margins)) return 'LATE_RELEASE_WITH_SLOWER_EXIT'
    return 'LATE_RELEASE_WITH_TIME_LOSS'
}

export function createBrakeReleaseReportMessage(
    facts: BrakeReleaseReportFacts,
    margins: BrakeReleaseEvidenceMargins,
    config: Pick<BrakeReleasePhenomenonConfig, 'minimumDifferenceMs'> = DEFAULT_BRAKE_RELEASE_PHENOMENON_CONFIG,
): string | null {
    const variant = selectBrakeReleaseReportVariant(facts, margins, config)
    const brakeReleaseDifferenceMs = Math.round(Math.abs(facts.brakeReleaseDifferenceMs))

    switch (variant) {
        case 'OVERDRIVEN_ENTRY': {
            if (!hasFasterEntry(facts, margins)) throw new TypeError('Overdriven-entry report requires a faster entry')
            if (!hasLostTimeAfterFastestRelease(facts, margins)) throw new TypeError('Overdriven-entry report requires measured time loss')
            if (!hasSlowerExit(facts, margins)) throw new TypeError('Overdriven-entry report requires a slower exit')

            const entrySpeedDifferenceKmh = Math.abs(facts.entrySpeedDifferenceKmh).toFixed(1)
            const timeLossFromFastestReleaseMs = Math.round(facts.timeLossFromFastestReleaseMs)
            const exitSpeedDifferenceKmh = Math.abs(facts.exitSpeedDifferenceKmh).toFixed(1)
            return `On lap ${facts.lapNumber}, you entered ${facts.cornerId} ${entrySpeedDifferenceKmh} km/h faster than on your quickest ${facts.cornerId} pass, but kept braking for ${brakeReleaseDifferenceMs} ms longer. From the point where Lap ${facts.fastestRegionPassLapNumber} stopped braking to the ${facts.cornerId} exit, you lost ${timeLossFromFastestReleaseMs} ms and exited ${exitSpeedDifferenceKmh} km/h slower. The additional entry speed did not pay off — finish braking earlier and protect the exit.`
        }

        case 'LATE_RELEASE_WITH_SLOWER_EXIT': {
            if (!hasLostTimeAfterFastestRelease(facts, margins)) throw new TypeError('Slower-exit report requires measured time loss')
            if (!hasSlowerExit(facts, margins)) throw new TypeError('Slower-exit report requires a slower exit')

            const timeLossFromFastestReleaseMs = Math.round(facts.timeLossFromFastestReleaseMs)
            const exitSpeedDifferenceKmh = Math.abs(facts.exitSpeedDifferenceKmh).toFixed(1)
            return `On lap ${facts.lapNumber}, you kept braking for ${brakeReleaseDifferenceMs} ms longer into ${facts.cornerId} than on your quickest ${facts.cornerId} pass. From the point where Lap ${facts.fastestRegionPassLapNumber} stopped braking to the ${facts.cornerId} exit, you lost ${timeLossFromFastestReleaseMs} ms and exited ${exitSpeedDifferenceKmh} km/h slower. Finish braking earlier and protect the exit.`
        }

        case 'LATE_RELEASE_WITH_TIME_LOSS': {
            if (!hasLostTimeAfterFastestRelease(facts, margins)) throw new TypeError('Time-loss report requires measured time loss')

            const timeLossFromFastestReleaseMs = Math.round(facts.timeLossFromFastestReleaseMs)
            return `On lap ${facts.lapNumber}, you kept braking for ${brakeReleaseDifferenceMs} ms longer into ${facts.cornerId} than on your quickest ${facts.cornerId} pass. From the point where Lap ${facts.fastestRegionPassLapNumber} stopped braking to the ${facts.cornerId} exit, you lost ${timeLossFromFastestReleaseMs} ms. Finish braking earlier through ${facts.cornerId}.`
        }

        case 'NONE':
            return null
    }
}

export function createBrakeReleaseDetector(
    thresholds: BrakeActivityThresholdResult,
    config: BrakeReleasePhenomenonConfig = DEFAULT_BRAKE_RELEASE_PHENOMENON_CONFIG,
): CoachingPhenomenonDetector {
    return {
        phenomena: ['LATE_BRAKE_RELEASE'],
        channelRequirements: {
            requiredChannels: ['brakeRatio', 'speedKmh'],
            supportingChannels: ['normalizedTrackPosition'],
        },
        isApplicable: isBrakeReleaseApplicable,
        find: (input) => findBrakeReleasePhenomenon(input, thresholds, config),
    }
}

function isBrakeReleaseApplicable(
    input: CoachingPhenomenonInput,
): boolean {
    const isCurrentRegionCorner =
        input.regionContext.currentTrackRegion.type === 'corner'

    const comparesDifferentRegionPasses =
        input.comparedLap.lapNumber
        !== input.fastestObservedLap.lapNumber

    return isCurrentRegionCorner
        && comparesDifferentRegionPasses
}

function findBrakeReleasePhenomenon(
    input: CoachingPhenomenonInput,
    thresholds: BrakeActivityThresholdResult,
    config: BrakeReleasePhenomenonConfig,
): CoachingPhenomenonResult {
    const currentCorner = input.regionContext.currentTrackRegion
    if (currentCorner.type !== 'corner') {
        throw new TypeError('Brake release detector requires a corner region')
    }
    if (thresholds.status === 'unavailable') {
        return createBrakeReleaseUnavailableResult(input, {
            code: 'BRAKE_ACTIVITY_THRESHOLD_UNAVAILABLE',
            message: `Brake activity threshold is unavailable: ${thresholds.reason}.`,
        })
    }

    const comparedRegionBrakingMask = createBrakeActivityMask(
        input.comparedLap,
        thresholds.highThresholdRatio,
        thresholds.lowThresholdRatio,
    )
    const fastestRegionBrakingMask = createBrakeActivityMask(
        input.fastestObservedLap,
        thresholds.highThresholdRatio,
        thresholds.lowThresholdRatio,
    )
    const contextCellIndexes = input.regionContext.contextCellIndexes
    const comparedRegionBrakeOnset = findRelevantBrakeOnset(
        input.comparedLap.cells,
        comparedRegionBrakingMask,
        contextCellIndexes,
    )
    const fastestRegionBrakeOnset = findRelevantBrakeOnset(
        input.fastestObservedLap.cells,
        fastestRegionBrakingMask,
        contextCellIndexes,
    )

    if (comparedRegionBrakeOnset.status === 'unavailable' || fastestRegionBrakeOnset.status === 'unavailable') {
        return createBrakeReleaseUnavailableResult(input, {
            code: 'BRAKE_ONSET_DETECTION_UNAVAILABLE',
            message: 'A reliable braking onset is unavailable for one of the compared region passes.',
        })
    }
    if (comparedRegionBrakeOnset.status === 'not-found' || fastestRegionBrakeOnset.status === 'not-found') {
        return createBrakeReleaseNotDetectedResult(input)
    }

    const {
        comparedRegionBrakeRelease,
        fastestRegionBrakeRelease,
    } = findBrakeReleases(
        {
            lapCells: input.comparedLap.cells,
            brakingMask: comparedRegionBrakingMask,
            onsetCellIndex: comparedRegionBrakeOnset.boundary.onsetCellIndex,
        },
        {
            lapCells: input.fastestObservedLap.cells,
            brakingMask: fastestRegionBrakingMask,
            onsetCellIndex: fastestRegionBrakeOnset.boundary.onsetCellIndex,
        },
    )

    if (comparedRegionBrakeRelease.status === 'unavailable' || fastestRegionBrakeRelease.status === 'unavailable') {
        return createBrakeReleaseUnavailableResult(input, {
            code: 'BRAKE_RELEASE_DETECTION_UNAVAILABLE',
            message: 'A reliable brake-release boundary is unavailable for one of the compared region passes.',
        })
    }
    if (comparedRegionBrakeRelease.status === 'not-found' || fastestRegionBrakeRelease.status === 'not-found') {
        return createBrakeReleaseNotDetectedResult(input)
    }

    const comparedRegionReleaseCellIndex = comparedRegionBrakeRelease.boundary.releaseCellIndex
    const fastestRegionReleaseCellIndex = fastestRegionBrakeRelease.boundary.releaseCellIndex
    const areReleaseCellsInContext = contextCellIndexes.includes(comparedRegionReleaseCellIndex)
        && contextCellIndexes.includes(fastestRegionReleaseCellIndex)
    if (!areReleaseCellsInContext) {
        return createBrakeReleaseUnavailableResult(input, {
            code: 'BRAKE_RELEASE_DETECTION_UNAVAILABLE',
            message: 'A confirmed braking run continues beyond the analyzed region context.',
        })
    }

    const brakeReleaseDifferenceMs = calculateBrakeReleaseDifferenceMs(
        input.fastestObservedLap,
        comparedRegionReleaseCellIndex,
        fastestRegionReleaseCellIndex,
        contextCellIndexes,
    )
    if (brakeReleaseDifferenceMs === null) {
        return createBrakeReleaseUnavailableResult(input, {
            code: 'TIMELINE_DISCONTINUITY',
            message: 'Travel time between the two brake-release positions is unavailable.',
        })
    }

    const facts = createBrakeReleaseReportFacts(
        input,
        currentCorner,
        brakeReleaseDifferenceMs,
        fastestRegionReleaseCellIndex,
    )
    const timeLossFromFastestReleaseMs = facts.timeLossFromFastestReleaseMs
    if (timeLossFromFastestReleaseMs === null) {
        return createBrakeReleaseUnavailableResult(input, {
            code: 'TIMELINE_DISCONTINUITY',
            message: 'Travel-time loss from the fastest region release point to corner exit is unavailable.',
        })
    }
    const reportFacts = { ...facts, timeLossFromFastestReleaseMs }

    const message = createBrakeReleaseReportMessage(reportFacts, config, config)
    if (message === null) return createBrakeReleaseNotDetectedResult(input)

    return createDetectedBrakeReleaseResult(
        input,
        reportFacts,
        message,
        comparedRegionReleaseCellIndex,
        fastestRegionReleaseCellIndex,
    )
}

function createDetectedBrakeReleaseResult(
    input: CoachingPhenomenonInput,
    facts: BrakeReleaseReportFacts & { readonly timeLossFromFastestReleaseMs: number },
    message: string,
    comparedRegionReleaseCellIndex: number,
    fastestRegionReleaseCellIndex: number,
): CoachingPhenomenonResult {
    const comparedRegionReleaseTimeMs = input.comparedLap.cells[comparedRegionReleaseCellIndex]?.from.lapElapsedMs
    if (comparedRegionReleaseTimeMs === null || comparedRegionReleaseTimeMs === undefined) {
        return createBrakeReleaseUnavailableResult(input, {
            code: 'TIMELINE_DISCONTINUITY',
            message: 'The compared region brake-release time is unavailable.',
        })
    }

    const metrics = createBrakeReleaseMetrics(
        input,
        facts.brakeReleaseDifferenceMs,
        comparedRegionReleaseCellIndex,
    )

    return {
        status: 'detected',
        finding: {
            phenomenon: 'LATE_BRAKE_RELEASE',
            lapNumber: input.comparison.comparedLapNumber,
            comparedWithLapNumber: input.comparison.fastestObserved.lapNumber,
            analysisRegionId: input.regionContext.currentTrackRegion.id,
            occurredAtLapElapsedMs: comparedRegionReleaseTimeMs,
            impactTimeLossMs: facts.timeLossFromFastestReleaseMs,
            message,
            evidence: [{
                channels: ['brakeRatio', 'speedKmh', 'normalizedTrackPosition'],
                message: `Compared region release cell ${comparedRegionReleaseCellIndex}; fastest region release cell ${fastestRegionReleaseCellIndex}; release difference ${Math.round(facts.brakeReleaseDifferenceMs)} ms; time loss to corner exit ${Math.round(facts.timeLossFromFastestReleaseMs)} ms.`,
            }],
            metrics,
            limitations: [],
        },
    }
}

function createBrakeReleaseMetrics(
    input: CoachingPhenomenonInput,
    brakeReleaseDifferenceMs: number,
    comparedRegionReleaseCellIndex: number,
): readonly CoachingFindingMetric[] {
    const currentCorner = input.regionContext.currentTrackRegion
    if (currentCorner.type !== 'corner') {
        throw new TypeError('Brake release metrics require a corner region')
    }

    const metrics: CoachingFindingMetric[] = []
    const eventPosition = createEventPositionMetric(
        input.comparedLap,
        comparedRegionReleaseCellIndex,
        'brake-release',
        currentCorner.id,
        'in-region',
    )
    if (eventPosition) metrics.push(eventPosition)
    metrics.push({
        kind: 'timing-difference',
        role: 'evidence',
        event: 'brake-release',
        differenceMs: brakeReleaseDifferenceMs,
    })

    const entryCellIndex = currentCorner.cellIndexes[0]
    const exitCellIndex = currentCorner.cellIndexes.at(-1)
    if (entryCellIndex !== undefined) {
        const entrySpeedMetric = createSpeedMetric(
            input.comparedLap,
            input.fastestObservedLap,
            'entry',
            [entryCellIndex],
        )
        if (entrySpeedMetric) metrics.push(entrySpeedMetric)
    }

    const minimumSpeedMetric = createSpeedMetric(
        input.comparedLap,
        input.fastestObservedLap,
        'minimum',
        currentCorner.cellIndexes,
    )
    if (minimumSpeedMetric) metrics.push(minimumSpeedMetric)

    if (exitCellIndex !== undefined) {
        const exitSpeedMetric = createSpeedMetric(
            input.comparedLap,
            input.fastestObservedLap,
            'exit',
            [exitCellIndex],
        )
        if (exitSpeedMetric) metrics.push(exitSpeedMetric)
    }

    return metrics
}

function createBrakeReleaseNotDetectedResult(input: CoachingPhenomenonInput): CoachingPhenomenonResult {
    return {
        status: 'not-detected',
        phenomenon: 'LATE_BRAKE_RELEASE',
        lapNumber: input.comparison.comparedLapNumber,
        comparedWithLapNumber: input.comparison.fastestObserved.lapNumber,
        analysisRegionId: input.regionContext.currentTrackRegion.id,
    }
}

function createBrakeReleaseUnavailableResult(
    input: CoachingPhenomenonInput,
    limitation: AnalysisLimitation,
): CoachingPhenomenonResult {
    return {
        status: 'unavailable',
        phenomenon: 'LATE_BRAKE_RELEASE',
        lapNumber: input.comparison.comparedLapNumber,
        comparedWithLapNumber: input.comparison.fastestObserved.lapNumber,
        analysisRegionId: input.regionContext.currentTrackRegion.id,
        limitations: [limitation],
    }
}

function createBrakeReleaseReportFacts(
    input: CoachingPhenomenonInput,
    currentCorner: CornerTrackRegion,
    brakeReleaseDifferenceMs: number,
    fastestRegionReleaseCellIndex: number,
): BrakeReleaseReportFacts {
    const cornerEntryCellIndex = currentCorner.cellIndexes[0]
    const cornerExitCellIndex = currentCorner.cellIndexes.at(-1)
    if (cornerEntryCellIndex === undefined || cornerExitCellIndex === undefined) {
        throw new RangeError('Brake release report facts require a non-empty corner region')
    }

    return {
        lapNumber: input.comparedLap.lapNumber,
        cornerId: currentCorner.id,
        fastestRegionPassLapNumber: input.fastestObservedLap.lapNumber,
        brakeReleaseDifferenceMs,
        entrySpeedDifferenceKmh: calculateSpeedDifferenceKmh(
            input.comparedLap.cells[cornerEntryCellIndex],
            input.fastestObservedLap.cells[cornerEntryCellIndex],
        ),
        timeLossFromFastestReleaseMs: calculateTimeLossFromFastestReleaseMs(
            input.comparedLap,
            input.fastestObservedLap,
            fastestRegionReleaseCellIndex,
            cornerExitCellIndex,
            input.regionContext.contextCellIndexes,
        ),
        exitSpeedDifferenceKmh: calculateSpeedDifferenceKmh(
            input.comparedLap.cells[cornerExitCellIndex],
            input.fastestObservedLap.cells[cornerExitCellIndex],
        ),
    }
}

function calculateSpeedDifferenceKmh(
    comparedRegionCell: CellAlignedRacingLapCell | undefined,
    fastestRegionCell: CellAlignedRacingLapCell | undefined,
): number | null {
    if (
        comparedRegionCell === undefined
        || fastestRegionCell === undefined
        || comparedRegionCell.center.speedKmh === null
        || fastestRegionCell.center.speedKmh === null
        || !comparedRegionCell.quality.timelineContinuous
        || !fastestRegionCell.quality.timelineContinuous
        || comparedRegionCell.quality.discontinuousChannels.includes('speedKmh')
        || fastestRegionCell.quality.discontinuousChannels.includes('speedKmh')
    ) {
        return null
    }

    return comparedRegionCell.center.speedKmh
        - fastestRegionCell.center.speedKmh
}

function calculateTimeLossFromFastestReleaseMs(
    comparedRegionPassLap: CellAlignedRacingLap,
    fastestRegionPassLap: CellAlignedRacingLap,
    fastestRegionReleaseCellIndex: number,
    cornerExitCellIndex: number,
    regionCellIndexes: readonly number[],
): number | null {
    const fastestRegionReleaseOffset = regionCellIndexes.indexOf(
        fastestRegionReleaseCellIndex,
    )
    const cornerExitOffset = regionCellIndexes.indexOf(cornerExitCellIndex)
    if (
        fastestRegionReleaseOffset === -1
        || cornerExitOffset < fastestRegionReleaseOffset
    ) {
        return null
    }

    const measuredCellIndexes = regionCellIndexes.slice(
        fastestRegionReleaseOffset,
        cornerExitOffset + 1,
    )
    const comparedRegionDurationMs = calculateTravelTimeMs(
        comparedRegionPassLap,
        measuredCellIndexes,
    )
    const fastestRegionDurationMs = calculateTravelTimeMs(
        fastestRegionPassLap,
        measuredCellIndexes,
    )
    if (
        comparedRegionDurationMs === null
        || fastestRegionDurationMs === null
    ) {
        return null
    }

    return comparedRegionDurationMs - fastestRegionDurationMs
}

function calculateTravelTimeMs(
    lap: CellAlignedRacingLap,
    cellIndexes: readonly number[],
): number | null {
    let durationMs = 0
    for (const cellIndex of cellIndexes) {
        const cell = lap.cells[cellIndex]
        if (cell === undefined
            || cell.from.lapElapsedMs === null
            || cell.to.lapElapsedMs === null
            || cell.to.lapElapsedMs < cell.from.lapElapsedMs
            || !cell.quality.timelineContinuous
            || cell.quality.discontinuousChannels.includes('normalizedTrackPosition')) {
            return null
        }

        durationMs += cell.to.lapElapsedMs - cell.from.lapElapsedMs
    }
    return durationMs
}

export function findBrakeReleases(
    comparedRegion: RegionBrakeReleaseInput,
    fastestRegion: RegionBrakeReleaseInput,
): RegionBrakeReleases {
    const comparedRegionBrakeRelease = findBrakeRelease(
        comparedRegion.lapCells,
        comparedRegion.brakingMask,
        comparedRegion.onsetCellIndex,
    )
    const fastestRegionBrakeRelease = findBrakeRelease(
        fastestRegion.lapCells,
        fastestRegion.brakingMask,
        fastestRegion.onsetCellIndex,
    )
    return { comparedRegionBrakeRelease, fastestRegionBrakeRelease }
}

export function calculateBrakeReleaseDifferenceMs(
    fastestRegionPassLap: CellAlignedRacingLap,
    comparedRegionReleaseCellIndex: number,
    fastestRegionReleaseCellIndex: number,
    regionCellIndexes: readonly number[],
): number | null {
    const comparedRegionReleaseOffset = regionCellIndexes.indexOf(comparedRegionReleaseCellIndex)
    const fastestRegionReleaseOffset = regionCellIndexes.indexOf(fastestRegionReleaseCellIndex)
    if (comparedRegionReleaseOffset === -1 || fastestRegionReleaseOffset === -1) {
        throw new RangeError('Brake release cell must belong to the analyzed region')
    }

    const intervalStartOffset = Math.min(comparedRegionReleaseOffset, fastestRegionReleaseOffset)
    const intervalEndOffset = Math.max(comparedRegionReleaseOffset, fastestRegionReleaseOffset)
    let intervalDurationMs = 0
    for (const cellIndex of regionCellIndexes.slice(intervalStartOffset, intervalEndOffset)) {
        const cell = fastestRegionPassLap.cells[cellIndex]
        if (!cell || cell.from.lapElapsedMs === null || cell.to.lapElapsedMs === null || !cell.quality.timelineContinuous) return null
        if (cell.quality.discontinuousChannels.includes('normalizedTrackPosition')) return null
        intervalDurationMs += cell.to.lapElapsedMs - cell.from.lapElapsedMs
    }

    if (comparedRegionReleaseOffset < fastestRegionReleaseOffset) return -intervalDurationMs
    return intervalDurationMs
}

export function findBrakeRelease(
    lapCells: readonly CellAlignedRacingLapCell[],
    brakingMask: readonly boolean[],
    onsetCellIndex: number,
): BrakeReleaseResult {
    validateBrakeReleaseInput(lapCells, brakingMask, onsetCellIndex)

    let lastActiveCellIndex = onsetCellIndex
    let releaseCellIndex = onsetCellIndex
    while (brakingMask[releaseCellIndex]) {
        lastActiveCellIndex = releaseCellIndex
        releaseCellIndex = (releaseCellIndex + 1) % brakingMask.length
        if (releaseCellIndex === onsetCellIndex) {
            return {
                status: 'not-found',
                reason: 'BRAKING_RUN_CONTINUES_TO_CONTEXT_END',
            }
        }
    }

    if (!hasUsableBrakeData(lapCells[lastActiveCellIndex]!) || !hasUsableBrakeData(lapCells[releaseCellIndex]!)) {
        return {
            status: 'unavailable',
            reason: 'UNRELIABLE_BRAKE_RELEASE_BOUNDARY',
            boundaryCellIndexes: [lastActiveCellIndex, releaseCellIndex],
        }
    }

    return {
        status: 'found',
        boundary: {
            lastActiveCellIndex,
            releaseCellIndex,
        },
    }
}

function validateBrakeReleaseInput(
    lapCells: readonly CellAlignedRacingLapCell[],
    brakingMask: readonly boolean[],
    onsetCellIndex: number,
): void {
    if (brakingMask.length !== lapCells.length) {
        throw new RangeError('Brake activity mask length must match the number of lap cells')
    }
    if (!Number.isInteger(onsetCellIndex) || onsetCellIndex < 0 || onsetCellIndex >= lapCells.length) {
        throw new RangeError(`Brake onset cell index ${onsetCellIndex} is outside the lap cell range`)
    }
    if (!brakingMask[onsetCellIndex]) {
        throw new RangeError(`Brake onset cell index ${onsetCellIndex} must be active in the brake activity mask`)
    }
}

function hasUsableBrakeData(cell: CellAlignedRacingLapCell): boolean {
    return cell.center.brakeRatio !== null
        && cell.quality.timelineContinuous
        && !cell.quality.discontinuousChannels.includes('brakeRatio')
}
