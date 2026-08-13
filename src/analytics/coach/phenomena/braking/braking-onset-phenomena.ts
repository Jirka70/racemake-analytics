import type { CellAlignedRacingLap, CellAlignedRacingLapCell } from '../../cell-aligned-racing-telemetry-types'
import type { CornerTrackRegion, StraightTrackRegion, TrackRegion } from '../../track-region-types'
import type { AnalysisLimitation, CoachingAnalysisRegionId, CoachingEvidenceMargins, CoachingPhenomenon, CoachingPhenomenonDetector, CoachingPhenomenonInput, CoachingPhenomenonResult } from '../coaching-phenomenon-types'
import type { BrakeActivityThresholdResult } from './brake-activity-thresholds'
import { DEFAULT_BRAKING_ONSET_PHENOMENON_CONFIG, DEFAULT_UNNECESSARY_BRAKING_EVIDENCE_MARGINS, type BrakingOnsetPhenomenonConfig } from './braking-onset-config'
import { createBrakeActivityMask } from './create-brake-activity-mask'

interface BrakingActivityMasks {
    readonly comparedLapMask: readonly boolean[]
    readonly fastestObservedLapMask: readonly boolean[]
}

export interface UnnecessaryBrakingReportFacts {
    readonly lapNumber: number
    readonly cornerId: string
    readonly hasBrakingStartedBeforeCorner: boolean
    readonly maximumBrakeRatio: number | null
    readonly timeLossSinceBrakingStartedMs: number
    readonly entrySpeedDifferenceKmh: number | null
    readonly steeringPeakSpeedDifferenceKmh: number | null
    readonly exitSpeedDifferenceKmh: number | null
}

export type UnnecessaryBrakingReportVariant =
    | 'BRAKING_WITH_CORNER_SPEED_COST'
    | 'BRAKING_WITH_TIME_LOSS'
    | 'NONE'

export function hasSignificantTimeLoss(
    facts: UnnecessaryBrakingReportFacts,
    margins: CoachingEvidenceMargins,
): boolean {
    return facts.timeLossSinceBrakingStartedMs >= margins.minimumTimeLossMs
}

export function hasLowerEntrySpeed(
    facts: UnnecessaryBrakingReportFacts,
    margins: CoachingEvidenceMargins,
): facts is UnnecessaryBrakingReportFacts & { readonly entrySpeedDifferenceKmh: number } {
    return facts.entrySpeedDifferenceKmh !== null
        && facts.entrySpeedDifferenceKmh <= -margins.minimumSpeedDifferenceKmh
}

export function hasLowerSteeringPeakSpeed(
    facts: UnnecessaryBrakingReportFacts,
    margins: CoachingEvidenceMargins,
): facts is UnnecessaryBrakingReportFacts & { readonly steeringPeakSpeedDifferenceKmh: number } {
    return facts.steeringPeakSpeedDifferenceKmh !== null
        && facts.steeringPeakSpeedDifferenceKmh <= -margins.minimumSpeedDifferenceKmh
}

export function hasSlowerExit(
    facts: UnnecessaryBrakingReportFacts,
    margins: CoachingEvidenceMargins,
): facts is UnnecessaryBrakingReportFacts & { readonly exitSpeedDifferenceKmh: number } {
    return facts.exitSpeedDifferenceKmh !== null
        && facts.exitSpeedDifferenceKmh <= -margins.minimumSpeedDifferenceKmh
}

export function hasMeasuredBrakePressure(
    facts: UnnecessaryBrakingReportFacts,
): facts is UnnecessaryBrakingReportFacts & { readonly maximumBrakeRatio: number } {
    return facts.maximumBrakeRatio !== null
}

export function selectUnnecessaryBrakingReportVariant(
    facts: UnnecessaryBrakingReportFacts,
    margins: CoachingEvidenceMargins,
): UnnecessaryBrakingReportVariant {
    if (!hasSignificantTimeLoss(facts, margins)) {
        return 'NONE'
    }

    const hasCornerSpeedCost = hasLowerEntrySpeed(facts, margins)
        && hasLowerSteeringPeakSpeed(facts, margins)
    if (hasCornerSpeedCost) {
        return 'BRAKING_WITH_CORNER_SPEED_COST'
    }

    return 'BRAKING_WITH_TIME_LOSS'
}

export function createUnnecessaryBrakingReportMessage(
    facts: UnnecessaryBrakingReportFacts,
    margins: CoachingEvidenceMargins,
): string | null {
    const variant = selectUnnecessaryBrakingReportVariant(facts, margins)
    const brakingLocation = facts.hasBrakingStartedBeforeCorner
        ? `before ${facts.cornerId} entry`
        : `in ${facts.cornerId}`
    const brakeUsage = hasMeasuredBrakePressure(facts)
        ? `applied up to ${Math.round(facts.maximumBrakeRatio * 100)}% brake`
        : 'applied the brake'
    const roundedTimeLossMs = Math.round(facts.timeLossSinceBrakingStartedMs)

    switch (variant) {
        case 'BRAKING_WITH_CORNER_SPEED_COST': {
            if (!hasLowerEntrySpeed(facts, margins)) {
                throw new TypeError('Corner-speed-cost report requires a lower entry speed')
            }
            if (!hasLowerSteeringPeakSpeed(facts, margins)) {
                throw new TypeError('Corner-speed-cost report requires a lower steering-peak speed')
            }

            const entrySpeedDifferenceKmh = Math.abs(facts.entrySpeedDifferenceKmh).toFixed(1)
            const steeringPeakSpeedDifferenceKmh = Math.abs(facts.steeringPeakSpeedDifferenceKmh).toFixed(1)
            const slowerExitSentence = hasSlowerExit(facts, margins)
                ? ` You also exited ${Math.abs(facts.exitSpeedDifferenceKmh).toFixed(1)} km/h slower.`
                : ''

            return `On lap ${facts.lapNumber}, you ${brakeUsage} ${brakingLocation}, while your fastest pass through the corner stayed off the brake. You entered ${entrySpeedDifferenceKmh} km/h slower and carried ${steeringPeakSpeedDifferenceKmh} km/h less speed through the steering-peak zone.${slowerExitSentence} From braking onset through ${facts.cornerId}, you lost ${roundedTimeLossMs} ms. Keep ${facts.cornerId} brake-free and protect momentum through the corner.`
        }

        case 'BRAKING_WITH_TIME_LOSS':
            return `On lap ${facts.lapNumber}, you ${brakeUsage} ${brakingLocation}, while your fastest pass through the corner stayed off the brake. From braking onset through ${facts.cornerId}, you lost ${roundedTimeLossMs} ms. Use the brake-free pass as your reference through ${facts.cornerId}.`

        case 'NONE':
            return null
    }
}

export interface BrakeOnsetBoundary {
    readonly precedingInactiveCellIndex: number
    readonly onsetCellIndex: number
}

export type BrakeOnsetResult =
    | {
        readonly status: 'found'
        readonly boundary: BrakeOnsetBoundary
    }
    | {
        readonly status: 'not-found'
        readonly reason: 'NO_NEW_BRAKING_RUN_IN_CONTEXT'
    }
    | {
        readonly status: 'unavailable'
        readonly reason: 'UNRELIABLE_BRAKE_ONSET_BOUNDARY'
        readonly boundaryCellIndexes: readonly [number, number]
    }

export function findRelevantBrakeOnset(cells: readonly CellAlignedRacingLapCell[], brakeActivityMask: readonly boolean[], contextCellIndexes: readonly number[]): BrakeOnsetResult {
    validateBrakeOnsetInput(cells, brakeActivityMask, contextCellIndexes)

    const firstInactiveContextOffset = contextCellIndexes.findIndex((cellIndex) => !brakeActivityMask[cellIndex])
    if (firstInactiveContextOffset === -1) return createBrakeOnsetNotFoundResult()

    for (let contextOffset = firstInactiveContextOffset + 1; contextOffset < contextCellIndexes.length; contextOffset++) {
        const precedingCellIndex = contextCellIndexes[contextOffset - 1]!
        const currentCellIndex = contextCellIndexes[contextOffset]!
        const startsBrakingRun = !brakeActivityMask[precedingCellIndex] && brakeActivityMask[currentCellIndex]
        if (!startsBrakingRun) continue

        const precedingCell = cells[precedingCellIndex]!
        const currentCell = cells[currentCellIndex]!
        if (!hasUsableBrakeData(precedingCell) || !hasUsableBrakeData(currentCell)) {
            return {
                status: 'unavailable',
                reason: 'UNRELIABLE_BRAKE_ONSET_BOUNDARY',
                boundaryCellIndexes: [precedingCellIndex, currentCellIndex],
            }
        }

        return {
            status: 'found',
            boundary: {
                precedingInactiveCellIndex: precedingCellIndex,
                onsetCellIndex: currentCellIndex,
            },
        }
    }

    return createBrakeOnsetNotFoundResult()
}

export function calculateBrakingOnsetDifferenceMs(fastestObservedLap: CellAlignedRacingLap, comparedOnsetCellIndex: number, fastestObservedOnsetCellIndex: number, contextCellIndexes: readonly number[]): number | null {
    const comparedContextOffset = contextCellIndexes.indexOf(comparedOnsetCellIndex)
    const fastestObservedContextOffset = contextCellIndexes.indexOf(fastestObservedOnsetCellIndex)
    if (comparedContextOffset === -1 || fastestObservedContextOffset === -1) throw new RangeError('Brake onset cell must belong to the region context')

    const intervalStartOffset = Math.min(comparedContextOffset, fastestObservedContextOffset)
    const intervalEndOffset = Math.max(comparedContextOffset, fastestObservedContextOffset)
    let intervalDurationMs = 0
    for (const cellIndex of contextCellIndexes.slice(intervalStartOffset, intervalEndOffset)) {
        const cell = fastestObservedLap.cells[cellIndex]
        if (!cell || cell.from.lapElapsedMs === null || cell.to.lapElapsedMs === null || !cell.quality.timelineContinuous) return null
        if (cell.quality.discontinuousChannels.includes('normalizedTrackPosition')) return null
        intervalDurationMs += cell.to.lapElapsedMs - cell.from.lapElapsedMs
    }

    if (comparedContextOffset < fastestObservedContextOffset) return -intervalDurationMs
    return intervalDurationMs
}

export function classifyBrakingOnsetDifference(differenceMs: number, config: BrakingOnsetPhenomenonConfig = DEFAULT_BRAKING_ONSET_PHENOMENON_CONFIG): Extract<CoachingPhenomenon, 'LATE_BRAKING' | 'EARLY_BRAKING'> | null {
    if (differenceMs >= config.minimumDifferenceMs) return 'LATE_BRAKING'
    if (differenceMs <= -config.minimumDifferenceMs) return 'EARLY_BRAKING'
    return null
}

function validateBrakeOnsetInput(cells: readonly CellAlignedRacingLapCell[], brakeActivityMask: readonly boolean[], contextCellIndexes: readonly number[]): void {
    if (brakeActivityMask.length !== cells.length) {
        throw new RangeError('Brake activity mask length must match the number of lap cells')
    }

    for (const cellIndex of contextCellIndexes) {
        if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= cells.length) {
            throw new RangeError(`Context cell index ${cellIndex} is outside the lap cell range`)
        }
    }
}

function hasUsableBrakeData(cell: CellAlignedRacingLapCell): boolean {
    return cell.center.brakeRatio !== null
        && cell.quality.timelineContinuous
        && !cell.quality.discontinuousChannels.includes('brakeRatio')
}

function createBrakeOnsetNotFoundResult(): BrakeOnsetResult {
    return {
        status: 'not-found',
        reason: 'NO_NEW_BRAKING_RUN_IN_CONTEXT',
    }
}

export function createBrakingOnsetDetector(
    thresholds: BrakeActivityThresholdResult,
    config: BrakingOnsetPhenomenonConfig = DEFAULT_BRAKING_ONSET_PHENOMENON_CONFIG,
    unnecessaryBrakingMargins: CoachingEvidenceMargins = DEFAULT_UNNECESSARY_BRAKING_EVIDENCE_MARGINS,
): CoachingPhenomenonDetector {
    return {
        phenomena: ['LATE_BRAKING', 'EARLY_BRAKING', 'UNNECESSARY_BRAKING'],
        channelRequirements: {
            requiredChannels: ['brakeRatio'],
            supportingChannels: ['speedKmh'],
        },
        isApplicable: isBrakingOnsetApplicable,
        find: (input) => findBrakingOnsetPhenomenon(
            input,
            thresholds,
            config,
            unnecessaryBrakingMargins,
        ),
    }
}

function isBrakingOnsetApplicable(input: CoachingPhenomenonInput): boolean {
    const currentTrackRegionIsCorner = input.regionContext.currentTrackRegion.type === 'corner'
    const comparesDifferentLaps = input.comparedLap.lapNumber !== input.fastestObservedLap.lapNumber
    return currentTrackRegionIsCorner && comparesDifferentLaps
}

function findBrakingOnsetPhenomenon(
    input: CoachingPhenomenonInput,
    thresholds: BrakeActivityThresholdResult,
    config: BrakingOnsetPhenomenonConfig,
    unnecessaryBrakingMargins: CoachingEvidenceMargins,
): CoachingPhenomenonResult {
    if (thresholds.status === 'unavailable') {
        return createBrakingOnsetUnavailableResult(input, {
            code: 'BRAKE_ACTIVITY_THRESHOLD_UNAVAILABLE' as const,
            message: `Brake activity threshold is unavailable: ${thresholds.reason}.`,
        })
    }

    const brakingActivityMasks = createBrakingActivityMasks(input, thresholds.highThresholdRatio, thresholds.lowThresholdRatio)
    return findBrakingOnsetPhenomenonFromActivityMasks(
        input,
        brakingActivityMasks,
        config,
        unnecessaryBrakingMargins,
    )
}

function createBrakingActivityMasks(input: CoachingPhenomenonInput, highThresholdRatio: number, lowThresholdRatio: number): BrakingActivityMasks {
    return {
        comparedLapMask: createBrakeActivityMask(input.comparedLap, highThresholdRatio, lowThresholdRatio),
        fastestObservedLapMask: createBrakeActivityMask(input.fastestObservedLap, highThresholdRatio, lowThresholdRatio),
    }
}

function findBrakingOnsetPhenomenonFromActivityMasks(
    input: CoachingPhenomenonInput,
    brakingActivityMasks: BrakingActivityMasks,
    config: BrakingOnsetPhenomenonConfig,
    unnecessaryBrakingMargins: CoachingEvidenceMargins,
): CoachingPhenomenonResult {
    const unnecessaryBrakingResult = findUnnecessaryBraking(
        input,
        brakingActivityMasks,
        unnecessaryBrakingMargins,
    )
    if (unnecessaryBrakingResult !== null) return unnecessaryBrakingResult

    const contextCellIndexes = input.regionContext.contextCellIndexes
    const comparedLapOnset = findRelevantBrakeOnset(input.comparedLap.cells, brakingActivityMasks.comparedLapMask, contextCellIndexes)
    if (comparedLapOnset.status !== 'found') {
        return createBrakingOnsetUnavailableResult(input, createBrakeOnsetLimitation('compared lap', comparedLapOnset))
    }

    const fastestObservedLapOnset = findRelevantBrakeOnset(input.fastestObservedLap.cells, brakingActivityMasks.fastestObservedLapMask, contextCellIndexes)
    if (fastestObservedLapOnset.status !== 'found') {
        return createBrakingOnsetUnavailableResult(input, createBrakeOnsetLimitation('fastest observed pass', fastestObservedLapOnset))
    }

    const differenceMs = calculateBrakingOnsetDifferenceMs(
        input.fastestObservedLap,
        comparedLapOnset.boundary.onsetCellIndex,
        fastestObservedLapOnset.boundary.onsetCellIndex,
        contextCellIndexes,
    )
    if (differenceMs === null) {
        return createBrakingOnsetUnavailableResult(input, {
            code: 'TIMELINE_DISCONTINUITY',
            message: 'The benchmark travel time between the two braking onset positions is unavailable.',
        })
    }

    const phenomenon = classifyBrakingOnsetDifference(differenceMs, config)
    if (phenomenon === null) return createBrakingOnsetNotDetectedResult(input, differenceMs)
    return createDetectedBrakingOnsetResult(input, phenomenon, differenceMs, comparedLapOnset.boundary.onsetCellIndex, fastestObservedLapOnset.boundary.onsetCellIndex)
}

function findUnnecessaryBraking(
    input: CoachingPhenomenonInput,
    brakingActivityMasks: BrakingActivityMasks,
    margins: CoachingEvidenceMargins,
): CoachingPhenomenonResult | null {
    const currentCorner = input.regionContext.currentTrackRegion
    if (currentCorner.type !== 'corner') return null

    const previousRegion = input.regionContext.previousTrackRegion
    const straightBeforeCurrentCorner = previousRegion?.type === 'straight'
        ? previousRegion
        : null
    const analysisCellIndexes = getCellIndexes(straightBeforeCurrentCorner, currentCorner)

    const comparedRegionBrakingCells = selectBrakingCells(
        brakingActivityMasks.comparedLapMask,
        analysisCellIndexes,
    )
    const fastestRegionBrakingCells = selectBrakingCells(
        brakingActivityMasks.fastestObservedLapMask,
        analysisCellIndexes,
    )
    const wasBrakeUsedInComparedRegion = hasBraked(comparedRegionBrakingCells)
    const wasBrakeUsedInFastestRegion = hasBraked(fastestRegionBrakingCells)

    if (!wasBrakeUsedInComparedRegion || wasBrakeUsedInFastestRegion) return null

    const areBenchmarkBrakeDataReliable = analysisCellIndexes.every((cellIndex) => {
        const cell = input.fastestObservedLap.cells[cellIndex]
        return cell !== undefined && hasUsableBrakeData(cell)
    })
    if (!areBenchmarkBrakeDataReliable) {
        return createUnnecessaryBrakingUnavailableResult(input, {
            code: 'UNRELIABLE_BENCHMARK_BRAKE_DATA',
            message: 'The fastest observed region pass does not have reliable brake data throughout the preceding straight and current corner.',
        })
    }

    const comparedRegionBrakeOnset = findRelevantBrakeOnset(
        input.comparedLap.cells,
        brakingActivityMasks.comparedLapMask,
        analysisCellIndexes,
    )
    if (comparedRegionBrakeOnset.status !== 'found') {
        return createUnnecessaryBrakingUnavailableResult(
            input,
            createBrakeOnsetLimitation('compared region pass', comparedRegionBrakeOnset),
        )
    }

    const onsetCellIndex = comparedRegionBrakeOnset.boundary.onsetCellIndex
    const timeLossSinceBrakingStartedMs = calculateTimeLossSinceBrakingStartedMs(
        input.comparedLap,
        input.fastestObservedLap,
        onsetCellIndex,
        analysisCellIndexes,
    )
    if (timeLossSinceBrakingStartedMs === null) {
        return createUnnecessaryBrakingUnavailableResult(input, {
            code: 'TIMELINE_DISCONTINUITY',
            message: 'Travel-time loss from the compared region braking onset through the current corner is unavailable.',
        })
    }
    const facts = createUnnecessaryBrakingReportFacts(
        input,
        currentCorner,
        straightBeforeCurrentCorner,
        brakingActivityMasks.comparedLapMask,
        onsetCellIndex,
        analysisCellIndexes,
        timeLossSinceBrakingStartedMs,
    )
    const message = createUnnecessaryBrakingReportMessage(facts, margins)
    if (message === null) return createUnnecessaryBrakingNotDetectedResult(input)

    return createDetectedUnnecessaryBrakingResult(
        input,
        onsetCellIndex,
        facts,
        message,
    )
}

function getCellIndexes(...regions: readonly (TrackRegion | null)[]): readonly number[] {
    return regions.flatMap((region) => region?.cellIndexes ?? [])
}

function selectBrakingCells(brakeActivityMask: readonly boolean[], cellIndexes: readonly number[]): readonly boolean[] {
    return cellIndexes.map((cellIndex) => {
        const isBrakingActive = brakeActivityMask[cellIndex]
        if (isBrakingActive === undefined) {
            throw new RangeError(`Cell index ${cellIndex} is outside the brake activity mask`)
        }
        return isBrakingActive
    })
}

function hasBraked(brakingCells: readonly boolean[]): boolean {
    return brakingCells.includes(true)
}

function calculateTimeLossSinceBrakingStartedMs(comparedLap: CellAlignedRacingLap, fastestObservedLap: CellAlignedRacingLap, onsetCellIndex: number, analysisCellIndexes: readonly number[]): number | null {
    const onsetOffset = analysisCellIndexes.indexOf(onsetCellIndex)
    if (onsetOffset === -1) return null

    const cellIndexesSinceBrakingStarted = analysisCellIndexes.slice(onsetOffset)
    const comparedRegionDurationMs = calculateTravelTimeMs(comparedLap, cellIndexesSinceBrakingStarted)
    const fastestRegionDurationMs = calculateTravelTimeMs(fastestObservedLap, cellIndexesSinceBrakingStarted)
    if (comparedRegionDurationMs === null || fastestRegionDurationMs === null) return null
    return comparedRegionDurationMs - fastestRegionDurationMs
}

function calculateTravelTimeMs(lap: CellAlignedRacingLap, cellIndexes: readonly number[]): number | null {
    let durationMs = 0
    for (const cellIndex of cellIndexes) {
        const cell = lap.cells[cellIndex]
        if (!cell || cell.from.lapElapsedMs === null || cell.to.lapElapsedMs === null || !cell.quality.timelineContinuous) return null
        durationMs += cell.to.lapElapsedMs - cell.from.lapElapsedMs
    }
    return durationMs
}

function createUnnecessaryBrakingReportFacts(
    input: CoachingPhenomenonInput,
    currentCorner: CornerTrackRegion,
    straightBeforeCurrentCorner: StraightTrackRegion | null,
    comparedRegionBrakingMask: readonly boolean[],
    onsetCellIndex: number,
    analysisCellIndexes: readonly number[],
    timeLossSinceBrakingStartedMs: number,
): UnnecessaryBrakingReportFacts {
    const cornerEntryCellIndex = currentCorner.cellIndexes[0]
    const cornerExitCellIndex = currentCorner.cellIndexes.at(-1)
    if (cornerEntryCellIndex === undefined || cornerExitCellIndex === undefined) {
        throw new RangeError('Unnecessary braking report facts require a non-empty corner region')
    }

    const steeringPeakCellIndexes = currentCorner.phases
        .find(({ phase }) => phase === 'apex-proxy')
        ?.cellIndexes ?? []

    return {
        lapNumber: input.comparison.comparedLapNumber,
        cornerId: currentCorner.id,
        hasBrakingStartedBeforeCorner: straightBeforeCurrentCorner
            ?.cellIndexes
            .includes(onsetCellIndex) ?? false,
        maximumBrakeRatio: calculateMaximumBrakeRatio(
            input.comparedLap,
            comparedRegionBrakingMask,
            onsetCellIndex,
            analysisCellIndexes,
        ),
        timeLossSinceBrakingStartedMs,
        entrySpeedDifferenceKmh: calculateSpeedDifferenceKmh(
            input.comparedLap.cells[cornerEntryCellIndex],
            input.fastestObservedLap.cells[cornerEntryCellIndex],
        ),
        steeringPeakSpeedDifferenceKmh: calculateAverageSpeedDifferenceKmh(
            input.comparedLap,
            input.fastestObservedLap,
            steeringPeakCellIndexes,
        ),
        exitSpeedDifferenceKmh: calculateSpeedDifferenceKmh(
            input.comparedLap.cells[cornerExitCellIndex],
            input.fastestObservedLap.cells[cornerExitCellIndex],
        ),
    }
}

function calculateMaximumBrakeRatio(
    lap: CellAlignedRacingLap,
    brakingMask: readonly boolean[],
    onsetCellIndex: number,
    analysisCellIndexes: readonly number[],
): number | null {
    const onsetOffset = analysisCellIndexes.indexOf(onsetCellIndex)
    if (onsetOffset === -1) {
        throw new RangeError('Brake onset cell must belong to the unnecessary-braking analysis region')
    }

    let maximumBrakeRatio: number | null = null
    for (const cellIndex of analysisCellIndexes.slice(onsetOffset)) {
        if (!brakingMask[cellIndex]) break

        const brakeRatio = lap.cells[cellIndex]?.center.brakeRatio
        if (brakeRatio === null || brakeRatio === undefined) return null
        maximumBrakeRatio = Math.max(maximumBrakeRatio ?? brakeRatio, brakeRatio)
    }
    return maximumBrakeRatio
}

function calculateAverageSpeedDifferenceKmh(
    comparedLap: CellAlignedRacingLap,
    fastestObservedLap: CellAlignedRacingLap,
    cellIndexes: readonly number[],
): number | null {
    if (cellIndexes.length === 0) return null

    let speedDifferenceSumKmh = 0
    for (const cellIndex of cellIndexes) {
        const speedDifferenceKmh = calculateSpeedDifferenceKmh(
            comparedLap.cells[cellIndex],
            fastestObservedLap.cells[cellIndex],
        )
        if (speedDifferenceKmh === null) return null
        speedDifferenceSumKmh += speedDifferenceKmh
    }
    return speedDifferenceSumKmh / cellIndexes.length
}

function calculateSpeedDifferenceKmh(
    comparedCell: CellAlignedRacingLapCell | undefined,
    fastestObservedCell: CellAlignedRacingLapCell | undefined,
): number | null {
    if (comparedCell === undefined || fastestObservedCell === undefined) return null
    if (!hasUsableSpeedData(comparedCell) || !hasUsableSpeedData(fastestObservedCell)) return null

    const comparedSpeedKmh = comparedCell.center.speedKmh
    const fastestObservedSpeedKmh = fastestObservedCell.center.speedKmh
    if (comparedSpeedKmh === null || fastestObservedSpeedKmh === null) return null
    return comparedSpeedKmh - fastestObservedSpeedKmh
}

function hasUsableSpeedData(cell: CellAlignedRacingLapCell): boolean {
    return cell.center.speedKmh !== null
        && cell.quality.timelineContinuous
        && !cell.quality.discontinuousChannels.includes('speedKmh')
}

function createDetectedUnnecessaryBrakingResult(
    input: CoachingPhenomenonInput,
    onsetCellIndex: number,
    facts: UnnecessaryBrakingReportFacts,
    message: string,
): CoachingPhenomenonResult {
    const comparedRegionBrakingOnsetTimeMs = input.comparedLap.cells[onsetCellIndex]?.from.lapElapsedMs
    if (comparedRegionBrakingOnsetTimeMs === null || comparedRegionBrakingOnsetTimeMs === undefined) {
        return createUnnecessaryBrakingUnavailableResult(input, {
            code: 'TIMELINE_DISCONTINUITY',
            message: 'The compared region braking onset time is unavailable.',
        })
    }

    const roundedTimeLossMs = Math.round(facts.timeLossSinceBrakingStartedMs)

    return {
        status: 'detected',
        finding: {
            phenomenon: 'UNNECESSARY_BRAKING',
            lapNumber: input.comparison.comparedLapNumber,
            comparedWithLapNumber: input.comparison.fastestObserved.lapNumber,
            analysisRegionId: findBrakingOnsetAnalysisRegionId(input),
            occurredAtLapElapsedMs: comparedRegionBrakingOnsetTimeMs,
            impactTimeLossMs: facts.timeLossSinceBrakingStartedMs,
            message,
            evidence: [{
                channels: ['brakeRatio', 'speedKmh', 'normalizedTrackPosition'],
                message: `Compared region braking onset cell ${onsetCellIndex}; travel-time loss from that cell through ${facts.cornerId}: ${roundedTimeLossMs} ms.`,
            }],
            limitations: [],
        },
    }
}

function createUnnecessaryBrakingNotDetectedResult(input: CoachingPhenomenonInput): CoachingPhenomenonResult {
    return {
        status: 'not-detected',
        phenomenon: 'UNNECESSARY_BRAKING',
        lapNumber: input.comparison.comparedLapNumber,
        comparedWithLapNumber: input.comparison.fastestObserved.lapNumber,
        analysisRegionId: findBrakingOnsetAnalysisRegionId(input),
    }
}

function createUnnecessaryBrakingUnavailableResult(input: CoachingPhenomenonInput, limitation: AnalysisLimitation): CoachingPhenomenonResult {
    return {
        status: 'unavailable',
        phenomenon: 'UNNECESSARY_BRAKING',
        lapNumber: input.comparison.comparedLapNumber,
        comparedWithLapNumber: input.comparison.fastestObserved.lapNumber,
        analysisRegionId: findBrakingOnsetAnalysisRegionId(input),
        limitations: [limitation],
    }
}

function createBrakeOnsetLimitation(lapDescription: string, onset: Exclude<BrakeOnsetResult, { status: 'found' }>): AnalysisLimitation {
    if (onset.status === 'not-found') {
        return {
            code: 'BRAKE_ONSET_DETECTION_UNAVAILABLE',
            message: `No new confirmed braking run starts in the ${lapDescription} region context.`,
        }
    }

    return {
        code: 'BRAKE_ONSET_DETECTION_UNAVAILABLE',
        message: `The ${lapDescription} braking onset crosses unreliable brake data between cells ${onset.boundaryCellIndexes[0]} and ${onset.boundaryCellIndexes[1]}.`,
    }
}

function createBrakingOnsetNotDetectedResult(input: CoachingPhenomenonInput, differenceMs: number): CoachingPhenomenonResult {
    const phenomenon = differenceMs < 0 ? 'EARLY_BRAKING' : 'LATE_BRAKING'
    return {
        status: 'not-detected',
        phenomenon,
        lapNumber: input.comparison.comparedLapNumber,
        comparedWithLapNumber: input.comparison.fastestObserved.lapNumber,
        analysisRegionId: findBrakingOnsetAnalysisRegionId(input),
    }
}

function createDetectedBrakingOnsetResult(input: CoachingPhenomenonInput, phenomenon: Extract<CoachingPhenomenon, 'LATE_BRAKING' | 'EARLY_BRAKING'>, differenceMs: number, comparedOnsetCellIndex: number, fastestObservedOnsetCellIndex: number): CoachingPhenomenonResult {
    const occurredAtLapElapsedMs = input.comparedLap.cells[comparedOnsetCellIndex]?.from.lapElapsedMs
    if (occurredAtLapElapsedMs === null || occurredAtLapElapsedMs === undefined) {
        return createBrakingOnsetUnavailableResult(input, {
            code: 'TIMELINE_DISCONTINUITY',
            message: 'The compared lap braking onset time is unavailable.',
        })
    }

    const absoluteDifferenceMs = Math.round(Math.abs(differenceMs))
    const direction = phenomenon === 'LATE_BRAKING' ? 'later' : 'earlier'
    return {
        status: 'detected',
        finding: {
            phenomenon,
            lapNumber: input.comparison.comparedLapNumber,
            comparedWithLapNumber: input.comparison.fastestObserved.lapNumber,
            analysisRegionId: findBrakingOnsetAnalysisRegionId(input),
            occurredAtLapElapsedMs,
            impactTimeLossMs: input.comparison.fastestObserved.comparedLapMinusObservedPassMs,
            message: `Braking started approximately ${absoluteDifferenceMs} ms ${direction} than the fastest observed pass in lap ${input.comparison.fastestObserved.lapNumber}.`,
            evidence: [{
                channels: ['brakeRatio', 'normalizedTrackPosition'],
                message: `Compared lap onset cell ${comparedOnsetCellIndex}; fastest observed onset cell ${fastestObservedOnsetCellIndex}; benchmark travel-time difference ${Math.round(differenceMs)} ms.`,
            }],
            limitations: [],
        },
    }
}

function createBrakingOnsetUnavailableResult(input: CoachingPhenomenonInput, limitation: Extract<CoachingPhenomenonResult, { status: 'unavailable' }>['limitations'][number]): CoachingPhenomenonResult {
    return {
        status: 'unavailable',
        phenomenon: 'LATE_BRAKING',
        lapNumber: input.comparison.comparedLapNumber,
        comparedWithLapNumber: input.comparison.fastestObserved.lapNumber,
        analysisRegionId: findBrakingOnsetAnalysisRegionId(input),
        limitations: [limitation],
    }
}

function findBrakingOnsetAnalysisRegionId(input: CoachingPhenomenonInput): CoachingAnalysisRegionId {
    const currentTrackRegion = input.regionContext.currentTrackRegion
    if (currentTrackRegion.type !== 'corner') {
        return currentTrackRegion.id
    }

    return currentTrackRegion.phases
        .find(({ phase }) => phase === 'entry')?.id ?? currentTrackRegion.id
}
