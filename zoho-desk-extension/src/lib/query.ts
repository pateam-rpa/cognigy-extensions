import { parseJsonObject, pruneEmpty } from "./json";

export const rawQueryField = {
	key: "rawQueryParams",
	label: {
		default: "Raw Query Parameters"
	},
	type: "json",
	defaultValue: "{}",
	description: {
		default: "Additional Zoho query parameters as JSON. Explicit node fields override matching raw keys."
	}
};

export const buildQueryParams = (
	rawQueryParams: unknown,
	params: Record<string, unknown>
): Record<string, unknown> => ({
	...parseJsonObject(rawQueryParams, "Raw Query Parameters"),
	...pruneEmpty(params)
});

export const optionalBooleanParam = (value: unknown): boolean | undefined => {
	if (value == null || value === "") {
		return undefined;
	}

	if (value === true || value === "true") {
		return true;
	}

	if (value === false || value === "false") {
		return false;
	}

	throw new Error("Boolean field must be true or false.");
};
