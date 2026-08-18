import {
	createVisibleUnrecordedSegments,
	findVisibleFragmentBoundary,
} from "../../../analysis/fragment-coverage";
import type { LapFragmentPresentation } from "../../../analysis/lap-fragment-presentation";
import type { TelemetryViewport } from "../../../analysis/telemetry-viewport";

export function FragmentCoverageOverlay({
	fragment,
	viewport,
}: {
	readonly fragment: LapFragmentPresentation;
	readonly viewport: TelemetryViewport;
}) {
	const missingSegments = createVisibleUnrecordedSegments(fragment, viewport);
	const startBoundary =
		fragment.startPosition === 0
			? null
			: findVisibleFragmentBoundary(fragment.startPosition, viewport);
	const endBoundary =
		fragment.endPosition === 1
			? null
			: findVisibleFragmentBoundary(fragment.endPosition, viewport);

	return (
		<div className="pointer-events-none absolute top-[16px] right-[12px] bottom-[36px] left-[58px] z-10 overflow-visible min-[1024px]:top-[18px] min-[1024px]:right-[18px] min-[1024px]:bottom-[38px] min-[1024px]:left-[102px]">
			{missingSegments.map((segment) => (
				<div
					key={`${segment.startPercent}:${segment.endPercent}`}
					className="absolute inset-y-0 border-x border-[#343936] bg-[#080a09]/75"
					style={{
						left: `${segment.startPercent}%`,
						width: `${segment.endPercent - segment.startPercent}%`,
					}}
				>
					{segment.endPercent - segment.startPercent >= 17 ? (
						<span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold tracking-[0.08em] text-neutral-500">
							NOT RECORDED
						</span>
					) : null}
				</div>
			))}
			{startBoundary !== null ? (
				<FragmentBoundary
					positionPercent={startBoundary}
					label="RECORDING START"
				/>
			) : null}
			{endBoundary !== null ? (
				<FragmentBoundary positionPercent={endBoundary} label="RECORDING END" />
			) : null}
		</div>
	);
}

function FragmentBoundary({
	positionPercent,
	label,
}: {
	readonly positionPercent: number;
	readonly label: string;
}) {
	return (
		<div
			className="absolute inset-y-0 border-l border-dashed border-amber-400/90"
			style={{ left: `${positionPercent}%` }}
		>
			<span className="absolute top-1 left-1 rounded-[3px] border border-amber-400/70 bg-[#18160e] px-2 py-1 text-[9px] font-semibold tracking-[0.05em] text-amber-300">
				{label}
			</span>
		</div>
	);
}
