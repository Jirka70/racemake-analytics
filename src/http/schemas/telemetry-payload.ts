import { z } from 'zod'
import type {
  WireTelemetryFrame,
  WireTelemetryPayload,
  WireTelemetryRecorder,
  WireTyres,
} from '../../analytics/telemetry-types'

const INT16_MIN = -32_768
const INT16_MAX = 32_767

// Zod 4 rejects NaN and infinite values in z.number() by default.
const finiteNumberSchema = z.number()
const int16Schema = z.int().min(INT16_MIN).max(INT16_MAX)
const int32Schema = z.int32()

/**
 * Tyre temperatures are still in the recorder's fixed-point wire format here.
 * Conversion to Celsius belongs to the normalization step, not input parsing.
 */
export const wireTyresSchema: z.ZodType<WireTyres> = z.strictObject({
  fl: int16Schema,
  fr: int16Schema,
  rl: int16Schema,
  rr: int16Schema,
})

/**
 * Structural contract emitted by official/recorder.rs.
 *
 * Physical plausibility that depends on neighbouring frames (sensor spikes,
 * timestamp continuity, or position regressions) is intentionally handled by
 * the later telemetry audit so it can produce evidence-rich diagnostics.
 */
export const wireTelemetryFrameSchema: z.ZodType<WireTelemetryFrame> =
  z.strictObject({
    ts: z.int().nonnegative(),
    lap: int32Schema,
    pos: finiteNumberSchema.min(0).max(1),
    spd: finiteNumberSchema.nonnegative(),
    thr: finiteNumberSchema.min(0).max(1),
    brk: finiteNumberSchema.min(0).max(1),
    str: finiteNumberSchema,
    gear: z.int().min(-1).max(8),
    rpm: int32Schema.nonnegative(),
    tyres: wireTyresSchema,
  })

export const telemetryRecorderSchema: z.ZodType<WireTelemetryRecorder> =
  z.strictObject({
    name: z.string().min(1),
    version: z.string().min(1),
  })

/**
 * Versioned HTTP payload accepted by POST /ingest.
 *
 * The schema is strict because it represents the explicit v1 wire contract.
 * A future payload version should receive its own schema instead of silently
 * accepting fields with unknown semantics.
 */
export const telemetryPayloadSchema: z.ZodType<WireTelemetryPayload> = z
  .strictObject({
    schema: z.literal('racemake.telemetry.stint.v1'),
    recorder: telemetryRecorderSchema,
    session_id: z.uuid(),
    note: z.string(),
    frame_count: z.int().positive(),
    frames: z.array(wireTelemetryFrameSchema).min(1),
  })
  .superRefine((payload, context) => {
    if (payload.frame_count !== payload.frames.length) {
      context.addIssue({
        code: 'custom',
        path: ['frame_count'],
        message: 'frame_count must equal the number of frames',
      })
    }
  })

export type {
  WireTelemetryFrame,
  WireTelemetryPayload as TelemetryPayload,
  WireTelemetryRecorder as TelemetryRecorder,
  WireTyres,
} from '../../analytics/telemetry-types'
