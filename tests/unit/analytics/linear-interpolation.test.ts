import { describe, expect, test } from 'bun:test'
import { linearInterpolate } from '../../../src/analytics/util/linear-interpolation'

describe('linearInterpolate', () => {
    test('interpolates endpoints and values between them', () => {
        expect(linearInterpolate(10, 20, 0)).toBe(10)
        expect(linearInterpolate(10, 20, 0.25)).toBe(12.5)
        expect(linearInterpolate(10, 20, 1)).toBe(20)
    })
})
