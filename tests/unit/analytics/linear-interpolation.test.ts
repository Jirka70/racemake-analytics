import { describe, expect, test } from 'bun:test'
import { linearInterpolate } from '../../../src/analytics/util/linear-interpolation'
import { UnsafeTelemetryComputationError } from '../../../src/analytics/util/require-finite-result'

describe('linearInterpolate', () => {
    test('interpolates endpoints and values between them', () => {
        expect(linearInterpolate(10, 20, 0)).toBe(10)
        expect(linearInterpolate(10, 20, 0.25)).toBe(12.5)
        expect(linearInterpolate(10, 20, 1)).toBe(20)
    })

    test('rejects a non-finite interpolation result', () => {
        expect(() => linearInterpolate(Number.MAX_VALUE, -Number.MAX_VALUE, 0.5))
            .toThrow(UnsafeTelemetryComputationError)
    })
})
