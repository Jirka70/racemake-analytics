import {
	CaretDown,
	CaretLeft,
	CaretRight,
	ChartLineUp,
	ClipboardText,
	Gauge,
	MapPin,
	Speedometer,
	Timer,
} from "@phosphor-icons/react";
import { type ReactNode, useId, useRef, useState } from "react";
import type { RankedCoachingPhenomenonResponse } from "../../../../src/http/contracts";
import {
	type CoachingPriorityLabel,
	classifyCoachingPriority,
	createCoachingMeasurementDetails,
	createCoachingNextLapGoal,
	formatCoachingPhenomenon,
	formatCoachingRegionId,
	formatCoachingSpeedMeasurement,
	formatCoachingTrackPosition,
	formatQuickestRegionPassLabel,
	formatReviewedPassLabel,
} from "../../analysis/coaching-findings";

export interface CoachingRailProps {
	readonly status: "loading" | "ready" | "unavailable" | "error";
	readonly findings: readonly RankedCoachingPhenomenonResponse[];
	readonly activeRank: number | null;
	readonly fastestLapNumber: number | null;
	readonly emptyMessage: string;
	readonly unavailableTitle?: string;
	readonly unavailableMessage?: string;
	readonly errorMessage: string | null;
	readonly onSelectRank: (rank: number) => void;
}

interface CoachingPriorityTheme {
	readonly badgeClassName: string;
	readonly accentClassName: string;
	readonly valueClassName: string;
}

const PRIORITY_THEMES: Readonly<
	Record<CoachingPriorityLabel, CoachingPriorityTheme>
> = {
	CRITICAL: {
		badgeClassName: "border-[#ff5c5c]/60 bg-[#ff5c5c]/[0.06] text-[#ff5c5c]",
		accentClassName: "border-l-[#ff5c5c]",
		valueClassName: "text-[#ff5c5c]",
	},
	HIGH: {
		badgeClassName: "border-[#ff8a3d]/60 bg-[#ff8a3d]/[0.06] text-[#ff8a3d]",
		accentClassName: "border-l-[#ff8a3d]",
		valueClassName: "text-[#ff8a3d]",
	},
	MODERATE: {
		badgeClassName: "border-[#f2b84b]/60 bg-[#f2b84b]/[0.06] text-[#f2b84b]",
		accentClassName: "border-l-[#f2b84b]",
		valueClassName: "text-[#f2b84b]",
	},
	LOW: {
		badgeClassName: "border-[#8b949e]/60 bg-[#8b949e]/[0.06] text-[#a8b0b9]",
		accentClassName: "border-l-[#8b949e]",
		valueClassName: "text-[#a8b0b9]",
	},
};

const navigationButtonClassName =
	"grid size-8 place-items-center rounded-[4px] border border-[#303431] bg-[#111412] text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400 disabled:cursor-not-allowed disabled:border-[#252825] disabled:text-neutral-700";

export function CoachingRail({
	status,
	findings,
	activeRank,
	fastestLapNumber,
	emptyMessage,
	unavailableTitle,
	unavailableMessage,
	errorMessage,
	onSelectRank,
}: CoachingRailProps) {
	const activeIndex = Math.max(
		findings.findIndex(({ rank }) => rank === activeRank),
		0,
	);
	const activeFinding = findings[activeIndex] ?? null;

	return (
		<aside className="flex h-full min-h-0 flex-col rounded-[3px] border border-[#292d2a] bg-[#101311]">
			<header className="flex h-[58px] shrink-0 items-center border-b border-[#292d2a] px-5">
				<h2 className="m-0 text-xs font-semibold tracking-[0.04em] text-neutral-200">
					COACHING RAIL
				</h2>
			</header>

			{status === "loading" && (
				<div className="p-5" aria-live="polite">
					<p className="text-sm text-neutral-400">Loading coaching findings…</p>
				</div>
			)}

			{status === "error" && (
				<div className="p-5" role="alert">
					<p className="text-sm font-medium text-red-300">
						We couldn’t load coaching
					</p>
					<p className="mt-1 text-xs leading-5 text-neutral-500">
						{errorMessage ?? "Try opening the stint again."}
					</p>
				</div>
			)}

			{status === "unavailable" && (
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
					<div className="grid size-16 place-items-center rounded-full border border-[#555b57] text-neutral-500">
						{unavailableTitle ? (
							<ClipboardText aria-hidden="true" size={32} weight="light" />
						) : (
							<ChartLineUp aria-hidden="true" size={32} weight="light" />
						)}
					</div>
					<p className="mt-5 text-xl font-semibold leading-tight text-neutral-100">
						{unavailableTitle ?? "Coaching requires at least two laps"}
					</p>
					<p className="mt-5 max-w-[250px] text-sm leading-6 text-neutral-400">
						{unavailableMessage ??
							"At least two laps are needed for comparison, time delta and coaching. Add another lap."}
					</p>
				</div>
			)}

			{status === "ready" && activeFinding === null && (
				<div className="p-5" aria-live="polite">
					<p className="text-sm font-medium text-neutral-300">
						No findings for this comparison
					</p>
					<p className="mt-1 text-xs leading-5 text-neutral-500">
						{emptyMessage}
					</p>
				</div>
			)}

			{status === "ready" && activeFinding !== null && (
				<>
					<FindingNavigation
						activeIndex={activeIndex}
						findings={findings}
						onSelectRank={onSelectRank}
					/>
					<CoachingFinding
						key={activeFinding.rank}
						finding={activeFinding}
						fastestLapNumber={fastestLapNumber}
					/>
				</>
			)}
		</aside>
	);
}

interface FindingNavigationProps {
	readonly activeIndex: number;
	readonly findings: readonly RankedCoachingPhenomenonResponse[];
	readonly onSelectRank: (rank: number) => void;
}

function FindingNavigation({
	activeIndex,
	findings,
	onSelectRank,
}: FindingNavigationProps) {
	const previousFinding = findings[activeIndex - 1] ?? null;
	const nextFinding = findings[activeIndex + 1] ?? null;

	return (
		<nav
			className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#292d2a] px-4"
			aria-label="Coaching findings"
		>
			<button
				className={navigationButtonClassName}
				type="button"
				aria-label="Previous coaching finding"
				disabled={previousFinding === null}
				onClick={() => {
					if (previousFinding) onSelectRank(previousFinding.rank);
				}}
			>
				<CaretLeft aria-hidden="true" size={15} weight="bold" />
			</button>

			<span className="text-xs tabular-nums text-neutral-400">
				{activeIndex + 1} of {findings.length}{" "}
				{findings.length === 1 ? "finding" : "findings"}
			</span>

			<button
				className={navigationButtonClassName}
				type="button"
				aria-label="Next coaching finding"
				disabled={nextFinding === null}
				onClick={() => {
					if (nextFinding) onSelectRank(nextFinding.rank);
				}}
			>
				<CaretRight aria-hidden="true" size={15} weight="bold" />
			</button>
		</nav>
	);
}

export function CoachingFinding({
	finding: rankedFinding,
	fastestLapNumber,
}: {
	readonly finding: RankedCoachingPhenomenonResponse;
	readonly fastestLapNumber: number | null;
}) {
	const { finding, priority } = rankedFinding;
	const priorityLabel = classifyCoachingPriority(priority);
	const theme = PRIORITY_THEMES[priorityLabel];
	const measurementDetails = createCoachingMeasurementDetails(finding);
	const nextLapGoal = createCoachingNextLapGoal(finding);
	const measurementPanelId = useId();
	const measurementPanelRef = useRef<HTMLDivElement>(null);
	const [isMeasurementOpen, setIsMeasurementOpen] = useState(false);
	const metrics = finding.metrics ?? [];
	const evidenceMetrics = metrics.filter(
		(metric) => metric.role === "evidence",
	);
	const relatedMetrics = metrics.filter((metric) => metric.role === "related");
	const isComparedWithFastestLap =
		finding.comparedWithLapNumber === fastestLapNumber;

	function toggleMeasurementPanel(): void {
		const willOpen = !isMeasurementOpen;
		setIsMeasurementOpen(willOpen);
		if (!willOpen) return;

		window.requestAnimationFrame(() => {
			measurementPanelRef.current?.scrollIntoView({ block: "nearest" });
		});
	}

	return (
		<article
			className={`min-h-0 overflow-y-auto border-l-2 ${theme.accentClassName}`}
		>
			<div className="p-5">
				<span
					className={`inline-flex rounded-[3px] border px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] ${theme.badgeClassName}`}
				>
					{priorityLabel} PRIORITY
				</span>

				<h3 className="mt-3 text-sm font-medium tracking-[0.02em] text-neutral-100">
					{formatCoachingPhenomenon(finding.phenomenon)}
				</h3>

				<div className="mt-4 rounded-[3px] border border-[#343935] bg-white/[0.025] px-3 py-2.5">
					<p className="text-[9px] font-semibold tracking-[0.08em] text-neutral-500">
						{nextLapGoal.label}
					</p>
					<p className="mt-1 text-[13px] font-medium leading-5 text-neutral-100">
						{nextLapGoal.instruction}
					</p>
				</div>

				<p
					className={`mt-4 text-[32px] font-medium leading-none tabular-nums ${theme.valueClassName}`}
				>
					{(finding.impactTimeLossMs / 1_000).toFixed(3)} s
				</p>
				<p className="mt-1.5 text-[10px] font-medium tracking-[0.06em] text-neutral-500">
					TIME LOST
				</p>

				<p className="mt-5 text-[13px] leading-[1.65] text-neutral-300">
					{finding.message}
				</p>
			</div>

			<FindingEvidence
				metrics={evidenceMetrics}
				regionName={measurementDetails.regionName}
				timeLossLabel={measurementDetails.timeLossLabel}
				timeLossMs={finding.impactTimeLossMs}
			/>

			{relatedMetrics.length > 0 && (
				<RelatedMetrics
					metrics={relatedMetrics}
					regionName={measurementDetails.regionName}
				/>
			)}

			<section className="border-t border-[#292d2a]">
				<button
					className="flex w-full items-center justify-between px-5 py-4 text-left text-xs font-medium text-neutral-300 transition-colors hover:bg-white/[0.02] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lime-400"
					type="button"
					aria-expanded={isMeasurementOpen}
					aria-controls={measurementPanelId}
					onClick={toggleMeasurementPanel}
				>
					<span>How this was measured</span>
					<CaretDown
						className={`text-neutral-500 transition-transform ${isMeasurementOpen ? "rotate-180" : ""}`}
						aria-hidden="true"
						size={14}
						weight="bold"
					/>
				</button>

				{isMeasurementOpen && (
					<div
						ref={measurementPanelRef}
						id={measurementPanelId}
						className="px-5 pb-4"
					>
						<dl className="space-y-2.5 border-l border-[#343935] pl-3 text-xs">
							<MeasurementRow
								label="Lap analysed"
								value={
									<span className="font-semibold text-lime-300">
										Lap {finding.lapNumber}
									</span>
								}
							/>
							<MeasurementRow
								label={measurementDetails.fastestPassLabel}
								value={
									<span className="flex flex-wrap items-center justify-end gap-1.5">
										<span className="font-semibold text-violet-300">
											Lap {finding.comparedWithLapNumber}
										</span>
										{isComparedWithFastestLap ? (
											<span className="rounded-[3px] border border-violet-500/50 bg-violet-500/[0.07] px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.04em] text-violet-300 uppercase">
												Fastest lap
											</span>
										) : null}
									</span>
								}
							/>
							<MeasurementRow
								label="Measured section"
								value={measurementDetails.measuredSection}
							/>
							<MeasurementRow
								label="Time difference"
								value={`+${Math.round(finding.impactTimeLossMs)} ms`}
								valueClassName={theme.valueClassName}
							/>
						</dl>
					</div>
				)}
			</section>

			{finding.limitations.length > 0 && (
				<section className="border-t border-[#292d2a] px-5 py-4">
					<h4 className="text-[10px] font-semibold tracking-[0.06em] text-neutral-500">
						LIMITATIONS
					</h4>
					<ul className="mt-3 space-y-2 text-xs leading-5 text-neutral-400">
						{finding.limitations.map((limitation) => (
							<li key={`${limitation.code}:${limitation.message}`}>
								{limitation.message}
							</li>
						))}
					</ul>
				</section>
			)}
		</article>
	);
}

type CoachingMetric =
	RankedCoachingPhenomenonResponse["finding"]["metrics"][number];
type EvidenceMetric = Extract<CoachingMetric, { readonly role: "evidence" }>;
type RelatedMetric = Extract<CoachingMetric, { readonly role: "related" }>;

function FindingEvidence({
	metrics,
	regionName,
	timeLossLabel,
	timeLossMs,
}: {
	readonly metrics: readonly EvidenceMetric[];
	readonly regionName: string;
	readonly timeLossLabel: string;
	readonly timeLossMs: number;
}) {
	return (
		<section className="border-t border-[#292d2a]">
			<div className="px-5 py-4">
				<h4 className="text-[10px] font-semibold tracking-[0.06em] text-neutral-500">
					EVIDENCE
				</h4>

				<dl className="mt-3 space-y-2.5 text-xs">
					{metrics.map((metric) => {
						switch (metric.kind) {
							case "event-position":
								return (
									<MetricRow
										key={metric.kind}
										icon={<MapPin size={14} weight="bold" />}
										label={formatEventPositionLabel(metric)}
										value={formatCoachingTrackPosition(
											metric.analyzedPass.normalizedTrackPosition,
										)}
									/>
								);

							case "brake-application":
								return (
									<ComparisonMetric
										key={metric.kind}
										icon={<Gauge size={14} weight="bold" />}
										label={`Maximum braking before and through ${regionName}`}
										regionName={regionName}
										analyzedPass={{
											lapNumber: metric.analyzedPass.lapNumber,
											value: formatRatio(metric.analyzedPass.maximumBrakeRatio),
										}}
										fastestRegionPass={{
											lapNumber: metric.fastestRegionPass.lapNumber,
											value: formatRatio(
												metric.fastestRegionPass.maximumBrakeRatio,
											),
										}}
									/>
								);

							case "timing-difference":
								return (
									<MetricRow
										key={metric.kind}
										icon={<Timer size={14} weight="bold" />}
										label={
											metric.event === "brake-release"
												? "When braking ended"
												: "When braking started"
										}
										value={formatTimingDifference(metric.differenceMs)}
										valueClassName="text-neutral-100"
									/>
								);
						}

						return null;
					})}
				</dl>
			</div>

			<dl className="border-t border-[#292d2a] px-5 py-4 text-xs">
				<MetricRow
					icon={<Timer size={14} weight="bold" />}
					label={timeLossLabel}
					value={`+${Math.round(timeLossMs)} ms`}
					valueClassName="text-lime-300"
				/>
			</dl>
		</section>
	);
}

function RelatedMetrics({
	metrics,
	regionName,
}: {
	readonly metrics: readonly RelatedMetric[];
	readonly regionName: string;
}) {
	return (
		<section className="border-t border-[#292d2a] px-5 py-4">
			<h4 className="text-[10px] font-semibold tracking-[0.06em] text-neutral-500">
				RELATED METRICS
			</h4>

			<div className="mt-3 space-y-4 text-xs">
				{metrics.map((metric) => (
					<ComparisonMetric
						key={`${metric.kind}:${metric.measurement}`}
						icon={<Speedometer size={14} weight="bold" />}
						label={formatCoachingSpeedMeasurement(
							metric.measurement,
							regionName,
						)}
						regionName={regionName}
						analyzedPass={{
							lapNumber: metric.analyzedPass.lapNumber,
							value: formatSpeed(metric.analyzedPass.speedKmh),
						}}
						fastestRegionPass={{
							lapNumber: metric.fastestRegionPass.lapNumber,
							value: formatSpeed(metric.fastestRegionPass.speedKmh),
						}}
					/>
				))}
			</div>
		</section>
	);
}

interface ComparisonPassValue {
	readonly lapNumber: number;
	readonly value: string;
}

function ComparisonMetric({
	icon,
	label,
	regionName,
	analyzedPass,
	fastestRegionPass,
}: {
	readonly icon: ReactNode;
	readonly label: string;
	readonly regionName: string;
	readonly analyzedPass: ComparisonPassValue;
	readonly fastestRegionPass: ComparisonPassValue;
}) {
	return (
		<div className="space-y-2.5">
			<div className="flex items-start gap-2">
				<span className="mt-px shrink-0 text-neutral-500" aria-hidden="true">
					{icon}
				</span>
				<p className="m-0 min-w-0 leading-4 text-neutral-300">{label}</p>
			</div>

			<dl className="space-y-2 pl-6">
				<ComparisonPassRow
					label={formatReviewedPassLabel()}
					lapNumber={analyzedPass.lapNumber}
					value={analyzedPass.value}
					valueClassName="text-lime-300"
				/>
				<ComparisonPassRow
					label={formatQuickestRegionPassLabel(regionName)}
					lapNumber={fastestRegionPass.lapNumber}
					value={fastestRegionPass.value}
					valueClassName="text-violet-300"
				/>
			</dl>
		</div>
	);
}

function ComparisonPassRow({
	label,
	lapNumber,
	value,
	valueClassName,
}: {
	readonly label: string;
	readonly lapNumber: number;
	readonly value: string;
	readonly valueClassName: string;
}) {
	return (
		<div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
			<dt className="min-w-0 leading-4 text-neutral-400">{label}</dt>
			<dd
				className={`m-0 text-right font-medium leading-4 tabular-nums ${valueClassName}`}
			>
				<span className="text-[10px] font-normal">Lap {lapNumber} ·</span>{" "}
				{value}
			</dd>
		</div>
	);
}

function MetricRow({
	icon = null,
	label,
	value,
	valueClassName = "text-neutral-200",
}: {
	readonly icon?: ReactNode;
	readonly label: string;
	readonly value: ReactNode;
	readonly valueClassName?: string;
}) {
	return (
		<div className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-2">
			<span className="mt-px text-neutral-500" aria-hidden="true">
				{icon}
			</span>
			<dt className="min-w-0 leading-4 text-neutral-400">{label}</dt>
			<dd
				className={`m-0 text-right font-medium leading-4 tabular-nums ${valueClassName}`}
			>
				{value}
			</dd>
		</div>
	);
}

function formatEventPositionLabel(
	metric: Extract<CoachingMetric, { readonly kind: "event-position" }>,
): string {
	const regionName = formatCoachingRegionId(
		metric.regionId.replace(/-(entry|apex-proxy|exit)$/, ""),
	);

	if (metric.event === "brake-release") {
		return `Braking ended in ${regionName}`;
	}

	return metric.location === "before-region"
		? `Braking started before ${regionName} entry`
		: `Braking started in ${regionName}`;
}

function formatRatio(ratio: number): string {
	return `${Math.round(ratio * 100)}%`;
}

function formatTimingDifference(differenceMs: number): string {
	const direction = differenceMs >= 0 ? "later" : "earlier";
	return `${Math.round(Math.abs(differenceMs))} ms ${direction}`;
}

function formatSpeed(speedKmh: number): string {
	return `${speedKmh.toFixed(1)} km/h`;
}

interface MeasurementRowProps {
	readonly label: string;
	readonly value: ReactNode;
	readonly valueClassName?: string;
}

function MeasurementRow({
	label,
	value,
	valueClassName = "text-neutral-200",
}: MeasurementRowProps) {
	return (
		<div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-start gap-3">
			<dt className="text-neutral-500">{label}</dt>
			<dd
				className={`m-0 text-right font-medium leading-4 tabular-nums ${valueClassName}`}
			>
				{value}
			</dd>
		</div>
	);
}
