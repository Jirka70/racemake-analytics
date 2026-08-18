import { describe, expect, test } from "bun:test";
import { analysisUsabilitySchema } from "../../../src/http/schemas/analysis-usability";

const BASE_USABILITY = {
	primaryReason: null,
	reasons: [],
	availableCapabilities: [
		"lap-comparison",
		"region-comparison",
		"ideal-lap",
		"coaching",
	],
	unavailableCapabilities: [],
} as const;

describe("analysis usability schema", () => {
	test("accepts only the two public usability states", () => {
		expect(
			analysisUsabilitySchema.safeParse({
				...BASE_USABILITY,
				status: "usable",
			}).success,
		).toBe(true);
		expect(
			analysisUsabilitySchema.safeParse({
				...BASE_USABILITY,
				status: "unavailable",
			}).success,
		).toBe(true);
	});

	test("rejects the removed limited and unusable states", () => {
		for (const status of ["limited", "unusable"]) {
			expect(
				analysisUsabilitySchema.safeParse({
					...BASE_USABILITY,
					status,
				}).success,
			).toBe(false);
		}
	});
});
