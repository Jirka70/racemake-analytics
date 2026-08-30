import { requireFiniteResult } from './require-finite-result'

export function linearInterpolate(fromValue: number, toValue: number, fraction: number): number {
    return requireFiniteResult(
        fromValue + fraction * (toValue - fromValue),
        'linear-interpolation',
    )
}
