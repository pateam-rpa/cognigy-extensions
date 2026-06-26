export const optionalText = (value: unknown): string | undefined => {
	if (value == null) {
		return undefined;
	}

	const text = String(value).trim();
	return text ? text : undefined;
};

export const requiredText = (value: unknown, fieldName: string): string => {
	const text = optionalText(value);
	if (!text) {
		throw new Error(`${fieldName} is required.`);
	}

	return text;
};

export const integerInRange = (
	value: unknown,
	fieldName: string,
	defaultValue: number,
	minimum: number,
	maximum: number
): number => {
	let numberValue: number;

	if (value == null || value === "") {
		numberValue = defaultValue;
	} else if (typeof value === "number") {
		numberValue = value;
	} else {
		const text = requiredText(value, fieldName);

		if (!/^-?\d+$/.test(text)) {
			throw new Error(`${fieldName} must be an integer between ${minimum} and ${maximum}.`);
		}

		numberValue = Number(text);
	}

	if (!Number.isInteger(numberValue) || numberValue < minimum || numberValue > maximum) {
		throw new Error(`${fieldName} must be an integer between ${minimum} and ${maximum}.`);
	}

	return numberValue;
};

export const optionalBoolean = (value: unknown, defaultValue: boolean): boolean => {
	const text = optionalText(value);

	if (text == null) {
		return defaultValue;
	}

	if (text === "true") {
		return true;
	}

	if (text === "false") {
		return false;
	}

	throw new Error("Boolean field must be true or false.");
};
