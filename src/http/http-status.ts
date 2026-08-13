import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Named HTTP statuses used by this service.
 *
 * Keep this list intentionally small and add a status only when the application
 * actually returns it.
 */
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const satisfies Record<string, ContentfulStatusCode>
