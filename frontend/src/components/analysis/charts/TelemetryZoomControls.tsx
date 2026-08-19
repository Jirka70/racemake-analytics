import {
	CaretLeft,
	CaretRight,
	MagnifyingGlassMinus,
	MagnifyingGlassPlus,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { TrackRegionResponse } from "../../../../../src/http/contracts";
import {
	FULL_LAP_TELEMETRY_VIEWPORT,
	MINIMUM_TELEMETRY_VIEWPORT_SPAN_PERCENT,
	resizeTelemetryViewport,
	type TelemetryViewport,
} from "../../../analysis/telemetry-viewport";

export interface TelemetryZoomControlsProps {
	readonly presentation?: "desktop" | "compact";
	readonly viewLabel?: string;
	readonly viewport: TelemetryViewport;
	readonly onViewportChange: (viewport: TelemetryViewport) => void;
	readonly selectedRegion: TrackRegionResponse | null;
	readonly canSelectPreviousRegion: boolean;
	readonly canSelectNextRegion: boolean;
	readonly onSelectPreviousRegion: () => void;
	readonly onSelectNextRegion: () => void;
	readonly deltaOverview: ReactNode;
	readonly showComparisonControls: boolean;
}

export function TelemetryZoomControls({
	presentation = "desktop",
	viewLabel = "Full lap",
	viewport,
	onViewportChange,
	selectedRegion,
	canSelectPreviousRegion,
	canSelectNextRegion,
	onSelectPreviousRegion,
	onSelectNextRegion,
	deltaOverview,
	showComparisonControls,
}: TelemetryZoomControlsProps) {
	const spanPercent = viewport.endPercent - viewport.startPercent;

	function setVisibleSpan(nextSpanPercent: number): void {
		onViewportChange(resizeTelemetryViewport(viewport, nextSpanPercent));
	}

	const zoomControl = (
		<div className="flex items-center gap-3">
			<ZoomButton
				label="Zoom out"
				disabled={spanPercent >= 100}
				onClick={() => setVisibleSpan(spanPercent + 15)}
			>
				<MagnifyingGlassMinus size={16} aria-hidden="true" />
			</ZoomButton>
			<input
				type="range"
				className="h-1 min-w-0 flex-1 cursor-ew-resize accent-lime-400"
				min={0}
				max={100 - MINIMUM_TELEMETRY_VIEWPORT_SPAN_PERCENT}
				step={1}
				value={100 - spanPercent}
				onChange={(event) => setVisibleSpan(100 - Number(event.target.value))}
				aria-label="Chart zoom level"
				aria-valuetext={`${Math.round(spanPercent)}% of the lap visible`}
			/>
			<ZoomButton
				label="Zoom in"
				disabled={spanPercent <= MINIMUM_TELEMETRY_VIEWPORT_SPAN_PERCENT}
				onClick={() => setVisibleSpan(spanPercent - 15)}
			>
				<MagnifyingGlassPlus size={16} aria-hidden="true" />
			</ZoomButton>
		</div>
	);

	if (presentation === "compact") {
		return (
			<section className="rounded-[3px] border border-[#292d2a] bg-[#101311] p-2">
				<div className="h-12 min-w-0 pt-2">{deltaOverview}</div>
				<div className="mt-2 grid grid-cols-[70px_minmax(0,1fr)] items-center gap-3 border-t border-[#292d2a] pt-2">
					<button
						type="button"
						className="text-left text-[11px] font-medium text-neutral-200 hover:text-lime-300 focus-visible:outline-1 focus-visible:outline-lime-400"
						onClick={() => onViewportChange(FULL_LAP_TELEMETRY_VIEWPORT)}
					>
						{viewLabel}
					</button>
					{zoomControl}
				</div>
			</section>
		);
	}

	return (
		<section
			className={`grid items-center gap-3 rounded-[3px] border border-[#292d2a] bg-[#101311] px-3 py-2 ${
				showComparisonControls
					? "grid-cols-[90px_minmax(160px,0.7fr)_minmax(190px,1fr)_220px]"
					: "grid-cols-[90px_minmax(160px,320px)]"
			}`}
		>
			<div>
				<p className="text-[9px] tracking-[0.08em] text-neutral-500">VIEW</p>
				<button
					type="button"
					className="mt-0.5 cursor-pointer text-[11px] font-medium text-neutral-200 hover:text-lime-300 focus-visible:outline-1 focus-visible:outline-lime-400"
					onClick={() => onViewportChange(FULL_LAP_TELEMETRY_VIEWPORT)}
				>
					{viewLabel}
				</button>
			</div>

			{zoomControl}

			{showComparisonControls && <div className="min-w-0">{deltaOverview}</div>}

			{showComparisonControls && (
				<div className="flex items-center justify-end gap-3">
					<div className="min-w-0 text-right" aria-live="polite">
						<p className="text-[9px] tracking-[0.08em] text-neutral-500">
							SELECTION
						</p>
						<p className="mt-0.5 truncate text-[11px] font-medium text-neutral-200">
							{selectedRegion ? (
								<>
									<span className="text-lime-300">{selectedRegion.id}</span>
									<span className="text-neutral-400">
										{" "}
										· {formatRegionRange(selectedRegion)}
									</span>
								</>
							) : (
								<span className="text-neutral-500">Choose a region above</span>
							)}
						</p>
					</div>
					<nav className="flex gap-1.5" aria-label="Selected region navigation">
						<SelectionButton
							label="Select previous region"
							disabled={!canSelectPreviousRegion}
							onClick={onSelectPreviousRegion}
						>
							<CaretLeft size={14} weight="bold" aria-hidden="true" />
						</SelectionButton>
						<SelectionButton
							label="Select next region"
							disabled={!canSelectNextRegion}
							onClick={onSelectNextRegion}
						>
							<CaretRight size={14} weight="bold" aria-hidden="true" />
						</SelectionButton>
					</nav>
				</div>
			)}
		</section>
	);
}

function SelectionButton({
	label,
	disabled,
	onClick,
	children,
}: {
	readonly label: string;
	readonly disabled: boolean;
	readonly onClick: () => void;
	readonly children: ReactNode;
}) {
	return (
		<button
			type="button"
			className="flex size-7 cursor-pointer items-center justify-center rounded-full border border-[#4a504b] text-neutral-300 transition-colors hover:border-lime-500 hover:text-lime-300 focus-visible:outline-1 focus-visible:outline-lime-400 disabled:cursor-not-allowed disabled:opacity-30"
			disabled={disabled}
			onClick={onClick}
			aria-label={label}
			title={label}
		>
			{children}
		</button>
	);
}

function ZoomButton({
	label,
	disabled,
	onClick,
	children,
}: {
	readonly label: string;
	readonly disabled: boolean;
	readonly onClick: () => void;
	readonly children: ReactNode;
}) {
	return (
		<button
			type="button"
			className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#4a504b] text-neutral-300 transition-colors hover:border-lime-500 hover:text-lime-300 focus-visible:outline-1 focus-visible:outline-lime-400 disabled:cursor-not-allowed disabled:opacity-30"
			disabled={disabled}
			onClick={onClick}
			aria-label={label}
			title={label}
		>
			{children}
		</button>
	);
}

function formatPosition(positionPercent: number): string {
	return `${Math.round(positionPercent)}%`;
}

function formatRegionRange(region: TrackRegionResponse): string {
	const startPercent = region.interval.startNormalizedTrackPosition * 100;
	const endPercent = region.interval.endNormalizedTrackPosition * 100;

	if (region.interval.crossesStartFinishLine) {
		return `${formatPosition(startPercent)}–100% / 0%–${formatPosition(endPercent)}`;
	}

	return `${formatPosition(startPercent)}–${formatPosition(endPercent)}`;
}
