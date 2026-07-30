import type { DetectedLap } from '../lap-detect/lap-detect-types'

export interface SelectedCornerDetectionLap {
    readonly lap: DetectedLap
    readonly eligibility: 'corner-eligible' | 'real-racing-lap'
    // False means that this lap must not contribute in the corresponding grid cell.
    readonly supportedCellMask: readonly boolean[]
}
