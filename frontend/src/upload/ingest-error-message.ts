import { ApiError } from "../api/api-client";

export function findIngestErrorMessage(error: Error): string {
	if (error instanceof ApiError) {
		if (error.code === "MALFORMED_JSON") {
			return "We couldn’t read this file. Choose another RACEMAKE JSON file.";
		}

		if (error.code === "INVALID_TELEMETRY_PAYLOAD") {
			return "This doesn’t look like a supported RACEMAKE stint.";
		}

		if (error.code === "UNSAFE_TELEMETRY_VALUES") {
			return error.message;
		}
	}

	return "Something went wrong while analyzing this stint. Your file was not changed.";
}
