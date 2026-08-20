import { describe, expect, test } from 'bun:test'
import { API_ERRORS } from '../../../src/http/api-errors'
import { HTTP_STATUS } from '../../../src/http/http-status'

describe('API_ERRORS', () => {
  test('assigns the documented HTTP status to each public error', () => {
    expect(API_ERRORS.MALFORMED_JSON.status).toBe(HTTP_STATUS.BAD_REQUEST)
    expect(API_ERRORS.INVALID_TELEMETRY_PAYLOAD.status).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY)
    expect(API_ERRORS.TELEMETRY_PAYLOAD_TOO_LARGE.status).toBe(HTTP_STATUS.CONTENT_TOO_LARGE)
    expect(API_ERRORS.ANALYSIS_ID_REQUIRED.status).toBe(HTTP_STATUS.BAD_REQUEST)
    expect(API_ERRORS.ANALYSIS_NOT_FOUND.status).toBe(HTTP_STATUS.NOT_FOUND)
    expect(API_ERRORS.INVALID_QUERY.status).toBe(HTTP_STATUS.BAD_REQUEST)
    expect(API_ERRORS.INTERNAL_ERROR.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  })
})
