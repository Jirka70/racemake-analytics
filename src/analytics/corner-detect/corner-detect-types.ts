export interface SteeringShapePeak {
    readonly cellIndex: number
    readonly cellCenter: number
    readonly steeringStrengthDegrees: number
}

export interface SteeringShapeValley {
    readonly cellIndex: number
    readonly cellCenter: number
    readonly steeringStrengthDegrees: number
}

export interface PeakValleyPeak {
    readonly leftPeak: SteeringShapePeak
    readonly valley: SteeringShapeValley
    readonly rightPeak: SteeringShapePeak
}
