import { booleanSelectField, textField } from "../../lib/nodeFields";
import { createZohoRequestNode } from "../../lib/nodeFactory";
import { buildQueryParams, optionalBooleanParam, rawQueryField } from "../../lib/query";
import { integerInRange, optionalText, requiredText } from "../../lib/validation";

const paginationFields = [
	textField("from", "From", "Zero-based result offset.", false, "0"),
	textField("limit", "Limit", "Maximum number of records to return.", false, "25")
];

export const listDepartmentsNode = createZohoRequestNode({
	type: "listDepartments",
	defaultLabel: "List Departments",
	summary: "Lists Zoho Desk departments.",
	defaultStorageKey: "zohoDesk.departments",
	fields: [
		booleanSelectField("isEnabled", "Is Enabled"),
		textField("searchStr", "Search String", "Optional department search text."),
		textField("chatStatus", "Chat Status", "Optional Zoho chat status filter."),
		...paginationFields,
		rawQueryField
	],
	sections: [
		{
			key: "filters",
			label: {
				default: "Filters"
			},
			defaultCollapsed: false,
			fields: [
				"isEnabled",
				"searchStr",
				"chatStatus",
				"from",
				"limit"
			]
		},
		{
			key: "advanced",
			label: {
				default: "Advanced"
			},
			defaultCollapsed: true,
			fields: [
				"rawQueryParams"
			]
		}
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "section", key: "filters" },
		{ type: "section", key: "advanced" },
		{ type: "section", key: "storage" }
	],
	buildRequest: (config) => ({
		method: "GET",
		path: "/departments",
		params: buildQueryParams(config.rawQueryParams, {
			isEnabled: optionalBooleanParam(config.isEnabled),
			searchStr: optionalText(config.searchStr),
			chatStatus: optionalText(config.chatStatus),
			from: integerInRange(config.from, "From", 0, 0, 4999),
			limit: integerInRange(config.limit, "Limit", 25, 1, 200)
		})
	})
});

export const listAgentsNode = createZohoRequestNode({
	type: "listAgents",
	defaultLabel: "List Agents",
	summary: "Lists Zoho Desk agents.",
	defaultStorageKey: "zohoDesk.agents",
	fields: [
		textField("searchStr", "Search String", "Optional agent search text."),
		textField("status", "Status", "Optional Zoho agent status."),
		textField("departmentIds", "Department IDs", "Optional comma-separated department IDs."),
		textField("profileIds", "Profile IDs", "Optional comma-separated profile IDs."),
		textField("roleIds", "Role IDs", "Optional comma-separated role IDs."),
		textField("include", "Include", "Optional secondary data to include."),
		textField("sortOrder", "Sort Order", "Optional Zoho sort order."),
		booleanSelectField("isConfirmed", "Is Confirmed"),
		booleanSelectField("isLightAgent", "Is Light Agent"),
		...paginationFields,
		rawQueryField
	],
	sections: [
		{
			key: "filters",
			label: {
				default: "Filters"
			},
			defaultCollapsed: false,
			fields: [
				"searchStr",
				"status",
				"departmentIds",
				"from",
				"limit"
			]
		},
		{
			key: "advanced",
			label: {
				default: "Advanced"
			},
			defaultCollapsed: true,
			fields: [
				"profileIds",
				"roleIds",
				"include",
				"sortOrder",
				"isConfirmed",
				"isLightAgent",
				"rawQueryParams"
			]
		}
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "section", key: "filters" },
		{ type: "section", key: "advanced" },
		{ type: "section", key: "storage" }
	],
	buildRequest: (config) => ({
		method: "GET",
		path: "/agents",
		params: buildQueryParams(config.rawQueryParams, {
			searchStr: optionalText(config.searchStr),
			status: optionalText(config.status),
			departmentIds: optionalText(config.departmentIds),
			profileIds: optionalText(config.profileIds),
			roleIds: optionalText(config.roleIds),
			include: optionalText(config.include),
			sortOrder: optionalText(config.sortOrder),
			isConfirmed: optionalBooleanParam(config.isConfirmed),
			isLightAgent: optionalBooleanParam(config.isLightAgent),
			from: integerInRange(config.from, "From", 0, 0, 4999),
			limit: integerInRange(config.limit, "Limit", 25, 1, 200)
		})
	})
});

export const listMailReplyAddressesNode = createZohoRequestNode({
	type: "listMailReplyAddresses",
	defaultLabel: "List Mail Reply Addresses",
	summary: "Lists configured Zoho Desk mail reply addresses for a department.",
	defaultStorageKey: "zohoDesk.mailReplyAddresses",
	fields: [
		textField("departmentId", "Department ID", "Department to list reply addresses for.", true),
		booleanSelectField("isActive", "Is Active"),
		textField("from", "From", "Zero-based result offset.", false, "0"),
		textField("limit", "Limit", "Maximum number of addresses to return.", false, "25"),
		rawQueryField
	],
	sections: [
		{
			key: "filters",
			label: {
				default: "Filters"
			},
			defaultCollapsed: false,
			fields: [
				"departmentId",
				"isActive",
				"from",
				"limit"
			]
		},
		{
			key: "advanced",
			label: {
				default: "Advanced"
			},
			defaultCollapsed: true,
			fields: [
				"rawQueryParams"
			]
		}
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "section", key: "filters" },
		{ type: "section", key: "advanced" },
		{ type: "section", key: "storage" }
	],
	buildRequest: (config) => ({
		method: "GET",
		path: "/mailReplyAddress",
		params: buildQueryParams(config.rawQueryParams, {
			departmentId: requiredText(config.departmentId, "Department ID"),
			isActive: optionalBooleanParam(config.isActive),
			from: integerInRange(config.from, "From", 0, 0, 4999),
			limit: integerInRange(config.limit, "Limit", 25, 1, 100)
		})
	})
});
