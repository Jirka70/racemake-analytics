import { z } from "zod";
import type { FragmentSeriesQuery } from "../contracts/fragment-series";
import { SERIES_CHANNELS } from "../contracts/series";
import { analysisIdSchema } from "./analysis-query";

const commaSeparatedChannelsSchema = z
	.string()
	.transform((value) => value.split(",").map((item) => item.trim()))
	.pipe(z.array(z.enum(SERIES_CHANNELS)).min(1))
	.refine(
		(channels) => new Set(channels).size === channels.length,
		"Series channels must be unique",
	);

export const fragmentSeriesQuerySchema: z.ZodType<FragmentSeriesQuery> =
	z.strictObject({
		analysisId: analysisIdSchema,
		fragment: z.coerce.number().int().nonnegative(),
		channels: commaSeparatedChannelsSchema.optional(),
	});
