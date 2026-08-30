import { interquartileRange, median, scaledMedianAbsoluteDeviation } from '../robust-statistics'
import type { TrackSteeringProfile } from './create-track-steering-profile'
import type { SmoothedTrackSteeringProfile } from './smooth-track-steering-profile'
import { requireFiniteResult } from '../util/require-finite-result'

const NORMAL_DISTRIBUTION_IQR_SCALE_FACTOR = 1.349

export function computeProfileResidualRequirement(profile: TrackSteeringProfile, smoothedProfile: SmoothedTrackSteeringProfile, noiseMultiplier: number): number {
    if (!Number.isFinite(noiseMultiplier) || noiseMultiplier < 0) throw new RangeError('Noise multiplier must be a finite non-negative number')
    if (profile.cells.length !== smoothedProfile.cells.length) throw new RangeError('Steering profiles must contain the same number of cells')

    const residualsLog = profile.cells.flatMap(({ signedMedianSteeringDegrees }, cellIndex) => {
        const smoothedSignedSteeringDegrees = smoothedProfile.cells[cellIndex]?.smoothedSignedSteeringDegrees
        if (signedMedianSteeringDegrees === null 
            || smoothedSignedSteeringDegrees === null 
            || smoothedSignedSteeringDegrees === undefined) return []
        const originalStrengthLog = requireFiniteResult(
            Math.log1p(Math.abs(signedMedianSteeringDegrees)),
            'steering-log-transform',
        )
        const smoothedStrengthLog = requireFiniteResult(
            Math.log1p(Math.abs(smoothedSignedSteeringDegrees)),
            'steering-log-transform',
        )
        return [requireFiniteResult(
            Math.abs(originalStrengthLog - smoothedStrengthLog),
            'signal-residual',
        )]
    })
    const residualMedianLog = median(residualsLog)
    const residualSpreadLog = computeResidualSpreadLog(residualsLog)
    return requireFiniteResult(
        residualMedianLog + noiseMultiplier * residualSpreadLog,
        'robust-threshold',
    )
}

function computeResidualSpreadLog(residualsLog: readonly number[]): number {
    const scaledMadLog = scaledMedianAbsoluteDeviation(residualsLog)
    if (scaledMadLog > 0) return scaledMadLog

    const iqrLog = interquartileRange(residualsLog)
    if (iqrLog > 0) return iqrLog / NORMAL_DISTRIBUTION_IQR_SCALE_FACTOR
    return 0
}
