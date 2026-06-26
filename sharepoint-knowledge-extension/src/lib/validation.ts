export const requiredText = (value: unknown, label: string): string => {
	const text = typeof value === "string" ? value.trim() : "";

	if (!text) {
		throw new Error(`${label} is required.`);
	}

	return text;
};

export const optionalText = (value: unknown): string | undefined => {
	const text = typeof value === "string" ? value.trim() : "";
	return text || undefined;
};

export const integerInRange = (
	value: unknown,
	label: string,
	defaultValue: number,
	minimum: number,
	maximum: number
): number => {
	let parsed: number;

	if (value === undefined || value === null || value === "") {
		parsed = defaultValue;
	} else if (typeof value === "number") {
		parsed = value;
	} else if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
		parsed = Number(value.trim());
	} else {
		throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`);
	}

	if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
		throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`);
	}

	return parsed;
};

export const optionalBoolean = (value: unknown, defaultValue: boolean): boolean => {
	if (value === undefined || value === null || value === "") {
		return defaultValue;
	}

	if (typeof value === "boolean") {
		return value;
	}

	if (typeof value === "string") {
		const normalizedValue = value.trim().toLowerCase();

		if (normalizedValue === "true") {
			return true;
		}

		if (normalizedValue === "false") {
			return false;
		}
	}

	throw new Error("Boolean field must be true or false.");
};
