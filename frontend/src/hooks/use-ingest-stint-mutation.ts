import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { AnalysisProgressEvent } from "../../../src/http/contracts";
import { ingestStint } from "../api/ingest-stint";

export function useIngestStintMutation() {
	const [progressEvents, setProgressEvents] = useState<
		readonly AnalysisProgressEvent[]
	>([]);
	const mutation = useMutation({
		mutationFn: (file: File) =>
			ingestStint(file, {
				onProgress: (event) => {
					setProgressEvents((events) => [...events, event]);
				},
			}),
		retry: false,
	});

	function reset(): void {
		setProgressEvents([]);
		mutation.reset();
	}

	return {
		...mutation,
		progressEvents,
		reset,
	};
}
