import { calculateOtsuThreshold, type OtsuDiagnostics } from '../../../otsu'
import { interquartileRange, median, medianAbsoluteDeviation } from '../../../robust-statistics'
import type { CellAlignedRacingTelemetry, CellAlignedRacingLapCell } from '../../cell-aligned-racing-telemetry-types'

export type BrakeLowerClassSpreadSource = 'MAD' | 'HALF_IQR' | 'ZERO_SPREAD'

export type BrakeActivityThresholdResult =
    | {
        readonly status: 'calculated'
        readonly highThresholdRatio: number
        readonly lowThresholdRatio: number
        readonly lowerClassMedianRatio: number
        readonly lowerClassSpreadRatio: number
        readonly lowerClassSpreadSource: BrakeLowerClassSpreadSource
        readonly otsuDiagnostics: OtsuDiagnostics
    }
    | {
        readonly status: 'unavailable'
        readonly reason: 'EMPTY_SAMPLE' | 'CONSTANT_SAMPLE'
        readonly sampleCount: number
    }

export function calculateBrakeActivityThreshold(telemetry: CellAlignedRacingTelemetry): BrakeActivityThresholdResult {
    const brakeRatios = telemetry.laps.flatMap(({ cells }) => cells.flatMap(findUsableBrakeRatio))
    const otsu = calculateOtsuThreshold(brakeRatios)
    if (otsu.status === 'unavailable') return otsu

    const highThresholdRatio = otsu.threshold
    const lowerClass = brakeRatios.filter((brakeRatio) => brakeRatio <= highThresholdRatio)
    const lowerClassMedianRatio = median(lowerClass)
    const madRatio = medianAbsoluteDeviation(lowerClass)
    let iqrRatio = 0
    if (madRatio === 0) iqrRatio = interquartileRange(lowerClass)

    const lowerClassSpread = deriveLowerClassSpread(madRatio, iqrRatio)
    let lowThresholdRatio = highThresholdRatio
    if (lowerClassSpread.ratio > 0) {
        lowThresholdRatio = Math.min(highThresholdRatio, lowerClassMedianRatio + lowerClassSpread.ratio)
    }

    return {
        status: 'calculated',
        highThresholdRatio,
        lowThresholdRatio,
        lowerClassMedianRatio,
        lowerClassSpreadRatio: lowerClassSpread.ratio,
        lowerClassSpreadSource: lowerClassSpread.source,
        otsuDiagnostics: otsu.diagnostics,
    }
}

function findUsableBrakeRatio(cell: CellAlignedRacingLapCell): number[] {
    const brakeRatio = cell.center.brakeRatio
    if (brakeRatio === null || !cell.quality.timelineContinuous) return []
    if (cell.quality.discontinuousChannels.includes('brakeRatio')) return []
    return [brakeRatio]
}

function deriveLowerClassSpread(madRatio: number, iqrRatio: number): { ratio: number, source: BrakeLowerClassSpreadSource } {
    if (madRatio > 0) return { ratio: madRatio, source: 'MAD' }
    if (iqrRatio > 0) return { ratio: iqrRatio / 2, source: 'HALF_IQR' }
    return { ratio: 0, source: 'ZERO_SPREAD' }
}
