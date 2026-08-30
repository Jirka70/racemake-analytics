import type { OtsuDiagnostics, OtsuResult } from '../otsu'
import { interquartileRange, median, medianAbsoluteDeviation } from '../robust-statistics'
import type { SteeringStrengthProfile } from './create-steering-strength-profile'
import { requireFiniteResult } from '../util/require-finite-result'

export type LowerClassSpreadSource = 'MAD' | 'HALF_IQR' | 'ZERO_SPREAD'

export type SteeringStrengthThresholdResult =
    | {
        readonly status: 'calculated'
        readonly highThresholdDegrees: number
        readonly lowThresholdDegrees: number
        readonly lowerClassMedianDegrees: number
        readonly lowerClassSpreadDegrees: number
        readonly lowerClassSpreadSource: LowerClassSpreadSource
        readonly otsuDiagnostics: OtsuDiagnostics
    }
    | {
        readonly status: 'unavailable'
        readonly reason: 'EMPTY_SAMPLE' | 'CONSTANT_SAMPLE'
        readonly sampleCount: number
    }

export function deriveSteeringStrengthThresholds(profile: SteeringStrengthProfile, otsu: OtsuResult): SteeringStrengthThresholdResult {
    if (otsu.status === 'unavailable') return otsu

    const highThresholdDegrees = requireFiniteResult(Math.expm1(otsu.threshold), 'otsu')
    const lowerClass = profile.cells.flatMap(({ steeringStrengthDegrees }) => steeringStrengthDegrees !== null && steeringStrengthDegrees <= highThresholdDegrees ? [steeringStrengthDegrees] : [])
    const lowerClassMedianDegrees = median(lowerClass)
    const madDegrees = medianAbsoluteDeviation(lowerClass)
    const iqrDegrees = madDegrees === 0
        ? interquartileRange(lowerClass)
        : 0
    const { spreadDegrees: lowerClassSpreadDegrees, source: lowerClassSpreadSource } = deriveLowerClassSpread(madDegrees, iqrDegrees)
    const lowThresholdDegrees = lowerClassSpreadDegrees > 0
        ? Math.min(
            highThresholdDegrees,
            requireFiniteResult(
                lowerClassMedianDegrees + lowerClassSpreadDegrees,
                'robust-threshold',
            ),
        )
        : highThresholdDegrees

    return {
        status: 'calculated',
        highThresholdDegrees,
        lowThresholdDegrees,
        lowerClassMedianDegrees,
        lowerClassSpreadDegrees,
        lowerClassSpreadSource,
        otsuDiagnostics: otsu.diagnostics,
    }
}

function deriveLowerClassSpread(madDegrees: number, iqrDegrees: number): { spreadDegrees: number, source: LowerClassSpreadSource } {
    if (madDegrees > 0) return { spreadDegrees: madDegrees, source: 'MAD' }
    if (iqrDegrees > 0) return { spreadDegrees: iqrDegrees / 2, source: 'HALF_IQR' }
    return { spreadDegrees: 0, source: 'ZERO_SPREAD' }
}
