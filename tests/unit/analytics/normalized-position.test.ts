import { describe, expect, test } from 'bun:test'
import { calculateForwardPositionDelta } from '../../../src/analytics/util/normalized-position'

describe('calculateForwardPositionDelta', () => {
    test('keeps forward movement and unwraps only a start-finish crossing', () => {
        expect(calculateForwardPositionDelta(0.2, 0.3)).toBeCloseTo(0.1)
        expect(calculateForwardPositionDelta(0.99, 0.01)).toBeCloseTo(0.02)
    })

    test('keeps reverse movement negative instead of treating it as a wrap', () => {
        expect(calculateForwardPositionDelta(0.4, 0.39)).toBeCloseTo(-0.01)
    })
})
