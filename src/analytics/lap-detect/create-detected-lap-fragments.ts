import type { UsableTimeline } from "../frame-audit-types";
import type { DetectedLapFragment, LapCrossing } from "./lap-detect-types";

interface TimelineSegment {
	readonly startFrameIndex: number;
	readonly endFrameIndex: number;
}

export function createDetectedLapFragments(
	timeline: UsableTimeline,
	crossings: readonly LapCrossing[],
): readonly DetectedLapFragment[] {
	const orderedCrossings = [...crossings].sort(
		(first, second) => first.transitionIndex - second.transitionIndex,
	);

	return createTimelineSegments(timeline).flatMap((segment) =>
		createSegmentFragments(timeline, segment, orderedCrossings),
	);
}

function createTimelineSegments(
	timeline: UsableTimeline,
): readonly TimelineSegment[] {
	if (timeline.frames.length === 0) return [];

	const segments: TimelineSegment[] = [];
	let startFrameIndex = 0;

	for (
		let transitionIndex = 0;
		transitionIndex < timeline.transitions.length;
		transitionIndex++
	) {
		if (timeline.transitions[transitionIndex]?.timeContinuity !== "break")
			continue;

		segments.push({ startFrameIndex, endFrameIndex: transitionIndex });
		startFrameIndex = transitionIndex + 1;
	}

	segments.push({ startFrameIndex, endFrameIndex: timeline.frames.length - 1 });
	return segments;
}

function createSegmentFragments(
	timeline: UsableTimeline,
	segment: TimelineSegment,
	crossings: readonly LapCrossing[],
): readonly DetectedLapFragment[] {
	const startPosition =
		timeline.frames[segment.startFrameIndex]?.frame.normalizedTrackPosition;
	const endPosition =
		timeline.frames[segment.endFrameIndex]?.frame.normalizedTrackPosition;
	if (startPosition === undefined || endPosition === undefined) return [];

	const segmentCrossings = crossings.filter(
		({ transitionIndex }) =>
			transitionIndex >= segment.startFrameIndex &&
			transitionIndex < segment.endFrameIndex,
	);

	if (segmentCrossings.length === 0) {
		return [
			{
				startPosition,
				endPosition,
				startFrameIndex: segment.startFrameIndex,
				endFrameIndex: segment.endFrameIndex,
			},
		];
	}

	const firstCrossing = segmentCrossings[0];
	const lastCrossing = segmentCrossings.at(-1);
	if (!firstCrossing || !lastCrossing) return [];

	return [
		{
			startPosition,
			endPosition: 1,
			startFrameIndex: segment.startFrameIndex,
			endFrameIndex: firstCrossing.transitionIndex + 1,
		},
		...(endPosition === 0
			? []
			: [
					{
						startPosition: 0,
						endPosition,
						startFrameIndex: lastCrossing.transitionIndex,
						endFrameIndex: segment.endFrameIndex,
					},
				]),
	];
}
