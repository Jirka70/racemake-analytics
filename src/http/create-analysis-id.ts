import type { WireTelemetryPayload } from '../analytics/telemetry-types'
import type { AnalysisId } from './contracts/analysis'

export function createAnalysisId(
  payload: WireTelemetryPayload,
): AnalysisId {
  const canonicalPayload = JSON.stringify([
    payload.schema,
    payload.recorder.name,
    payload.recorder.version,
    payload.session_id,
    payload.note,
    payload.frame_count,
    payload.frames.map((frame) => [
      frame.ts,
      frame.lap,
      frame.pos,
      frame.spd,
      frame.thr,
      frame.brk,
      frame.str,
      frame.gear,
      frame.rpm,
      frame.tyres.fl,
      frame.tyres.fr,
      frame.tyres.rl,
      frame.tyres.rr,
    ]),
  ])
  const digest = new Bun.CryptoHasher('sha256')
    .update(canonicalPayload)
    .digest('hex')

  return `sha256:${digest}`
}
