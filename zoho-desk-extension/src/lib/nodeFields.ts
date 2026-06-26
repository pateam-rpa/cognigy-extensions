export const ZOHO_DESK_COLOR = "#0076d6";

export const connectionField = {
	key: "connection",
	label: {
		default: "Zoho Desk Connection"
	},
	type: "connection",
	params: {
		connectionType: "zoho-desk-oauth",
		required: true
	}
};

export const setChildNode = (api: any, childConfigs: any[], childType: string): void => {
	if (!childConfigs) {
		return;
	}

	const child = childConfigs.find((candidate: any) => candidate.type === childType);
	if (child && child.id) {
		api.setNextNode(child.id);
	}
};

export const lockedMiniNodeConstraints = {
	editable: false,
	deletable: false,
	creatable: false,
	movable: false,
	placement: {
		predecessor: {
			whitelist: []
		}
	}
};

export const miniNodeAppearance = {
	color: "#61d188",
	textColor: "white",
	variant: "mini" as "mini"
};

export const textField = (
	key: string,
	label: string,
	description?: string,
	required = false,
	defaultValue?: string,
	condition?: Record<string, unknown>
): any => {
	const field: any = {
		key,
		label: {
			default: label
		},
		type: "cognigyText"
	};

	if (defaultValue !== undefined) {
		field.defaultValue = defaultValue;
	}

	if (description) {
		field.description = {
			default: description
		};
	}

	if (condition) {
		field.condition = condition;
	}

	if (required) {
		field.params = {
			required: true
		};
	}

	return field;
};

export const jsonField = (
	key: string,
	label: string,
	defaultValue: string,
	description?: string
): any => {
	const field: any = {
		key,
		label: {
			default: label
		},
		type: "json",
		defaultValue
	};

	if (description) {
		field.description = {
			default: description
		};
	}

	return field;
};

export const booleanSelectField = (
	key: string,
	label: string,
	defaultValue = "",
	description?: string
): any => {
	const field: any = {
		key,
		label: {
			default: label
		},
		type: "select",
		defaultValue,
		params: {
			options: [
				{
					label: "empty",
					value: ""
				},
				{
					label: "true",
					value: "true"
				},
				{
					label: "false",
					value: "false"
				}
			]
		}
	};

	if (description) {
		field.description = {
			default: description
		};
	}

	return field;
};

export const selectField = (
	key: string,
	label: string,
	defaultValue: string,
	options: Array<{ label: string; value: string }>,
	description?: string
): any => {
	const field: any = {
		key,
		label: {
			default: label
		},
		type: "select",
		defaultValue,
		params: {
			options,
			required: true
		}
	};

	if (description) {
		field.description = {
			default: description
		};
	}

	return field;
};
