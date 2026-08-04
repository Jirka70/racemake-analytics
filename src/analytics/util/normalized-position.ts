export function calculateForwardPositionDelta(previousPosition: number, currentPosition: number): number {
    const rawDelta = currentPosition - previousPosition
    return rawDelta < -0.5 ? rawDelta + 1 : rawDelta
}
