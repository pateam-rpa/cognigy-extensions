import { selectField, textField } from "../../lib/nodeFields";
import { createZohoRequestNode } from "../../lib/nodeFactory";
import { buildQueryParams, optionalBooleanParam, rawQueryField } from "../../lib/query";
import { pruneEmpty } from "../../lib/json";
import { integerInRange, requiredText } from "../../lib/validation";

const ticketIdField = textField("ticketId", "Ticket ID", "The Zoho Desk ticket ID.", true);

export const getTicketResolutionNode = createZohoRequestNode({
	type: "getTicketResolution",
	defaultLabel: "Get Ticket Resolution",
	summary: "Gets the resolution details for a Zoho Desk ticket.",
	defaultStorageKey: "zohoDesk.resolution",
	fields: [
		ticketIdField
	],
	buildRequest: (config) => ({
		method: "GET",
		path: `/tickets/${encodeURIComponent(requiredText(config.ticketId, "Ticket ID"))}/resolution`
	})
});

export const getResolutionHistoryNode = createZohoRequestNode({
	type: "getResolutionHistory",
	defaultLabel: "Get Resolution History",
	summary: "Lists the resolution history for a Zoho Desk ticket.",
	defaultStorageKey: "zohoDesk.resolutionHistory",
	fields: [
		ticketIdField,
		textField("from", "From", "Zero-based result offset.", false, "0"),
		textField("limit", "Limit", "Maximum number of history records to return.", false, "25"),
		rawQueryField
	],
	sections: [
		{
			key: "options",
			label: {
				default: "Options"
			},
			defaultCollapsed: false,
			fields: [
				"ticketId",
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
		{ type: "section", key: "options" },
		{ type: "section", key: "advanced" },
		{ type: "section", key: "storage" }
	],
	buildRequest: (config) => ({
		method: "GET",
		path: `/tickets/${encodeURIComponent(requiredText(config.ticketId, "Ticket ID"))}/resolutionHistory`,
		params: buildQueryParams(config.rawQueryParams, {
			from: integerInRange(config.from, "From", 0, 0, 4999),
			limit: integerInRange(config.limit, "Limit", 25, 1, 100)
		})
	})
});

export const updateTicketResolutionNode = createZohoRequestNode({
	type: "updateTicketResolution",
	defaultLabel: "Update Ticket Resolution",
	summary: "Updates the resolution field for a Zoho Desk ticket.",
	defaultStorageKey: "zohoDesk.resolution",
	fields: [
		ticketIdField,
		textField("content", "Content", "Resolution content.", true),
		selectField("isNotifyContact", "Notify Contact", "false", [
			{
				label: "false",
				value: "false"
			},
			{
				label: "true",
				value: "true"
			}
		])
	],
	buildRequest: (config) => ({
		method: "PATCH",
		path: `/tickets/${encodeURIComponent(requiredText(config.ticketId, "Ticket ID"))}/resolution`,
		data: pruneEmpty({
			content: requiredText(config.content, "Content"),
			isNotifyContact: optionalBooleanParam(config.isNotifyContact)
		})
	})
});
