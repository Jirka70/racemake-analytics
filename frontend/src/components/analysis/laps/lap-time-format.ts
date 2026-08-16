export function formatLapTimeMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new RangeError('Lap duration must be a finite non-negative number')
  }

  const roundedDurationMs = Math.round(durationMs)
  const minutes = Math.floor(roundedDurationMs / 60_000)
  const remainingMs = roundedDurationMs - minutes * 60_000
  const seconds = Math.floor(remainingMs / 1_000)
  const milliseconds = remainingMs - seconds * 1_000

  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds
    .toString()
    .padStart(3, '0')}`
}

export function formatLapDeltaMs(deltaMs: number): string {
  if (!Number.isFinite(deltaMs)) {
    throw new RangeError('Lap delta must be finite')
  }

  const roundedDeltaMs = Math.round(deltaMs)
  const sign = roundedDeltaMs >= 0 ? '+' : '−'

  return `${sign}${(Math.abs(roundedDeltaMs) / 1_000).toFixed(3)} s`
}
