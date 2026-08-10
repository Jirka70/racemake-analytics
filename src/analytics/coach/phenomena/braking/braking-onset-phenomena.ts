import type { CellAlignedRacingLap, CellAlignedRacingLapCell } from '../../cell-aligned-racing-telemetry-types'
import type { AnalysisLimitation, CoachingAnalysisRegionId, CoachingPhenomenon, CoachingPhenomenonDetector, CoachingPhenomenonInput, CoachingPhenomenonResult } from '../coaching-phenomenon-types'
import type { BrakeActivityThresholdResult } from './brake-activity-thresholds'
import { DEFAULT_BRAKING_ONSET_PHENOMENON_CONFIG, type BrakingOnsetPhenomenonConfig } from './braking-onset-config'
import { createBrakeActivityMask } from './create-brake-activity-mask'

interface BrakingActivityMasks {
    readonly comparedLapMask: readonly boolean[]
    readonly fastestObservedLapMask: readonly boolean[]
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

export function createBrakingOnsetDetector(thresholds: BrakeActivityThresholdResult, config: BrakingOnsetPhenomenonConfig = DEFAULT_BRAKING_ONSET_PHENOMENON_CONFIG): CoachingPhenomenonDetector {
    return {
        phenomena: ['LATE_BRAKING', 'EARLY_BRAKING'],
        channelRequirements: {
            requiredChannels: ['brakeRatio'],
            supportingChannels: ['speedKmh'],
        },
        isApplicable: isBrakingOnsetApplicable,
        find: (input) => findBrakingOnsetPhenomenon(input, thresholds, config),
    }
}

function isBrakingOnsetApplicable(input: CoachingPhenomenonInput): boolean {
    const currentTrackRegionIsCorner = input.regionContext.currentTrackRegion.type === 'corner'
    const comparesDifferentLaps = input.comparedLap.lapNumber !== input.fastestObservedLap.lapNumber
    return currentTrackRegionIsCorner && comparesDifferentLaps
}

function findBrakingOnsetPhenomenon(input: CoachingPhenomenonInput, thresholds: BrakeActivityThresholdResult, config: BrakingOnsetPhenomenonConfig): CoachingPhenomenonResult {
    if (thresholds.status === 'unavailable') {
        return createBrakingOnsetUnavailableResult(input, {
            code: 'BRAKE_ACTIVITY_THRESHOLD_UNAVAILABLE' as const,
            message: `Brake activity threshold is unavailable: ${thresholds.reason}.`,
        })
    }

    const brakingActivityMasks = createBrakingActivityMasks(input, thresholds.highThresholdRatio, thresholds.lowThresholdRatio)
    return findBrakingOnsetPhenomenonFromActivityMasks(input, brakingActivityMasks, config)
}

function createBrakingActivityMasks(input: CoachingPhenomenonInput, highThresholdRatio: number, lowThresholdRatio: number): BrakingActivityMasks {
    return {
        comparedLapMask: createBrakeActivityMask(input.comparedLap, highThresholdRatio, lowThresholdRatio),
        fastestObservedLapMask: createBrakeActivityMask(input.fastestObservedLap, highThresholdRatio, lowThresholdRatio),
    }
}

function findBrakingOnsetPhenomenonFromActivityMasks(input: CoachingPhenomenonInput, brakingActivityMasks: BrakingActivityMasks, config: BrakingOnsetPhenomenonConfig): CoachingPhenomenonResult {
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
            confidence: 1,
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
