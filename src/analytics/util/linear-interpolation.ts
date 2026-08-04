export function linearInterpolate(fromValue: number, toValue: number, fraction: number): number {
    return fromValue + fraction * (toValue - fromValue)
}
