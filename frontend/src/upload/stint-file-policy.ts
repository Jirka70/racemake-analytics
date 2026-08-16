import { z } from "zod";
import { MAX_TELEMETRY_INGEST_SIZE_BYTES } from "../../../src/config/telemetry-ingest-config";

const JSON_FILE_NAME_PATTERN = /\.json$/i;

const SUPPORTED_JSON_MIME_TYPES = new Set([
	"",
	"application/json",
	"text/json",
]);

export const STINT_FILE_INPUT_ACCEPT = ".json,application/json,text/json";

export interface StintFileCandidate {
	readonly name: string;
	readonly size: number;
	readonly type: string;
}

export interface StintFileValidationIssue {
	readonly path: string;
	readonly message: string;
}

export type StintFileValidationResult<FileType extends StintFileCandidate> =
	| {
			readonly status: "valid";
			readonly file: FileType;
	  }
	| {
			readonly status: "invalid";
			readonly issues: readonly StintFileValidationIssue[];
	  };

const stintFileMetadataSchema: z.ZodType<StintFileCandidate> = z.object({
	name: z
		.string()
		.refine((name) => JSON_FILE_NAME_PATTERN.test(name), "Choose a JSON file."),
	size: z
		.number()
		.int()
		.min(1, "The selected file is empty.")
		.max(
			MAX_TELEMETRY_INGEST_SIZE_BYTES,
			"The selected file is larger than 100 MB.",
		),
	type: z
		.string()
		.refine(
			(type) => SUPPORTED_JSON_MIME_TYPES.has(normalizeMimeType(type)),
			"Choose a supported JSON file.",
		),
});

const stintFileSelectionSchema = z
	.array(stintFileMetadataSchema)
	.length(1, "Choose one stint file at a time.");

export function validateStintFileSelection<FileType extends StintFileCandidate>(
	files: readonly FileType[],
): StintFileValidationResult<FileType> {
	const validation = stintFileSelectionSchema.safeParse(files);

	if (!validation.success) {
		return {
			status: "invalid",
			issues: validation.error.issues.map((issue) => ({
				path: issue.path.join("."),
				message: issue.message,
			})),
		};
	}

	const file = files[0];
	if (file === undefined) {
		throw new TypeError(
			"A successful stint file validation must contain one file.",
		);
	}

	return {
		status: "valid",
		file,
	};
}

function normalizeMimeType(mimeType: string): string {
	return mimeType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}
