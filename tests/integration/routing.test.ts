import { describe, expect, test } from 'bun:test'
import { createApp } from '../../src/app'
import { HTTP_STATUS } from '../../src/http/http-status'

describe('application routing', () => {
  test('returns a JSON 404 for misspelled GET and POST endpoints', async () => {
    const app = createApp()
    const expectedError = {
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'The requested endpoint does not exist',
      },
    }

    for (const request of [
      { method: 'GET', path: '/lapz' },
      { method: 'POST', path: '/ingets' },
    ] as const) {
      const response = await app.request(request.path, {
        method: request.method,
      })

      expect(response.status).toBe(HTTP_STATUS.NOT_FOUND)
      expect(response.headers.get('content-type')).toContain(
        'application/json',
      )
      expect(await response.json()).toEqual(expectedError)
    }
  })

  test('registers only the supported browser routes as SPA fallbacks', () => {
    const frontendGetPaths = createApp().routes
      .filter(({ method }) => method === 'GET')
      .map(({ path }) => path)

    expect(frontendGetPaths).toContain('/')
    expect(frontendGetPaths).toContain('/analysis/:analysisId')
    expect(frontendGetPaths).not.toContain('*')
  })
})
