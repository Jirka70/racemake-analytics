import { describe, expect, test } from "bun:test";
import {
	requireFiniteResult,
	UnsafeTelemetryComputationError,
} from "../../../src/analytics/util/require-finite-result";

describe("requireFiniteResult", () => {
	test("returns finite results unchanged", () => {
		expect(requireFiniteResult(42.5, "signal-rate")).toBe(42.5);
	});

	test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
		"rejects a non-finite result without exposing it downstream",
		(value) => {
			expect(() => requireFiniteResult(value, "signal-residual")).toThrow(
				UnsafeTelemetryComputationError,
			);

			try {
				requireFiniteResult(value, "signal-residual");
			} catch (error: unknown) {
				expect(error).toMatchObject({
					name: "UnsafeTelemetryComputationError",
					code: "UNSAFE_TELEMETRY_COMPUTATION",
					operation: "signal-residual",
				});
			}
		},
	);
});
