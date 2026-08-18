import type {
	AnalysisId,
	FragmentSeriesQuery,
	IdealLapQuery,
	SeriesQuery,
} from "../../../src/http/contracts";

type FragmentSeriesSelection = Omit<FragmentSeriesQuery, "analysisId">;
type SeriesSelection = Omit<SeriesQuery, "analysisId">;
type IdealLapSelection = Omit<IdealLapQuery, "analysisId">;

export const analysisQueryKeys = {
	all: ["analysis"] as const,

	byId: (analysisId: AnalysisId | null) => ["analysis", analysisId] as const,

	laps: (analysisId: AnalysisId | null) =>
		["analysis", analysisId, "laps"] as const,

	timeLoss: (analysisId: AnalysisId | null) =>
		["analysis", analysisId, "time-loss"] as const,

	coaching: (analysisId: AnalysisId | null) =>
		["analysis", analysisId, "coaching"] as const,

	diagnostics: (analysisId: AnalysisId | null) =>
		["analysis", analysisId, "diagnostics"] as const,

	track: (analysisId: AnalysisId | null) =>
		["analysis", analysisId, "track"] as const,

	fragmentSeries: (
		analysisId: AnalysisId | null,
		selection: FragmentSeriesSelection | null,
	) =>
		[
			"analysis",
			analysisId,
			"fragment-series",
			{
				fragment: selection?.fragment ?? null,
				channels: selection?.channels ?? null,
			},
		] as const,

	idealLap: (
		analysisId: AnalysisId | null,
		selection: IdealLapSelection | null,
	) =>
		[
			"analysis",
			analysisId,
			"ideal-lap",
			{
				channels: selection?.channels ?? null,
				positionFrom: selection?.positionFrom ?? null,
				positionTo: selection?.positionTo ?? null,
			},
		] as const,

	series: (
		analysisId: AnalysisId | null,
		selection: SeriesSelection | null,
	) =>
		[
			"analysis",
			analysisId,
			"series",
			{
				laps: selection?.laps ?? null,
				channels: selection?.channels ?? null,
				positionFrom: selection?.positionFrom ?? null,
				positionTo: selection?.positionTo ?? null,
			},
		] as const,
};
