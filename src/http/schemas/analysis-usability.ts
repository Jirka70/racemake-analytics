import { z } from "zod";
import type {
	AnalysisUsability,
	AnalysisUsabilityReason,
	RejectedLap,
} from "../../application/analysis-usability";
import type { LapEligibilityReason } from "../../analytics/lap-detect/lap-detect-types";

const minimumEligibilityReasonSchema = z.strictObject({
	code: z.enum([
		"BOUNDARY_CONFIDENCE_BELOW_MINIMUM",
		"LAP_TIME_CONFIDENCE_BELOW_MINIMUM",
		"POSITION_COVERAGE_BELOW_MINIMUM",
		"MOVEMENT_OBSERVATION_BELOW_MINIMUM",
		"MOVING_TIME_BELOW_MINIMUM",
		"STEERING_COVERAGE_BELOW_MINIMUM",
	]),
	observedValue: z.number(),
	requiredMinimum: z.number(),
});

const maximumEligibilityReasonSchema = z.strictObject({
	code: z.enum([
		"POSITION_HOLE_EXCEEDS_MAXIMUM",
		"STATIONARY_INTERVAL_EXCEEDS_MAXIMUM",
		"STEERING_HOLE_EXCEEDS_MAXIMUM",
	]),
	observedValue: z.number(),
	allowedMaximum: z.number(),
});

const lapEligibilityReasonSchema: z.ZodType<LapEligibilityReason> = z.union([
	minimumEligibilityReasonSchema,
	maximumEligibilityReasonSchema,
	z.strictObject({
		code: z.literal("NON_POSITIVE_LAP_TIME"),
		lapTimeMs: z.number(),
	}),
	z.strictObject({
		code: z.enum([
			"TIME_ELIGIBILITY_REQUIRED",
			"REAL_RACING_ELIGIBILITY_REQUIRED",
		]),
	}),
	z.strictObject({
		code: z.literal("SAMPLING_GAP_WITHIN_LAP"),
	}),
]);

const rejectedLapSchema: z.ZodType<RejectedLap> = z.strictObject({
	lapNumber: z.int().positive(),
	reasons: z.array(lapEligibilityReasonSchema),
});

const timelineDiscontinuityEvidenceSchema = z.strictObject({
	type: z.enum(["sampling-gap", "timestamp-regression"]),
	fromTimestampMs: z.number(),
	toTimestampMs: z.number(),
	durationMs: z.number().nonnegative(),
	affectedLapNumber: z.int().positive().optional(),
});

export const analysisUsabilityReasonSchema: z.ZodType<AnalysisUsabilityReason> =
	z.discriminatedUnion("code", [
		z.strictObject({
			code: z.literal("USABLE_TIMELINE_UNAVAILABLE"),
			severity: z.literal("blocking"),
			evidence: z.strictObject({}),
		}),
		z.strictObject({
			code: z.literal("NO_COMPLETE_LAPS"),
			severity: z.literal("blocking"),
			evidence: z.strictObject({
				detectedCrossingCount: z.int().nonnegative(),
			}),
		}),
		z.strictObject({
			code: z.literal("POSITION_GRID_UNAVAILABLE"),
			severity: z.literal("blocking"),
			evidence: z.strictObject({}),
		}),
		z.strictObject({
			code: z.literal("INSUFFICIENT_RACING_LAPS"),
			severity: z.literal("blocking"),
			evidence: z.strictObject({
				detectedLapCount: z.int().nonnegative(),
				racingLapCount: z.int().nonnegative(),
				requiredRacingLapCount: z.int().positive(),
				rejectedLaps: z.array(rejectedLapSchema),
			}),
		}),
		z.strictObject({
			code: z.literal("TIMELINE_DISCONTINUITIES"),
			severity: z.enum(["none", "limitation", "blocking"]),
			evidence: z.strictObject({
				discontinuities: z.array(timelineDiscontinuityEvidenceSchema),
			}),
		}),
		z.strictObject({
			code: z.literal("LAPS_EXCLUDED_FROM_COMPARISON"),
			severity: z.literal("limitation"),
			evidence: z.strictObject({
				rejectedLaps: z.array(rejectedLapSchema),
			}),
		}),
		z.strictObject({
			code: z.literal("TRACK_REGIONS_UNAVAILABLE"),
			severity: z.literal("limitation"),
			evidence: z.strictObject({
				detectedCornerCount: z.int().nonnegative(),
			}),
		}),
		z.strictObject({
			code: z.literal("COACHING_DETECTOR_FAILURES"),
			severity: z.literal("limitation"),
			evidence: z.strictObject({
				failureCount: z.int().positive(),
			}),
		}),
	]);

const analysisCapabilitySchema = z.enum([
	"lap-comparison",
	"region-comparison",
	"ideal-lap",
	"coaching",
]);

export const analysisUsabilitySchema: z.ZodType<AnalysisUsability> =
	z.strictObject({
		status: z.enum(["usable", "unavailable"]),
		primaryReason: analysisUsabilityReasonSchema.nullable(),
		reasons: z.array(analysisUsabilityReasonSchema),
		availableCapabilities: z.array(analysisCapabilitySchema),
		unavailableCapabilities: z.array(analysisCapabilitySchema),
	});
