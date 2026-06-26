import { jsonField, selectField, textField } from "../../lib/nodeFields";
import { createZohoRequestNode } from "../../lib/nodeFactory";
import { buildQueryParams, optionalBooleanParam, rawQueryField } from "../../lib/query";
import { parseJsonStringArray, pruneEmpty } from "../../lib/json";
import { integerInRange, optionalText, requiredText } from "../../lib/validation";

const ticketIdField = textField("ticketId", "Ticket ID", "The Zoho Desk ticket ID.", true);

export const listTicketThreadsNode = createZohoRequestNode({
	type: "listTicketThreads",
	defaultLabel: "List Ticket Threads",
	summary: "Lists threads on a Zoho Desk ticket.",
	defaultStorageKey: "zohoDesk.threads",
	fields: [
		ticketIdField,
		textField("from", "From", "Zero-based result offset.", false, "0"),
		textField("limit", "Limit", "Maximum number of threads to return.", false, "25"),
		textField("sortBy", "Sort By", "Optional Zoho sort expression, for example createdTime or -createdTime."),
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
				"limit",
				"sortBy"
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
		path: `/tickets/${encodeURIComponent(requiredText(config.ticketId, "Ticket ID"))}/threads`,
		params: buildQueryParams(config.rawQueryParams, {
			from: integerInRange(config.from, "From", 0, 0, 4999),
			limit: integerInRange(config.limit, "Limit", 25, 1, 100),
			sortBy: optionalText(config.sortBy)
		})
	})
});

export const listTicketConversationsNode = createZohoRequestNode({
	type: "listTicketConversations",
	defaultLabel: "List Ticket Conversations",
	summary: "Lists conversations on a Zoho Desk ticket.",
	defaultStorageKey: "zohoDesk.conversations",
	fields: [
		ticketIdField,
		textField("from", "From", "Zero-based result offset.", false, "0"),
		textField("limit", "Limit", "Maximum number of conversations to return.", false, "25"),
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
		path: `/tickets/${encodeURIComponent(requiredText(config.ticketId, "Ticket ID"))}/conversations`,
		params: buildQueryParams(config.rawQueryParams, {
			from: integerInRange(config.from, "From", 0, 0, 4999),
			limit: integerInRange(config.limit, "Limit", 25, 1, 100)
		})
	})
});

export const addTicketCommentNode = createZohoRequestNode({
	type: "addTicketComment",
	defaultLabel: "Add Ticket Comment",
	summary: "Adds a public or private comment to a Zoho Desk ticket.",
	defaultStorageKey: "zohoDesk.comment",
	fields: [
		ticketIdField,
		textField("content", "Content", "Comment body. Use HTML when Content Type is html.", true),
		selectField("contentType", "Content Type", "plainText", [
			{
				label: "plainText",
				value: "plainText"
			},
			{
				label: "html",
				value: "html"
			}
		]),
		selectField("isPublic", "Is Public", "true", [
			{
				label: "true",
				value: "true"
			},
			{
				label: "false",
				value: "false"
			}
		]),
		jsonField("attachmentIds", "Attachment IDs", "[]", "Optional JSON array of existing Zoho attachment IDs.")
	],
	sections: [
		{
			key: "comment",
			label: {
				default: "Comment"
			},
			defaultCollapsed: false,
			fields: [
				"ticketId",
				"content",
				"isPublic",
				"contentType"
			]
		},
		{
			key: "advanced",
			label: {
				default: "Advanced"
			},
			defaultCollapsed: true,
			fields: [
				"attachmentIds"
			]
		}
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "section", key: "comment" },
		{ type: "section", key: "advanced" },
		{ type: "section", key: "storage" }
	],
	buildRequest: (config) => {
		const attachmentIds = parseJsonStringArray(config.attachmentIds, "Attachment IDs");
		const payload = pruneEmpty({
			content: requiredText(config.content, "Content"),
			isPublic: optionalBooleanParam(config.isPublic),
			contentType: optionalText(config.contentType)
		});

		if (attachmentIds.length > 0) {
			payload.attachmentIds = attachmentIds;
		}

		return {
			method: "POST",
			path: `/tickets/${encodeURIComponent(requiredText(config.ticketId, "Ticket ID"))}/comments`,
			data: payload
		};
	}
});
