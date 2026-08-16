import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type {
	AnalysisId,
	AvailableIdealLapResponse,
	IdealLapSeriesResponse,
	LapResponse,
} from "../../../src/http/contracts";
import { analysisIdSchema } from "../../../src/http/schemas/analysis-query";
import {
	createCoachingChartMarkers,
	findCoachingPhenomenaForLap,
} from "../analysis/coaching-findings";
import {
	findAdjacentLapToReview,
	type LapComparisonSelection,
	selectLapToCompareWith,
	selectLapToReview,
	swapComparedLaps,
} from "../analysis/lap-comparison-selection";
import {
	createIdealLapDefinition,
} from "../analysis/ideal-lap";
import {
	DEFAULT_VISIBLE_TELEMETRY_CHARTS,
	getSeriesChannelsForTelemetryCharts,
	toggleTelemetryChart,
	type TelemetryChartId,
} from "../analysis/telemetry-chart-selection";
import { ApiError } from "../api/api-client";
import { AnalysisMain } from "../components/analysis/AnalysisMain";
import { ChartChannelSelector } from "../components/analysis/charts/ChartChannelSelector";
import type { LapPickerLap } from "../components/analysis/laps/LapPicker";
import { AppHeader } from "../components/layout/AppHeader";
import { StintUploadPanel } from "../components/upload/StintUploadPanel";
import { useCoachingQuery } from "../hooks/use-coaching-query";
import { useDiagnosticsQuery } from "../hooks/use-diagnostics-query";
import { useFullscreen } from "../hooks/use-fullscreen";
import { useIdealLapQuery } from "../hooks/use-ideal-lap-query";
import { useLapsQuery } from "../hooks/use-laps-query";
import { useSeriesQuery } from "../hooks/use-series-query";
import { useTimeLossQuery } from "../hooks/use-time-loss-query";
import { useTrackQuery } from "../hooks/use-track-query";

export function AnalysisPage() {
	const { analysisId: routeAnalysisId } = useParams();
	const navigate = useNavigate();
	const location = useLocation();
	const analysisId = parseAnalysisId(routeAnalysisId);
	const returnToAnalysisPath = parseReturnToAnalysisPath(location.state);
	const lapsQuery = useLapsQuery(analysisId);
	const timeLossQuery = useTimeLossQuery(analysisId);
	const coachingQuery = useCoachingQuery(analysisId);
	const diagnosticsQuery = useDiagnosticsQuery(analysisId);
	const trackQuery = useTrackQuery(analysisId);
	const idealLap = useMemo(
		() =>
			createIdealLapDefinition(
				timeLossQuery.data ?? null,
				trackQuery.data?.regions ?? [],
			),
		[timeLossQuery.data, trackQuery.data],
	);
	const fullscreen = useFullscreen<HTMLDivElement>();
	const [requestedSelection, setRequestedSelection] =
		useState<LapComparisonSelection | null>(null);
	const [requestedCoachingRank, setRequestedCoachingRank] = useState<
		number | null
	>(null);
	const [visibleChartIds, setVisibleChartIds] = useState<
		readonly TelemetryChartId[]
	>(DEFAULT_VISIBLE_TELEMETRY_CHARTS);
	const racingLaps =
		lapsQuery.data?.laps.filter((lap) => lap.eligibility === "racing") ?? [];
	const defaultSelection = createDefaultSelection(
		racingLaps,
		timeLossQuery.data?.fastestLap?.lapNumber ?? null,
	);
	const selection = isSelectionAvailable(requestedSelection, racingLaps)
		? requestedSelection
		: defaultSelection;
	const selectedSeriesChannels = getSeriesChannelsForTelemetryCharts(
		visibleChartIds,
	);
	const telemetrySeriesQuery = useSeriesQuery(
		analysisId,
		selection
			? {
					laps: [
						selection.comparedLapNumber,
						selection.referenceLapNumber,
					],
					channels: selectedSeriesChannels,
				}
			: null,
	);
	const idealLapSeriesQuery = useIdealLapQuery(
		analysisId,
		selection ? { channels: selectedSeriesChannels } : null,
	);
	const idealLapSeriesResponse = idealLapSeriesQuery.data;
	const idealLapSeries = findAvailableIdealLap(idealLapSeriesResponse);

	if (analysisId === null) {
		return (
			<div className="flex h-dvh min-w-[720px] flex-col overflow-hidden bg-[#0b0d0c] text-neutral-100">
				<AppHeader
					showAnalysisControls={false}
					racingLapCount={null}
					comparedLapNumber={null}
					onBackToAnalysis={
						returnToAnalysisPath
							? () => navigate(returnToAnalysisPath)
							: undefined
					}
				/>
				<StintUploadPanel
					onAnalysisReady={(readyAnalysisId) => {
						navigate(`/analysis/${readyAnalysisId}`);
					}}
				/>
			</div>
		);
	}

	const referenceLapTimeMs =
		racingLaps.find((lap) => lap.lapNumber === selection?.referenceLapNumber)
			?.lapTimeMs ?? null;
	const lapPickerLaps: readonly LapPickerLap[] = racingLaps.map((lap) => ({
		lapNumber: lap.lapNumber,
		lapTimeMs: lap.lapTimeMs,
		deltaToReferenceMs:
			referenceLapTimeMs === null ? 0 : lap.lapTimeMs - referenceLapTimeMs,
		isFastest: lap.lapNumber === timeLossQuery.data?.fastestLap?.lapNumber,
	}));
	const lapPickerStatus = findLapPickerStatus(
		analysisId,
		lapsQuery.isPending || timeLossQuery.isPending,
		lapsQuery.isError || timeLossQuery.isError,
	);
	const lapPickerErrorMessage = findLapPickerErrorMessage(
		analysisId,
		lapsQuery.error,
		timeLossQuery.error,
	);
	const racingLapNumbers = racingLaps.map((lap) => lap.lapNumber);
	const previousLapNumber = selection
		? findAdjacentLapToReview(selection, racingLapNumbers, "previous")
		: null;
	const nextLapNumber = selection
		? findAdjacentLapToReview(selection, racingLapNumbers, "next")
		: null;
	const coachingFindings = findCoachingPhenomenaForLap(
		coachingQuery.data?.rankedPhenomena ?? [],
		selection?.comparedLapNumber ?? null,
	);
	const activeCoachingRank = coachingFindings.some(
		({ rank }) => rank === requestedCoachingRank,
	)
		? requestedCoachingRank
		: (coachingFindings[0]?.rank ?? null);
	const coachingChartMarkers = createCoachingChartMarkers(coachingFindings);

	function selectComparedLap(lapNumber: number): void {
		if (!selection) return;
		setRequestedSelection(selectLapToReview(selection, lapNumber));
	}

	function selectReferenceLap(lapNumber: number): void {
		if (!selection) return;
		setRequestedSelection(selectLapToCompareWith(selection, lapNumber));
	}

	function swapLaps(): void {
		if (!selection) return;
		setRequestedSelection(swapComparedLaps(selection));
	}

	function toggleChart(chartId: TelemetryChartId): void {
		setVisibleChartIds((currentChartIds) =>
			toggleTelemetryChart(currentChartIds, chartId),
		);
	}

	return (
		<div
			ref={fullscreen.elementRef}
			className="flex h-dvh min-w-[1120px] flex-col overflow-hidden bg-[#0b0d0c] text-neutral-100"
		>
			<AppHeader
				showAnalysisControls
				racingLapCount={lapsQuery.data ? racingLaps.length : null}
				comparedLapNumber={selection?.comparedLapNumber ?? null}
				isFullscreen={fullscreen.isFullscreen}
				onSelectPreviousLap={
					previousLapNumber === null
						? undefined
						: () => selectComparedLap(previousLapNumber)
				}
				onSelectNextLap={
					nextLapNumber === null
						? undefined
						: () => selectComparedLap(nextLapNumber)
				}
				onOpenStint={() =>
					navigate("/analysis/preview", {
						state: {
							returnTo: `/analysis/${analysisId}`,
						},
					})
				}
				onToggleFullscreen={
					fullscreen.isFullscreenSupported
						? fullscreen.toggleFullscreen
						: undefined
				}
				dataQuality={{
					status: diagnosticsQuery.isError
						? "error"
						: diagnosticsQuery.isPending
							? "loading"
							: "ready",
					diagnostics: diagnosticsQuery.data ?? null,
					errorMessage: findDiagnosticsErrorMessage(diagnosticsQuery.error),
				}}
			/>
			<AnalysisMain
				lapPicker={{
					status: lapPickerStatus,
					laps: lapPickerLaps,
					idealLap,
					comparedLapNumber: selection?.comparedLapNumber ?? null,
					referenceLapNumber: selection?.referenceLapNumber ?? null,
					errorMessage: lapPickerErrorMessage,
					onSelectComparedLap: selectComparedLap,
					onSelectReferenceLap: selectReferenceLap,
					onSwapLaps: swapLaps,
					chartControls: (
						<ChartChannelSelector
							visibleChartIds={visibleChartIds}
							onToggleChart={toggleChart}
							onReset={() =>
								setVisibleChartIds(DEFAULT_VISIBLE_TELEMETRY_CHARTS)
							}
						/>
					),
				}}
				telemetryChart={{
					status: telemetrySeriesQuery.isError
						? "error"
						: telemetrySeriesQuery.isPending
							? "loading"
							: selection
								? "ready"
								: "empty",
					series: telemetrySeriesQuery.data ?? null,
					reviewedLapNumber: selection?.comparedLapNumber ?? null,
					secondLapNumber: selection?.referenceLapNumber ?? null,
					idealLap,
					idealLapSeries,
					errorMessage: findSeriesErrorMessage(telemetrySeriesQuery.error),
					coachingMarkers: coachingChartMarkers,
					activeCoachingRank,
					onSelectCoachingRank: setRequestedCoachingRank,
					visibleChartIds,
				}}
				trackRegionBand={{
					status: trackQuery.isError
						? "error"
						: trackQuery.isPending
							? "loading"
							: "ready",
					regions: trackQuery.data?.regions ?? [],
				}}
				coachingRail={{
					status: coachingQuery.isError
						? "error"
						: coachingQuery.isPending
							? "loading"
							: "ready",
					findings: coachingFindings,
					activeRank: activeCoachingRank,
					fastestLapNumber: timeLossQuery.data?.fastestLap?.lapNumber ?? null,
					emptyMessage: selection
						? `No coaching findings were found for Lap ${selection.comparedLapNumber}. Try another lap.`
						: "Select a racing lap to see its coaching findings.",
					errorMessage: findCoachingErrorMessage(coachingQuery.error),
					onSelectRank: setRequestedCoachingRank,
				}}
			/>
		</div>
	);
}

function findSeriesErrorMessage(error: Error | null): string | null {
	if (error instanceof ApiError && error.code === "ANALYSIS_NOT_FOUND") {
		return "This stint is no longer available. Open it again to continue.";
	}

	return error ? "Try choosing the laps again." : null;
}

function findAvailableIdealLap(
	response: IdealLapSeriesResponse | undefined,
): AvailableIdealLapResponse | null {
	return response?.status === "available" ? response : null;
}

function findDiagnosticsErrorMessage(error: Error | null): string | null {
	if (error instanceof ApiError && error.code === "ANALYSIS_NOT_FOUND") {
		return "This stint is no longer available. Open it again to continue.";
	}

	return error ? "Try opening the stint again." : null;
}

function findCoachingErrorMessage(error: Error | null): string | null {
	if (error instanceof ApiError && error.code === "ANALYSIS_NOT_FOUND") {
		return "This stint is no longer available. Open it again to continue.";
	}

	return error ? "Try opening the stint again." : null;
}

function parseAnalysisId(value: string | undefined): AnalysisId | null {
	const result = analysisIdSchema.safeParse(value);
	return result.success ? result.data : null;
}

function parseReturnToAnalysisPath(state: unknown): string | null {
	if (typeof state !== "object" || state === null || !("returnTo" in state)) {
		return null;
	}

	const returnTo = state.returnTo;
	if (typeof returnTo !== "string") return null;

	const analysisPathPrefix = "/analysis/";
	if (!returnTo.startsWith(analysisPathPrefix)) return null;

	const analysisId = parseAnalysisId(returnTo.slice(analysisPathPrefix.length));
	return analysisId ? `/analysis/${analysisId}` : null;
}

function createDefaultSelection(
	racingLaps: readonly LapResponse[],
	fastestLapNumber: number | null,
): LapComparisonSelection | null {
	const referenceLapNumber =
		fastestLapNumber ?? racingLaps[0]?.lapNumber ?? null;
	const comparedLapNumber =
		[...racingLaps].sort(
			(first, second) =>
				second.lapTimeMs - first.lapTimeMs ||
				first.lapNumber - second.lapNumber,
		)[0]?.lapNumber ?? null;

	if (comparedLapNumber === null || referenceLapNumber === null) {
		return null;
	}

	return {
		comparedLapNumber,
		referenceLapNumber,
	};
}

function isSelectionAvailable(
	selection: LapComparisonSelection | null,
	racingLaps: readonly LapResponse[],
): selection is LapComparisonSelection {
	if (selection === null) return false;

	return (
		racingLaps.some((lap) => lap.lapNumber === selection.comparedLapNumber) &&
		racingLaps.some((lap) => lap.lapNumber === selection.referenceLapNumber)
	);
}

function findLapPickerStatus(
	analysisId: AnalysisId | null,
	isPending: boolean,
	isError: boolean,
): "loading" | "ready" | "empty" | "error" {
	if (analysisId === null) return "empty";
	if (isError) return "error";
	return isPending ? "loading" : "ready";
}

function findLapPickerErrorMessage(
	analysisId: AnalysisId | null,
	lapsError: Error | null,
	timeLossError: Error | null,
): string | null {
	if (analysisId === null) return null;

	const error = lapsError ?? timeLossError;

	if (error instanceof ApiError && error.code === "ANALYSIS_NOT_FOUND") {
		return "This stint is no longer available. Open it again to continue.";
	}

	return error ? "Try opening it again." : null;
}
