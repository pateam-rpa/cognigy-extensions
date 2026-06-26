export const parseJsonObject = (value: unknown, fieldName: string): Record<string, unknown> => {
	if (value == null || value === "") {
		return {};
	}

	if (typeof value === "string") {
		let parsed: unknown;
		try {
			parsed = JSON.parse(value);
		} catch (error) {
			throw new Error(`${fieldName} must be valid JSON.`);
		}

		return parseJsonObject(parsed, fieldName);
	}

	if (Array.isArray(value) || typeof value !== "object") {
		throw new Error(`${fieldName} must be a JSON object.`);
	}

	return value as Record<string, unknown>;
};

export const parseJsonArray = (value: unknown, fieldName: string): unknown[] => {
	if (value == null || value === "") {
		return [];
	}

	if (typeof value === "string") {
		let parsed: unknown;
		try {
			parsed = JSON.parse(value);
		} catch (error) {
			throw new Error(`${fieldName} must be valid JSON.`);
		}

		return parseJsonArray(parsed, fieldName);
	}

	if (!Array.isArray(value)) {
		throw new Error(`${fieldName} must be a JSON array.`);
	}

	return value;
};

export const parseJsonStringArray = (value: unknown, fieldName: string): string[] => {
	return parseJsonArray(value, fieldName).map((item: unknown, index: number) => {
		if (typeof item !== "string" || !item.trim()) {
			throw new Error(`${fieldName} item ${index + 1} must be a non-empty string.`);
		}

		return item.trim();
	});
};

export const pruneEmpty = (value: Record<string, unknown>): Record<string, unknown> => {
	const result: Record<string, unknown> = {};

	Object.keys(value).forEach((key: string) => {
		const item = value[key];
		if (item !== undefined && item !== null && item !== "") {
			result[key] = item;
		}
	});

	return result;
};
