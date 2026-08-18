import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type {
	AnalysisId,
	AvailableIdealLapResponse,
	IdealLapSeriesResponse,
} from "../../../src/http/contracts";
import { analysisIdSchema } from "../../../src/http/schemas/analysis-query";
import {
	createCoachingChartMarkers,
	findCoachingBaseRegionId,
	findCoachingPhenomenaForLap,
} from "../analysis/coaching-findings";
import { createDataQualitySummary } from "../analysis/data-quality";
import {
	adaptFragmentTelemetrySeries,
	FRAGMENT_TELEMETRY_VIRTUAL_LAP_NUMBER,
} from "../analysis/fragment-telemetry-series";
import { createIdealLapDefinition } from "../analysis/ideal-lap";
import {
	createLapReviewPlan,
	findAdjacentLapToReview,
	type LapComparisonSelection,
	selectLapToCompareWith,
	selectLapToReview,
	swapComparedLaps,
} from "../analysis/lap-comparison-selection";
import {
	createLapFragmentPresentations,
	type LapFragmentPresentation,
} from "../analysis/lap-fragment-presentation";
import {
	DEFAULT_VISIBLE_FRAGMENT_TELEMETRY_CHARTS,
	DEFAULT_VISIBLE_TELEMETRY_CHARTS,
	FRAGMENT_TELEMETRY_CHART_IDS,
	getSeriesChannelsForTelemetryCharts,
	MOBILE_COMPARISON_TELEMETRY_CHARTS,
	MOBILE_SINGLE_TELEMETRY_CHARTS,
	type TelemetryChartId,
	toggleTelemetryChart,
} from "../analysis/telemetry-chart-selection";
import { ApiError } from "../api/api-client";
import { AnalysisMain } from "../components/analysis/AnalysisMain";
import { ChartChannelSelector } from "../components/analysis/charts/ChartChannelSelector";
import type { LapPickerLap } from "../components/analysis/laps/LapPicker";
import { AppHeader } from "../components/layout/AppHeader";
import { DataQualityBanner } from "../components/layout/DataQualityBanner";
import { StintUploadPanel } from "../components/upload/StintUploadPanel";
import { useCoachingQuery } from "../hooks/use-coaching-query";
import { useDiagnosticsQuery } from "../hooks/use-diagnostics-query";
import { useFragmentSeriesQuery } from "../hooks/use-fragment-series-query";
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
	const [requestedSelection, setRequestedSelection] =
		useState<LapComparisonSelection | null>(null);
	const [requestedFragmentIndex, setRequestedFragmentIndex] = useState<
		number | null
	>(null);
	const [requestedCoachingRank, setRequestedCoachingRank] = useState<
		number | null
	>(null);
	const [visibleChartIds, setVisibleChartIds] = useState<
		readonly TelemetryChartId[]
	>(DEFAULT_VISIBLE_TELEMETRY_CHARTS);
	const [visibleFragmentChartIds, setVisibleFragmentChartIds] = useState<
		readonly TelemetryChartId[]
	>(DEFAULT_VISIBLE_FRAGMENT_TELEMETRY_CHARTS);
	const [mobileChartId, setMobileChartId] =
		useState<TelemetryChartId>("time-delta");
	const [openDataQualityAnalysisId, setOpenDataQualityAnalysisId] =
		useState<AnalysisId | null>(null);
	const [dismissedDataQualityAnalysisId, setDismissedDataQualityAnalysisId] =
		useState<AnalysisId | null>(null);
	const racingLaps =
		lapsQuery.data?.laps.filter((lap) => lap.eligibility === "racing") ?? [];
	const fragmentPresentations = useMemo(
		() =>
			createLapFragmentPresentations(
				lapsQuery.data?.fragments ?? [],
				lapsQuery.data?.laps.map((lap) => lap.lapNumber) ?? [],
			),
		[lapsQuery.data],
	);
	const selectedFragment = findSelectedFragment(
		fragmentPresentations,
		requestedFragmentIndex,
	);
	const hasLapComparison = racingLaps.length >= 2;
	const isDataQualityPopoverOpen =
		analysisId !== null && openDataQualityAnalysisId === analysisId;
	const shouldLoadDiagnostics =
		isDataQualityPopoverOpen ||
		(lapsQuery.data !== undefined && racingLaps.length !== 1);
	const diagnosticsQuery = useDiagnosticsQuery(
		shouldLoadDiagnostics ? analysisId : null,
	);
	const trackAnalysisId = racingLaps.length >= 1 ? analysisId : null;
	const comparisonAnalysisId = hasLapComparison ? analysisId : null;
	const timeLossQuery = useTimeLossQuery(comparisonAnalysisId);
	const coachingQuery = useCoachingQuery(comparisonAnalysisId);
	const trackQuery = useTrackQuery(trackAnalysisId);
	const idealLap = useMemo(
		() =>
			createIdealLapDefinition(
				timeLossQuery.data ?? null,
				trackQuery.data?.regions ?? [],
			),
		[timeLossQuery.data, trackQuery.data],
	);
	const fullscreen = useFullscreen<HTMLDivElement>();
	const dataQualitySummary = useMemo(
		() =>
			diagnosticsQuery.data
				? createDataQualitySummary(diagnosticsQuery.data, racingLaps.length)
				: null,
		[diagnosticsQuery.data, racingLaps.length],
	);
	const isSingleLapOnlyLimitation =
		racingLaps.length === 1 &&
		diagnosticsQuery.data?.usability.primaryReason?.code ===
			"INSUFFICIENT_RACING_LAPS";
	const isDataQualityBannerVisible =
		analysisId !== null &&
		dataQualitySummary !== null &&
		dataQualitySummary.status === "unavailable" &&
		!isSingleLapOnlyLimitation &&
		dismissedDataQualityAnalysisId !== analysisId;
	const changeDataQualityOpen = useCallback(
		(isOpen: boolean) => {
			setOpenDataQualityAnalysisId(isOpen ? analysisId : null);
		},
		[analysisId],
	);
	const lapReviewPlan = createLapReviewPlan(
		racingLaps,
		timeLossQuery.data?.fastestLap?.lapNumber ?? null,
		requestedSelection,
	);
	const selection = lapReviewPlan.selection;
	const reviewedLapNumber = lapReviewPlan.reviewedLapNumber;
	const referenceLapNumber = lapReviewPlan.referenceLapNumber;
	const mobileChartIds =
		selectedFragment || !hasLapComparison
			? MOBILE_SINGLE_TELEMETRY_CHARTS
			: MOBILE_COMPARISON_TELEMETRY_CHARTS;
	const activeMobileChartId = mobileChartIds.includes(mobileChartId)
		? mobileChartId
		: (mobileChartIds[0] ?? "speed");
	const selectedSeriesChannels = getSeriesChannelsForTelemetryCharts([
		...new Set([...visibleChartIds, activeMobileChartId]),
	]);
	const fragmentSeriesChannels = getSeriesChannelsForTelemetryCharts([
		...new Set([...visibleFragmentChartIds, activeMobileChartId]),
	]);
	const telemetrySeriesQuery = useSeriesQuery(
		analysisId,
		selectedFragment === null && lapReviewPlan.seriesLapNumbers !== null
			? {
					laps: lapReviewPlan.seriesLapNumbers,
					channels: selectedSeriesChannels,
				}
			: null,
	);
	const fragmentSeriesQuery = useFragmentSeriesQuery(
		analysisId,
		selectedFragment
			? {
					fragment: selectedFragment.fragmentIndex,
					channels: fragmentSeriesChannels,
				}
			: null,
	);
	const idealLapSeriesQuery = useIdealLapQuery(
		comparisonAnalysisId,
		selection && selectedFragment === null
			? { channels: selectedSeriesChannels }
			: null,
	);
	const idealLapSeriesResponse = idealLapSeriesQuery.data;
	const idealLapSeries = findAvailableIdealLap(idealLapSeriesResponse);
	const fragmentTelemetrySeries = useMemo(
		() =>
			fragmentSeriesQuery.data
				? adaptFragmentTelemetrySeries(fragmentSeriesQuery.data)
				: null,
		[fragmentSeriesQuery.data],
	);

	if (analysisId === null) {
		return (
			<div className="flex h-dvh min-w-0 flex-col overflow-hidden bg-[#0b0d0c] text-neutral-100">
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
		racingLaps.find((lap) => lap.lapNumber === referenceLapNumber)?.lapTimeMs ??
		null;
	const fastestLapNumber =
		timeLossQuery.data?.fastestLap?.lapNumber ??
		(racingLaps.length === 1 ? (racingLaps[0]?.lapNumber ?? null) : null);
	const lapPickerLaps: readonly LapPickerLap[] = (
		lapsQuery.data?.laps ?? []
	).map((lap) => ({
		lapNumber: lap.lapNumber,
		lapTimeMs: lap.lapTimeMs,
		deltaToReferenceMs:
			referenceLapTimeMs === null ? 0 : lap.lapTimeMs - referenceLapTimeMs,
		isFastest: lap.lapNumber === fastestLapNumber,
		isEligible: lap.eligibility === "racing",
		samplingGaps:
			lapsQuery.data?.samplingGaps.filter(
				(gap) => gap.lapNumber === lap.lapNumber,
			) ?? [],
	}));
	const lapPickerStatus = findLapPickerStatus(
		analysisId,
		lapsQuery.isPending || (hasLapComparison && timeLossQuery.isPending),
		lapsQuery.isError || (hasLapComparison && timeLossQuery.isError),
	);
	const lapPickerErrorMessage = findLapPickerErrorMessage(
		analysisId,
		lapsQuery.error,
		hasLapComparison ? timeLossQuery.error : null,
	);
	const telemetryChartStatus = selectedFragment
		? fragmentSeriesQuery.isError
			? "error"
			: fragmentSeriesQuery.isPending
				? "loading"
				: "ready"
		: telemetrySeriesQuery.isError
			? "error"
			: reviewedLapNumber === null
				? "empty"
				: telemetrySeriesQuery.isPending
					? "loading"
					: "ready";
	const racingLapNumbers = racingLaps.map((lap) => lap.lapNumber);
	const previousLapNumber = selection
		? findAdjacentLapToReview(selection, racingLapNumbers, "previous")
		: null;
	const nextLapNumber = selection
		? findAdjacentLapToReview(selection, racingLapNumbers, "next")
		: null;
	const adjacentFragmentTargets = selectedFragment
		? findAdjacentFragmentReviewTargets(
				selectedFragment,
				fragmentPresentations,
				racingLapNumbers,
			)
		: null;
	const previousFragmentTarget = adjacentFragmentTargets?.previous ?? null;
	const nextFragmentTarget = adjacentFragmentTargets?.next ?? null;
	const coachingFindings = findCoachingPhenomenaForLap(
		coachingQuery.data?.rankedPhenomena ?? [],
		selection?.comparedLapNumber ?? null,
	);
	const activeCoachingRank = coachingFindings.some(
		({ rank }) => rank === requestedCoachingRank,
	)
		? requestedCoachingRank
		: (coachingFindings[0]?.rank ?? null);
	const activeCoachingFinding =
		coachingFindings.find(({ rank }) => rank === activeCoachingRank) ?? null;
	const coachingChartMarkers = createCoachingChartMarkers(coachingFindings);

	function selectComparedLap(lapNumber: number): void {
		setRequestedFragmentIndex(null);
		if (!selection) return;
		setRequestedSelection(selectLapToReview(selection, lapNumber));
	}

	function selectFragment(fragmentIndex: number): void {
		setRequestedFragmentIndex(fragmentIndex);
		setRequestedCoachingRank(null);
	}

	function selectReviewTarget(target: ReviewTarget): void {
		if (target.type === "fragment") {
			selectFragment(target.fragmentIndex);
			return;
		}

		setRequestedFragmentIndex(null);
		if (!selection) return;
		setRequestedSelection(
			target.lapNumber === selection.referenceLapNumber
				? swapComparedLaps(selection)
				: selectLapToReview(selection, target.lapNumber),
		);
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

	function toggleFragmentChart(chartId: TelemetryChartId): void {
		setVisibleFragmentChartIds((currentChartIds) =>
			toggleTelemetryChart(currentChartIds, chartId),
		);
	}

	return (
		<div
			ref={fullscreen.elementRef}
			className="flex h-dvh min-w-0 flex-col overflow-hidden bg-[#0b0d0c] text-neutral-100"
		>
			<AppHeader
				showAnalysisControls
				racingLapCount={lapsQuery.data ? racingLaps.length : null}
				comparedLapNumber={reviewedLapNumber}
				reviewTitle={
					selectedFragment
						? `Inspecting ${formatFragmentHeaderLabel(selectedFragment.label)}`
						: undefined
				}
				reviewTone={selectedFragment ? "fragment" : "default"}
				isFullscreen={fullscreen.isFullscreen}
				onSelectPreviousLap={
					selectedFragment
						? previousFragmentTarget
							? () => selectReviewTarget(previousFragmentTarget)
							: undefined
						: previousLapNumber === null
							? undefined
							: () => selectComparedLap(previousLapNumber)
				}
				onSelectNextLap={
					selectedFragment
						? nextFragmentTarget
							? () => selectReviewTarget(nextFragmentTarget)
							: undefined
						: nextLapNumber === null
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
					summary: dataQualitySummary,
					errorMessage: findDiagnosticsErrorMessage(diagnosticsQuery.error),
					isOpen: isDataQualityPopoverOpen,
					isBannerVisible: isDataQualityBannerVisible,
					onOpenChange: changeDataQualityOpen,
				}}
			/>
			{isDataQualityBannerVisible && dataQualitySummary && (
				<DataQualityBanner
					summary={dataQualitySummary}
					onViewDetails={() => changeDataQualityOpen(true)}
					onDismiss={() => {
						setDismissedDataQualityAnalysisId(analysisId);
						changeDataQualityOpen(false);
					}}
				/>
			)}
			<AnalysisMain
				fragmentDetails={selectedFragment}
				mobileChart={{
					activeChartId: activeMobileChartId,
					availableChartIds: mobileChartIds,
					onSelectChart: setMobileChartId,
				}}
				lapPicker={{
					status: lapPickerStatus,
					laps: lapPickerLaps,
					fragments: lapsQuery.data?.fragments ?? [],
					idealLap,
					comparedLapNumber: reviewedLapNumber,
					referenceLapNumber,
					selectedFragmentIndex: selectedFragment?.fragmentIndex ?? null,
					errorMessage: lapPickerErrorMessage,
					onSelectComparedLap: selectComparedLap,
					onSelectReferenceLap: selectReferenceLap,
					onSwapLaps: swapLaps,
					onSelectFragment: selectFragment,
					chartControls: (
						<ChartChannelSelector
							visibleChartIds={
								selectedFragment ? visibleFragmentChartIds : visibleChartIds
							}
							availableChartIds={
								selectedFragment ? FRAGMENT_TELEMETRY_CHART_IDS : undefined
							}
							defaultVisibleChartIds={
								selectedFragment
									? DEFAULT_VISIBLE_FRAGMENT_TELEMETRY_CHARTS
									: undefined
							}
							onToggleChart={
								selectedFragment ? toggleFragmentChart : toggleChart
							}
							onReset={
								selectedFragment
									? () =>
											setVisibleFragmentChartIds(
												DEFAULT_VISIBLE_FRAGMENT_TELEMETRY_CHARTS,
											)
									: () => setVisibleChartIds(DEFAULT_VISIBLE_TELEMETRY_CHARTS)
							}
						/>
					),
				}}
				telemetryChart={{
					status: telemetryChartStatus,
					series: selectedFragment
						? fragmentTelemetrySeries
						: (telemetrySeriesQuery.data ?? null),
					reviewedLapNumber: selectedFragment
						? FRAGMENT_TELEMETRY_VIRTUAL_LAP_NUMBER
						: reviewedLapNumber,
					reviewedLabel: selectedFragment?.label,
					secondLapNumber: selectedFragment ? null : referenceLapNumber,
					idealLap: selectedFragment ? null : idealLap,
					idealLapSeries: selectedFragment ? null : idealLapSeries,
					errorMessage: findSeriesErrorMessage(
						selectedFragment
							? fragmentSeriesQuery.error
							: telemetrySeriesQuery.error,
					),
					coachingMarkers: selectedFragment ? [] : coachingChartMarkers,
					activeCoachingRank: selectedFragment ? null : activeCoachingRank,
					activeCoachingRegionId:
						selectedFragment || activeCoachingFinding === null
							? null
							: findCoachingBaseRegionId(
									activeCoachingFinding.finding.analysisRegionId,
								),
					onSelectCoachingRank: setRequestedCoachingRank,
					visibleChartIds: selectedFragment
						? visibleFragmentChartIds
						: visibleChartIds,
					samplingGaps: selectedFragment
						? []
						: (lapsQuery.data?.samplingGaps ?? []),
					fragment: selectedFragment,
				}}
				trackRegionBand={{
					status: lapsQuery.isPending
						? "loading"
						: racingLaps.length === 0
							? "unavailable"
							: trackQuery.isError
								? "error"
								: trackQuery.isPending
									? "loading"
									: "ready",
					regions: trackQuery.data?.regions ?? [],
				}}
				coachingRail={{
					status: !hasLapComparison
						? "unavailable"
						: coachingQuery.isError
							? "error"
							: coachingQuery.isPending
								? "loading"
								: "ready",
					findings: coachingFindings,
					activeRank: activeCoachingRank,
					fastestLapNumber,
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

type ReviewTarget =
	| {
			type: "fragment";
			fragmentIndex: number;
			sequenceLapNumber: number;
	  }
	| {
			type: "lap";
			lapNumber: number;
	  };

function findSelectedFragment(
	fragments: readonly LapFragmentPresentation[],
	fragmentIndex: number | null,
): LapFragmentPresentation | null {
	if (fragmentIndex === null) return null;
	return (
		fragments.find((fragment) => fragment.fragmentIndex === fragmentIndex) ??
		null
	);
}

function findAdjacentFragmentReviewTargets(
	selectedFragment: LapFragmentPresentation,
	fragments: readonly LapFragmentPresentation[],
	lapNumbers: readonly number[],
): {
	readonly previous: ReviewTarget | null;
	readonly next: ReviewTarget | null;
} {
	const targets: readonly ReviewTarget[] = [
		...fragments.map(
			(fragment): ReviewTarget => ({
				type: "fragment",
				fragmentIndex: fragment.fragmentIndex,
				sequenceLapNumber: fragment.lapNumber,
			}),
		),
		...lapNumbers.map(
			(lapNumber): ReviewTarget => ({ type: "lap", lapNumber }),
		),
	].sort(
		(first, second) =>
			findReviewTargetLapNumber(first) - findReviewTargetLapNumber(second) ||
			(first.type === "fragment" ? -1 : 1),
	);
	const selectedIndex = targets.findIndex(
		(target) =>
			target.type === "fragment" &&
			target.fragmentIndex === selectedFragment.fragmentIndex,
	);

	return {
		previous: selectedIndex > 0 ? (targets[selectedIndex - 1] ?? null) : null,
		next:
			selectedIndex >= 0 && selectedIndex < targets.length - 1
				? (targets[selectedIndex + 1] ?? null)
				: null,
	};
}

function findReviewTargetLapNumber(target: ReviewTarget): number {
	return target.type === "fragment"
		? target.sequenceLapNumber
		: target.lapNumber;
}

function formatFragmentHeaderLabel(
	label: LapFragmentPresentation["label"],
): string {
	return label.replace(" fragment", " Fragment");
}
