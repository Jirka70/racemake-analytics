import {
	CaretDown,
	ChartBar,
	CheckCircle,
	WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import type { DiagnosticsResponse } from "../../../../src/http/contracts";
import {
	createDataQualitySummary,
	type DataQualitySummary,
} from "../../analysis/data-quality";

export interface DataQualityPopoverProps {
	readonly status: "loading" | "ready" | "error";
	readonly diagnostics: DiagnosticsResponse | null;
	readonly errorMessage: string | null;
}

const triggerClassName =
	"flex h-9 items-center gap-2 rounded-[4px] border border-[#303431] bg-[#111412] px-3 text-sm text-neutral-200 transition-colors hover:border-neutral-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400";

export function DataQualityPopover({
	status,
	diagnostics,
	errorMessage,
}: DataQualityPopoverProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [areTechnicalDetailsOpen, setAreTechnicalDetailsOpen] =
		useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const popoverId = useId();

	useEffect(() => {
		if (!isOpen) return;

		function closeOnOutsidePointer(event: PointerEvent): void {
			if (!(event.target instanceof Node)) return;
			if (rootRef.current?.contains(event.target)) return;
			setIsOpen(false);
		}

		function closeOnEscape(event: KeyboardEvent): void {
			if (event.key !== "Escape") return;
			setIsOpen(false);
			triggerRef.current?.focus();
		}

		document.addEventListener("pointerdown", closeOnOutsidePointer);
		document.addEventListener("keydown", closeOnEscape);

		return () => {
			document.removeEventListener("pointerdown", closeOnOutsidePointer);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [isOpen]);

	const summary =
		status === "ready" && diagnostics
			? createDataQualitySummary(diagnostics)
			: null;

	return (
		<div ref={rootRef} className="relative hidden xl:block">
			<button
				ref={triggerRef}
				className={triggerClassName}
				type="button"
				aria-expanded={isOpen}
				aria-controls={popoverId}
				onClick={() => setIsOpen((current) => !current)}
			>
				<ChartBar aria-hidden="true" size={17} />
				<span>Data quality</span>
			</button>

			{isOpen && (
				<section
					id={popoverId}
					className="absolute top-[calc(100%+8px)] right-0 z-50 max-h-[calc(100dvh-74px)] w-[340px] overflow-y-auto rounded-[4px] border border-[#3a3f3b] bg-[#121513] shadow-2xl shadow-black/50"
					aria-label="Data quality"
				>
					{status === "loading" && <LoadingContent />}
					{status === "error" && (
						<ErrorContent errorMessage={errorMessage} />
					)}
					{summary && (
						<ReadyContent
							summary={summary}
							areTechnicalDetailsOpen={areTechnicalDetailsOpen}
							onToggleTechnicalDetails={() =>
								setAreTechnicalDetailsOpen((current) => !current)
							}
						/>
					)}
				</section>
			)}
		</div>
	);
}

function LoadingContent() {
	return (
		<div className="p-5" aria-live="polite">
			<p className="text-sm font-medium text-neutral-100">Data quality</p>
			<p className="mt-2 text-xs leading-5 text-neutral-400">
				Checking the available telemetry…
			</p>
		</div>
	);
}

function ErrorContent({ errorMessage }: { readonly errorMessage: string | null }) {
	return (
		<div className="p-5" role="alert">
			<p className="text-sm font-medium text-red-300">
				Data quality is unavailable
			</p>
			<p className="mt-2 text-xs leading-5 text-neutral-400">
				{errorMessage ?? "Try opening the stint again."}
			</p>
		</div>
	);
}

function ReadyContent({
	summary,
	areTechnicalDetailsOpen,
	onToggleTechnicalDetails,
}: {
	readonly summary: DataQualitySummary;
	readonly areTechnicalDetailsOpen: boolean;
	readonly onToggleTechnicalDetails: () => void;
}) {
	const technicalDetailsId = useId();
	const isUsable = summary.status === "usable";
	const statusColorClassName = isUsable ? "text-lime-300" : "text-amber-300";

	return (
		<>
			<div className="p-5">
				<div className="flex items-center justify-between gap-4">
					<h2 className="text-sm font-medium text-neutral-100">Data quality</h2>
					<span
						className={`flex items-center gap-2 text-xs font-medium ${statusColorClassName}`}
					>
						<span className="size-2 rounded-full bg-current" aria-hidden="true" />
						{summary.statusLabel}
					</span>
				</div>
				<p className="mt-3 max-w-[270px] text-xs leading-5 text-neutral-400">
					{summary.description}
				</p>
			</div>

			<dl className="space-y-2 border-t border-[#303431] px-5 py-4 text-xs">
				<SummaryRow
					label="Frames retained"
					value={formatInteger(summary.framesRetained)}
				/>
				<SummaryRow
					label="Entire frames excluded"
					value={formatInteger(summary.entireFramesExcluded)}
					isPositive={summary.entireFramesExcluded === 0}
				/>
				<SummaryRow
					label="Signal readings ignored"
					value={formatInteger(summary.ignoredInvalidReadingCount)}
					isWarning={summary.ignoredInvalidReadingCount > 0}
				/>
				<SummaryRow
					label="Detector failures"
					value={formatInteger(summary.detectorFailureCount)}
					isPositive={summary.detectorFailureCount === 0}
				/>
			</dl>

			<div className="border-t border-[#303431]">
				<button
					className="flex w-full items-center justify-between px-5 py-4 text-left text-xs font-medium text-neutral-200 transition-colors hover:bg-white/[0.02] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lime-400"
					type="button"
					aria-expanded={areTechnicalDetailsOpen}
					aria-controls={technicalDetailsId}
					onClick={onToggleTechnicalDetails}
				>
					<span>Technical details</span>
					<CaretDown
						className={`text-neutral-500 transition-transform ${areTechnicalDetailsOpen ? "rotate-180" : ""}`}
						aria-hidden="true"
						size={14}
						weight="bold"
					/>
				</button>

				{areTechnicalDetailsOpen && (
					<div id={technicalDetailsId} className="px-5 pb-5">
						<TechnicalSection title="Telemetry timeline">
							<DetailRow
								label="Typical sample interval"
								value={formatMilliseconds(summary.typicalIntervalMs)}
							/>
							<DetailRow
								label="Gap detected above"
								value={formatMilliseconds(
									summary.maximumContinuousIntervalMs,
								)}
							/>
							<DetailRow
								label="Sampling gaps found"
								value={formatInteger(summary.samplingGapCount)}
							/>
							<p className="mt-2 text-[10px] leading-4 text-neutral-500">
								Calculations were not connected across these gaps.
							</p>
						</TechnicalSection>

						<TechnicalSection title="Signal checks">
							<DetailRow
								label="Channels with limited data"
								value={formatInteger(summary.affectedSignalCount)}
								isWarning={summary.affectedSignalCount > 0}
							/>
							<DetailRow
								label="Signal discontinuities"
								value={formatInteger(summary.signalDiscontinuityCount)}
							/>
							{summary.affectedSignalCount > 0 ? (
								<div className="mt-3 flex items-start gap-2 rounded-[3px] border border-amber-400/20 bg-amber-400/[0.04] p-2.5">
									<WarningCircle
										className="mt-0.5 shrink-0 text-amber-300"
										aria-hidden="true"
										size={13}
										weight="fill"
									/>
									<p className="text-[10px] leading-4 text-neutral-400">
										<span className="text-amber-200">
											{formatSignalList(summary.affectedSignalLabels)}
										</span>{" "}
										had isolated unreliable readings or continuity breaks.
										They remained usable outside the affected points.
									</p>
								</div>
							) : (
								<p className="mt-2 text-[10px] leading-4 text-neutral-500">
									No channel-level interruptions were detected.
								</p>
							)}
						</TechnicalSection>

						<TechnicalSection title="Detection rules">
							<p className="mb-3 text-[10px] leading-4 text-neutral-500">
								Dataset-derived boundaries used by the analysis. These are not
								driver performance targets.
							</p>
							<DetailRow
								label="Braking confirmed above"
								value={formatPercentage(summary.brakeAppliedPercent)}
							/>
							<DetailRow
								label="Braking ends below"
								value={formatPercentage(summary.brakeReleasedPercent)}
							/>
							<DetailRow
								label="Cornering confirmed above"
								value={formatDegrees(summary.cornerSteeringDegrees)}
							/>
						</TechnicalSection>

						<TechnicalSection title="Detector status" isLast>
							<div className="flex items-start gap-2 text-[10px] leading-4">
								<CheckCircle
									className={statusColorClassName}
									aria-hidden="true"
									size={14}
									weight="fill"
								/>
								<p className="text-neutral-400">
									{summary.detectorFailureCount === 0
										? "All coaching detectors completed successfully."
										: `${summary.detectorFailureCount} coaching detector ${summary.detectorFailureCount === 1 ? "check was" : "checks were"} not completed.`}
								</p>
							</div>
						</TechnicalSection>
					</div>
				)}
			</div>
		</>
	);
}

function SummaryRow({
	label,
	value,
	isPositive = false,
	isWarning = false,
}: {
	readonly label: string;
	readonly value: string;
	readonly isPositive?: boolean;
	readonly isWarning?: boolean;
}) {
	const valueClassName = isWarning
		? "text-amber-300"
		: isPositive
			? "text-lime-300"
			: "text-neutral-100";

	return (
		<div className="flex items-center justify-between gap-4">
			<dt className="text-neutral-500">{label}</dt>
			<dd
				className={`font-medium tabular-nums ${valueClassName}`}
			>
				{value}
			</dd>
		</div>
	);
}

function TechnicalSection({
	title,
	children,
	isLast = false,
}: {
	readonly title: string;
	readonly children: React.ReactNode;
	readonly isLast?: boolean;
}) {
	return (
		<section className={isLast ? "pt-4" : "border-b border-[#303431] py-4"}>
			<h3 className="mb-3 text-[10px] font-medium tracking-[0.06em] text-neutral-500 uppercase">
				{title}
			</h3>
			{children}
		</section>
	);
}

function DetailRow({
	label,
	value,
	isWarning = false,
}: {
	readonly label: string;
	readonly value: string;
	readonly isWarning?: boolean;
}) {
	return (
		<div className="mt-2 flex items-center justify-between gap-4 text-xs first:mt-0">
			<span className="text-neutral-400">{label}</span>
			<span
				className={`shrink-0 font-medium tabular-nums ${isWarning ? "text-amber-300" : "text-neutral-100"}`}
			>
				{value}
			</span>
		</div>
	);
}

function formatInteger(value: number): string {
	return new Intl.NumberFormat("en-US").format(value);
}

function formatMilliseconds(value: number | null): string {
	return value === null ? "Unavailable" : `${Math.round(value)} ms`;
}

function formatPercentage(value: number | null): string {
	return value === null ? "Unavailable" : `${value.toFixed(1)}%`;
}

function formatDegrees(value: number | null): string {
	return value === null ? "Unavailable" : `${value.toFixed(2)}°`;
}

function formatSignalList(labels: readonly string[]): string {
	if (labels.length === 0) return "Some telemetry channels";
	if (labels.length === 1) return capitalize(labels[0] ?? "telemetry");

	const finalLabel = labels.at(-1);
	const precedingLabels = labels.slice(0, -1).join(", ");
	return capitalize(`${precedingLabels} and ${finalLabel}`);
}

function capitalize(value: string): string {
	return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
