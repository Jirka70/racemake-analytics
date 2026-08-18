import type { TrackRegionResponse } from "../../../src/http/contracts";

export interface TelemetryViewport {
	readonly startPercent: number;
	readonly endPercent: number;
}

export interface TelemetryTrackRegionSegment {
	readonly id: TrackRegionResponse["id"];
	readonly type: TrackRegionResponse["type"];
	readonly startPercent: number;
	readonly endPercent: number;
	readonly showsLabel: boolean;
}

export const FULL_LAP_TELEMETRY_VIEWPORT: TelemetryViewport = {
	startPercent: 0,
	endPercent: 100,
};

export const MINIMUM_TELEMETRY_VIEWPORT_SPAN_PERCENT = 10;

export function resizeTelemetryViewport(
	viewport: TelemetryViewport,
	requestedSpanPercent: number,
): TelemetryViewport {
	const spanPercent = clamp(
		requestedSpanPercent,
		MINIMUM_TELEMETRY_VIEWPORT_SPAN_PERCENT,
		100,
	);
	const centerPercent = (viewport.startPercent + viewport.endPercent) / 2;
	const maximumStartPercent = 100 - spanPercent;
	const startPercent = clamp(
		centerPercent - spanPercent / 2,
		0,
		maximumStartPercent,
	);

	return {
		startPercent,
		endPercent: startPercent + spanPercent,
	};
}

export function moveTelemetryViewport(
	viewport: TelemetryViewport,
	requestedStartPercent: number,
): TelemetryViewport {
	const spanPercent = clamp(
		viewport.endPercent - viewport.startPercent,
		MINIMUM_TELEMETRY_VIEWPORT_SPAN_PERCENT,
		100,
	);
	const startPercent = clamp(requestedStartPercent, 0, 100 - spanPercent);

	return {
		startPercent,
		endPercent: startPercent + spanPercent,
	};
}

export function createTelemetryViewportForRange(
	startPercent: number,
	endPercent: number,
	paddingPercent = 2,
): TelemetryViewport {
	const safeStartPercent = clamp(Math.min(startPercent, endPercent), 0, 100);
	const safeEndPercent = clamp(Math.max(startPercent, endPercent), 0, 100);
	const paddedStartPercent = Math.max(0, safeStartPercent - paddingPercent);
	const paddedEndPercent = Math.min(100, safeEndPercent + paddingPercent);
	const viewport = {
		startPercent: paddedStartPercent,
		endPercent: paddedEndPercent,
	};

	return resizeTelemetryViewport(
		viewport,
		Math.max(
			MINIMUM_TELEMETRY_VIEWPORT_SPAN_PERCENT,
			paddedEndPercent - paddedStartPercent,
		),
	);
}

export function createTrackRegionSegments(
	regions: readonly TrackRegionResponse[],
): readonly TelemetryTrackRegionSegment[] {
	return regions.flatMap((region) => {
		const startPercent = region.interval.startNormalizedTrackPosition * 100;
		const endPercent = region.interval.endNormalizedTrackPosition * 100;

		if (!region.interval.crossesStartFinishLine) {
			return [
				{
					id: region.id,
					type: region.type,
					startPercent,
					endPercent,
					showsLabel: region.type === "corner",
				},
			];
		}

		const firstSegmentWidth = endPercent;
		const secondSegmentWidth = 100 - startPercent;

		return [
			{
				id: region.id,
				type: region.type,
				startPercent: 0,
				endPercent,
				showsLabel:
					region.type === "corner" && firstSegmentWidth >= secondSegmentWidth,
			},
			{
				id: region.id,
				type: region.type,
				startPercent,
				endPercent: 100,
				showsLabel:
					region.type === "corner" && secondSegmentWidth > firstSegmentWidth,
			},
		];
	});
}

export function createVisibleTrackRegionSegments(
	regions: readonly TrackRegionResponse[],
	viewport: TelemetryViewport,
): readonly TelemetryTrackRegionSegment[] {
	const viewportSpan = viewport.endPercent - viewport.startPercent;
	if (viewportSpan <= 0) return [];

	const visibleSegments = createTrackRegionSegments(regions).flatMap(
		(segment) => {
			const visibleStartPercent = Math.max(
				segment.startPercent,
				viewport.startPercent,
			);
			const visibleEndPercent = Math.min(
				segment.endPercent,
				viewport.endPercent,
			);
			if (visibleEndPercent <= visibleStartPercent) return [];

			return [
				{
					...segment,
					startPercent:
						((visibleStartPercent - viewport.startPercent) / viewportSpan) *
						100,
					endPercent:
						((visibleEndPercent - viewport.startPercent) / viewportSpan) * 100,
				},
			];
		},
	);
	const widestCornerSegmentIndexById = new Map<
		TrackRegionResponse["id"],
		number
	>();

	for (const [index, segment] of visibleSegments.entries()) {
		if (segment.type !== "corner") continue;

		const currentIndex = widestCornerSegmentIndexById.get(segment.id);
		const currentSegment =
			currentIndex === undefined ? undefined : visibleSegments[currentIndex];
		const segmentWidth = segment.endPercent - segment.startPercent;
		const currentWidth = currentSegment
			? currentSegment.endPercent - currentSegment.startPercent
			: -1;

		if (segmentWidth > currentWidth) {
			widestCornerSegmentIndexById.set(segment.id, index);
		}
	}

	return visibleSegments.map((segment, index) => ({
		...segment,
		showsLabel:
			segment.type === "corner" &&
			widestCornerSegmentIndexById.get(segment.id) === index,
	}));
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}
