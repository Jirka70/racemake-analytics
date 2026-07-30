import type { LapDetectionResult } from '../lap-detect/lap-detect-types'
import type { SelectedCornerDetectionLap } from './corner-lap-selection-types'

export function selectCornerDetectionLaps(lapDetection: LapDetectionResult): SelectedCornerDetectionLap[] {
    const supportByLapId = new Map(lapDetection.lapGridSupport.map((support) => [support.lapId, support]))
    const selectedLaps: SelectedCornerDetectionLap[] = []

    for (const lap of lapDetection.laps) {
        if (!lap.realRacingLap) continue

        const support = supportByLapId.get(lap.id)
        if (!support) throw new Error(`Missing corner-detection grid support for ${lap.id}`)

        selectedLaps.push({
            lap,
            eligibility: lap.cornerModelEligible 
                ? 'corner-eligible' 
                : 'real-racing-lap',
            supportedCellMask: support.cornerDetectionSupportedCellMask,
        })
    }

    return selectedLaps
}
