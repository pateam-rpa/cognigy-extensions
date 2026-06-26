import { IStorageConfig } from "./types";

export const storageFields = (defaultKey: string): any[] => [
	{
		key: "storeLocation",
		type: "select",
		label: {
			default: "Where to store the result"
		},
		defaultValue: "input",
		params: {
			options: [
				{
					label: "Input",
					value: "input"
				},
				{
					label: "Context",
					value: "context"
				}
			],
			required: true
		}
	},
	{
		key: "inputKey",
		type: "cognigyText",
		label: {
			default: "Input Key to store Result"
		},
		defaultValue: defaultKey,
		condition: {
			key: "storeLocation",
			value: "input"
		}
	},
	{
		key: "contextKey",
		type: "cognigyText",
		label: {
			default: "Context Key to store Result"
		},
		defaultValue: defaultKey,
		condition: {
			key: "storeLocation",
			value: "context"
		}
	}
];

export const storageSection = {
	key: "storage",
	label: {
		default: "Storage Option"
	},
	defaultCollapsed: true,
	fields: [
		"storeLocation",
		"inputKey",
		"contextKey"
	]
};

const getStorageKey = (config: IStorageConfig): string => config.inputKey || config.contextKey || "zohoDesk";

const setDottedPath = (target: any, key: string, value: unknown): void => {
	if (!target || typeof target !== "object") {
		return;
	}

	const segments = key.split(".").map(segment => segment.trim()).filter(Boolean);

	if (segments.length === 0) {
		return;
	}

	const lastSegment = segments.pop() as string;
	let cursor = target;

	for (const segment of segments) {
		if (!cursor[segment] || typeof cursor[segment] !== "object" || Array.isArray(cursor[segment])) {
			cursor[segment] = {};
		}

		cursor = cursor[segment];
	}

	cursor[lastSegment] = value;
};

export const storeResult = (cognigy: any, config: IStorageConfig, value: unknown): void => {
	const storageKey = getStorageKey(config);

	if (config.storeLocation === "context") {
		setDottedPath(cognigy.context, storageKey, value);
		cognigy.api.addToContext(storageKey, value, "simple");
		return;
	}

	setDottedPath(cognigy.input, storageKey, value);
	cognigy.api.addToInput(storageKey, value);
};
