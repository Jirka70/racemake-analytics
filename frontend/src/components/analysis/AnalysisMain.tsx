import { DotsSixVertical } from "@phosphor-icons/react";
import {
	type KeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	calculateDraggedCoachingRailWidth,
	clampCoachingRailWidth,
	DEFAULT_COACHING_RAIL_WIDTH_PX,
	MAXIMUM_COACHING_RAIL_WIDTH_PX,
	MINIMUM_COACHING_RAIL_WIDTH_PX,
} from "../../analysis/coaching-rail-width";
import { CoachingRail, type CoachingRailProps } from "./CoachingRail";
import type { TelemetryComparisonChartDataProps } from "./charts/TelemetryComparisonChart";
import type { TrackRegionBandProps } from "./charts/TrackRegionBand";
import type { LapPickerProps } from "./laps/LapPicker";
import { TelemetryWorkspace } from "./TelemetryWorkspace";

interface AnalysisMainProps {
	readonly lapPicker: LapPickerProps;
	readonly telemetryChart: TelemetryComparisonChartDataProps;
	readonly trackRegionBand: Omit<
		TrackRegionBandProps,
		"viewport" | "selectedRegionId" | "onSelectRegion"
	>;
	readonly coachingRail: CoachingRailProps;
}

const COACHING_RAIL_KEYBOARD_RESIZE_STEP_PX = 16;

export function AnalysisMain({
	lapPicker,
	telemetryChart,
	trackRegionBand,
	coachingRail,
}: AnalysisMainProps) {
	const [coachingRailWidthPx, setCoachingRailWidthPx] = useState(
		DEFAULT_COACHING_RAIL_WIDTH_PX,
	);
	const stopActiveCoachingRailResize = useRef<(() => void) | null>(null);

	useEffect(() => {
		return () => {
			stopActiveCoachingRailResize.current?.();
		};
	}, []);

	function startCoachingRailResize(event: ReactPointerEvent<HTMLHRElement>) {
		event.preventDefault();
		stopActiveCoachingRailResize.current?.();

		const startingPointerX = event.clientX;
		const startingWidthPx = coachingRailWidthPx;

		function resizeFromPointer(pointerEvent: globalThis.PointerEvent) {
			pointerEvent.preventDefault();
			setCoachingRailWidthPx(
				calculateDraggedCoachingRailWidth(
					startingWidthPx,
					startingPointerX,
					pointerEvent.clientX,
				),
			);
		}

		function stopResize() {
			window.removeEventListener("pointermove", resizeFromPointer);
			window.removeEventListener("pointerup", stopResize);
			window.removeEventListener("pointercancel", stopResize);
			window.removeEventListener("blur", stopResize);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			stopActiveCoachingRailResize.current = null;
		}

		window.addEventListener("pointermove", resizeFromPointer);
		window.addEventListener("pointerup", stopResize);
		window.addEventListener("pointercancel", stopResize);
		window.addEventListener("blur", stopResize);
		stopActiveCoachingRailResize.current = stopResize;
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	}

	function resizeCoachingRailWithKeyboard(event: KeyboardEvent<HTMLHRElement>) {
		let requestedWidthPx: number | null = null;

		if (event.key === "ArrowLeft") {
			requestedWidthPx =
				coachingRailWidthPx + COACHING_RAIL_KEYBOARD_RESIZE_STEP_PX;
		} else if (event.key === "ArrowRight") {
			requestedWidthPx =
				coachingRailWidthPx - COACHING_RAIL_KEYBOARD_RESIZE_STEP_PX;
		} else if (event.key === "Home") {
			requestedWidthPx = MINIMUM_COACHING_RAIL_WIDTH_PX;
		} else if (event.key === "End") {
			requestedWidthPx = MAXIMUM_COACHING_RAIL_WIDTH_PX;
		}

		if (requestedWidthPx === null) return;

		event.preventDefault();
		setCoachingRailWidthPx(clampCoachingRailWidth(requestedWidthPx));
	}

	return (
		<main
			className="grid min-h-0 flex-1 gap-1.5 p-1.5"
			style={{
				gridTemplateColumns: `minmax(0, 1fr) ${coachingRailWidthPx}px`,
			}}
		>
			<TelemetryWorkspace
				lapPicker={lapPicker}
				telemetryChart={telemetryChart}
				trackRegionBand={trackRegionBand}
			/>
			<div className="relative min-h-0 min-w-0">
				<hr
					className="peer absolute inset-y-0 -left-1.5 z-20 m-0 h-full w-3 cursor-col-resize touch-none border-0 bg-transparent outline-none"
					aria-label="Resize coaching rail"
					aria-orientation="vertical"
					aria-valuemin={MINIMUM_COACHING_RAIL_WIDTH_PX}
					aria-valuemax={MAXIMUM_COACHING_RAIL_WIDTH_PX}
					aria-valuenow={coachingRailWidthPx}
					tabIndex={0}
					onPointerDown={startCoachingRailResize}
					onKeyDown={resizeCoachingRailWithKeyboard}
				/>
				<DotsSixVertical
					className="pointer-events-none absolute top-1/2 -left-2 z-20 -translate-y-1/2 text-[#555b57] transition-colors peer-hover:text-lime-400 peer-focus-visible:text-lime-400"
					size={16}
					weight="bold"
					aria-hidden="true"
				/>
				<CoachingRail {...coachingRail} />
			</div>
		</main>
	);
}
