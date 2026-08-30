import { describe, expect, test } from "bun:test";
import { ApiError } from "../../../frontend/src/api/api-client";
import { findIngestErrorMessage } from "../../../frontend/src/upload/ingest-error-message";

describe("findIngestErrorMessage", () => {
	test("shows the public safe-telemetry message without exposing the internal operation", () => {
		const publicMessage =
			"Some speed or steering measurements could not be analyzed reliably, so this stint was not processed.";

		expect(
			findIngestErrorMessage(
				new ApiError(422, "UNSAFE_TELEMETRY_VALUES", publicMessage),
			),
		).toBe(publicMessage);
		expect(publicMessage).not.toContain("linear-interpolation");
		expect(publicMessage).not.toContain("UNSAFE_TELEMETRY_COMPUTATION");
	});
});
