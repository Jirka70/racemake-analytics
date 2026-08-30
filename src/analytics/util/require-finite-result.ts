export type UnsafeTelemetryOperation =
	| "linear-interpolation"
	| "signal-residual"
	| "signal-rate"
	| "robust-threshold"
	| "savitzky-golay"
	| "steering-log-transform"
	| "otsu";

/**
 * Internal invariant failure. The operation is retained for logs and tests,
 * but must never be exposed through the public API.
 */
export class UnsafeTelemetryComputationError extends RangeError {
	readonly code = "UNSAFE_TELEMETRY_COMPUTATION" as const;

	constructor(readonly operation: UnsafeTelemetryOperation) {
		super(`Telemetry operation "${operation}" produced a non-finite result`);
		this.name = "UnsafeTelemetryComputationError";
	}
}

export function requireFiniteResult(
	value: number,
	operation: UnsafeTelemetryOperation,
): number {
	if (!Number.isFinite(value)) {
		throw new UnsafeTelemetryComputationError(operation);
	}

	return value;
}
