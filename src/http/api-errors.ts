import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { HTTP_STATUS } from './http-status'

interface ApiErrorDefinition {
  readonly code: string
  readonly status: ContentfulStatusCode
  readonly message: string
}

export const API_ERRORS = {
  MALFORMED_JSON: {
    code: 'MALFORMED_JSON',
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'Request body must contain valid JSON',
  },
  INVALID_TELEMETRY_PAYLOAD: {
    code: 'INVALID_TELEMETRY_PAYLOAD',
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    message: 'Telemetry payload does not match the wire contract',
  },
  TELEMETRY_PAYLOAD_TOO_LARGE: {
    code: 'TELEMETRY_PAYLOAD_TOO_LARGE',
    status: HTTP_STATUS.CONTENT_TOO_LARGE,
    message: 'Telemetry payload must not exceed 100 MB',
  },
  ANALYSIS_ID_REQUIRED: {
    code: 'ANALYSIS_ID_REQUIRED',
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'Provide an analysisId returned by POST /ingest',
  },
  ANALYSIS_NOT_FOUND: {
    code: 'ANALYSIS_NOT_FOUND',
    status: HTTP_STATUS.NOT_FOUND,
    message: 'The requested analysis does not exist',
  },
  INVALID_QUERY: {
    code: 'INVALID_QUERY',
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'Request query parameters are invalid',
  },
  NO_ACTIVE_DATASET: {
    code: 'NO_ACTIVE_DATASET',
    status: HTTP_STATUS.CONFLICT,
    message: 'Ingest a valid telemetry dataset before requesting laps',
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: 'Unexpected internal error',
  },
} as const satisfies Record<string, ApiErrorDefinition>

export type ApiErrorCode = keyof typeof API_ERRORS

export interface ApiValidationIssue {
  /** Dot-notation location such as `session_id`, `frame_count`, or `frames.42.brk`. */
  readonly path: string
  readonly message: string
}

export interface ApiErrorResponse {
  readonly error: {
    readonly code: ApiErrorCode
    readonly message: string
    readonly issues?: readonly ApiValidationIssue[]
  }
}
