import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { connectionField, lockedMiniNodeConstraints, miniNodeAppearance, setChildNode, ZOHO_DESK_COLOR } from "../../lib/nodeFields";
import { parseJsonObject, pruneEmpty } from "../../lib/json";
import { serializeZohoError, zohoDeskRequest } from "../../lib/zohoDeskClient";
import { storageFields, storageSection, storeResult } from "../../lib/storage";
import { IStorageConfig, IZohoDeskConnection } from "../../lib/types";
import { integerInRange, optionalText } from "../../lib/validation";

interface IFilterTicketsConfig extends IStorageConfig {
	connection: IZohoDeskConnection;
	departmentId?: string;
	from?: string;
	limit?: string;
	subject?: string;
	email?: string;
	status?: string;
	priority?: string;
	ticketNumber?: string;
	contactId?: string;
	assigneeId?: string;
	sortBy?: string;
	customField1?: string;
	rawQueryParams?: unknown;
}

interface IFilterTicketsParams extends INodeFunctionBaseParams {
	config: IFilterTicketsConfig;
	childConfigs: any[];
}

const defaultRawQueryParams = "{}";

const getTicketList = (result: any): unknown[] => {
	if (Array.isArray(result)) {
		return result;
	}

	if (result && Array.isArray(result.data)) {
		return result.data;
	}

	return [];
};

export const filterTicketsNode = createNodeDescriptor({
	type: "filterTickets",
	defaultLabel: {
		default: "Filter Tickets"
	},
	summary: {
		default: "Searches Zoho Desk tickets with common and raw query parameters."
	},
	fields: [
		connectionField,
		{
			key: "departmentId",
			label: {
				default: "Department ID"
			},
			type: "cognigyText",
			description: {
				default: "Optional Zoho department ID."
			}
		},
		{
			key: "from",
			label: {
				default: "From"
			},
			type: "cognigyText",
			defaultValue: "0",
			description: {
				default: "Zero-based result offset. Zoho supports 0 through 4999."
			}
		},
		{
			key: "limit",
			label: {
				default: "Limit"
			},
			type: "cognigyText",
			defaultValue: "10",
			description: {
				default: "Maximum number of tickets to return. Zoho supports 1 through 100."
			}
		},
		{
			key: "subject",
			label: {
				default: "Subject"
			},
			type: "cognigyText"
		},
		{
			key: "email",
			label: {
				default: "Email"
			},
			type: "cognigyText"
		},
		{
			key: "status",
			label: {
				default: "Status"
			},
			type: "cognigyText"
		},
		{
			key: "priority",
			label: {
				default: "Priority"
			},
			type: "cognigyText"
		},
		{
			key: "ticketNumber",
			label: {
				default: "Ticket Number"
			},
			type: "cognigyText"
		},
		{
			key: "contactId",
			label: {
				default: "Contact ID"
			},
			type: "cognigyText"
		},
		{
			key: "assigneeId",
			label: {
				default: "Assignee ID"
			},
			type: "cognigyText"
		},
		{
			key: "sortBy",
			label: {
				default: "Sort By"
			},
			type: "cognigyText",
			description: {
				default: "Optional Zoho sort field."
			}
		},
		{
			key: "customField1",
			label: {
				default: "Custom Field 1"
			},
			type: "cognigyText",
			description: {
				default: "Optional Zoho customField1 query value, for example apiName:value."
			}
		},
		{
			key: "rawQueryParams",
			label: {
				default: "Raw Query Parameters"
			},
			type: "json",
			defaultValue: defaultRawQueryParams,
			description: {
				default: "Additional Zoho /tickets/search query parameters as JSON."
			}
		},
		...storageFields("zohoDesk.tickets")
	],
	sections: [
		{
			key: "search",
			label: {
				default: "Search"
			},
			defaultCollapsed: false,
			fields: [
				"departmentId",
				"from",
				"limit",
				"subject",
				"email",
				"status",
				"priority",
				"ticketNumber"
			]
		},
		{
			key: "advanced",
			label: {
				default: "Advanced"
			},
			defaultCollapsed: true,
			fields: [
				"contactId",
				"assigneeId",
				"sortBy",
				"customField1",
				"rawQueryParams"
			]
		},
		storageSection
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "section", key: "search" },
		{ type: "section", key: "advanced" },
		{ type: "section", key: "storage" }
	],
	appearance: {
		color: ZOHO_DESK_COLOR
	},
	dependencies: {
		children: [
			"onFoundTicketByFilter",
			"onNotFoundTicketsByFilter",
			"onErrorTicketsByFilter"
		]
	},
	function: async ({ cognigy, config, childConfigs }: IFilterTicketsParams) => {
		const { api } = cognigy;

		try {
			const rawQueryParams = parseJsonObject(config.rawQueryParams, "Raw Query Parameters");
			const from = integerInRange(config.from, "From", 0, 0, 4999);
			const limit = integerInRange(config.limit, "Limit", 10, 1, 100);
			const params = {
				...rawQueryParams,
				...pruneEmpty({
					departmentId: optionalText(config.departmentId),
					from,
					limit,
					subject: optionalText(config.subject),
					email: optionalText(config.email),
					status: optionalText(config.status),
					priority: optionalText(config.priority),
					ticketNumber: optionalText(config.ticketNumber),
					contactId: optionalText(config.contactId),
					assigneeId: optionalText(config.assigneeId),
					sortBy: optionalText(config.sortBy),
					customField1: optionalText(config.customField1)
				})
			};
			const result = await zohoDeskRequest(config.connection, {
				method: "GET",
				path: "/tickets/search",
				params
			});
			const tickets = getTicketList(result);

			setChildNode(api, childConfigs, tickets.length > 0 ? "onFoundTicketByFilter" : "onNotFoundTicketsByFilter");
			storeResult(cognigy, config, result);
		} catch (error) {
			setChildNode(api, childConfigs, "onErrorTicketsByFilter");
			storeResult(cognigy, config, serializeZohoError(error));
		}
	}
});

export const onFoundTicketByFilter = createNodeDescriptor({
	type: "onFoundTicketByFilter",
	parentType: "filterTickets",
	defaultLabel: {
		default: "On Found"
	},
	constraints: lockedMiniNodeConstraints,
	appearance: miniNodeAppearance
});

export const onNotFoundTicketsByFilter = createNodeDescriptor({
	type: "onNotFoundTicketsByFilter",
	parentType: "filterTickets",
	defaultLabel: {
		default: "On Not Found"
	},
	constraints: lockedMiniNodeConstraints,
	appearance: miniNodeAppearance
});

export const onErrorTicketsByFilter = createNodeDescriptor({
	type: "onErrorTicketsByFilter",
	parentType: "filterTickets",
	defaultLabel: {
		default: "On Error"
	},
	constraints: lockedMiniNodeConstraints,
	appearance: miniNodeAppearance
});
