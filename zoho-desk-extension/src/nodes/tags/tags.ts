import { jsonField, textField } from "../../lib/nodeFields";
import { createZohoRequestNode } from "../../lib/nodeFactory";
import { buildQueryParams, rawQueryField } from "../../lib/query";
import { parseJsonStringArray } from "../../lib/json";
import { integerInRange, optionalText, requiredText } from "../../lib/validation";

const ticketIdField = textField("ticketId", "Ticket ID", "The Zoho Desk ticket ID.", true);
const departmentIdField = textField("departmentId", "Department ID", "The Zoho Desk department ID.", true);
const tagsField = jsonField("tags", "Tags", "[]", "JSON array of tag names.");

const requiredTags = (value: unknown): string[] => {
	const tags = parseJsonStringArray(value, "Tags");

	if (tags.length === 0) {
		throw new Error("Tags must contain at least one tag name.");
	}

	return tags;
};

export const searchTagsNode = createZohoRequestNode({
	type: "searchTags",
	defaultLabel: "Search Tags",
	summary: "Searches tags in a Zoho Desk department.",
	defaultStorageKey: "zohoDesk.tags",
	fields: [
		departmentIdField,
		textField("searchVal", "Search Value", "Search keyword related to the tag."),
		textField("from", "From", "Zero-based result offset.", false, "0"),
		textField("limit", "Limit", "Maximum number of tags to return.", false, "25"),
		rawQueryField
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
				"searchVal",
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
		{ type: "section", key: "search" },
		{ type: "section", key: "advanced" },
		{ type: "section", key: "storage" }
	],
	buildRequest: (config) => ({
		method: "GET",
		path: "/tags/search",
		params: buildQueryParams(config.rawQueryParams, {
			departmentId: requiredText(config.departmentId, "Department ID"),
			searchVal: optionalText(config.searchVal),
			from: integerInRange(config.from, "From", 0, 0, 4999),
			limit: integerInRange(config.limit, "Limit", 25, 1, 100)
		})
	})
});

export const listTicketTagsNode = createZohoRequestNode({
	type: "listTicketTags",
	defaultLabel: "List Ticket Tags",
	summary: "Lists ticket tags configured in a Zoho Desk department.",
	defaultStorageKey: "zohoDesk.tags",
	fields: [
		departmentIdField,
		textField("sortBy", "Sort By", "Optional sort field. Zoho supports createdTime or count."),
		textField("from", "From", "Zero-based result offset.", false, "0"),
		textField("limit", "Limit", "Maximum number of tags to return.", false, "25"),
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
				"departmentId",
				"sortBy",
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
		path: "/ticketTags",
		params: buildQueryParams(config.rawQueryParams, {
			departmentId: requiredText(config.departmentId, "Department ID"),
			sortBy: optionalText(config.sortBy),
			from: integerInRange(config.from, "From", 0, 0, 4999),
			limit: integerInRange(config.limit, "Limit", 25, 1, 100)
		})
	})
});

export const listTagsInTicketNode = createZohoRequestNode({
	type: "listTagsInTicket",
	defaultLabel: "List Tags in Ticket",
	summary: "Lists tags currently associated with a Zoho Desk ticket.",
	defaultStorageKey: "zohoDesk.ticketTags",
	fields: [
		ticketIdField
	],
	buildRequest: (config) => ({
		method: "GET",
		path: `/tickets/${encodeURIComponent(requiredText(config.ticketId, "Ticket ID"))}/tags`
	})
});

export const addTagToTicketNode = createZohoRequestNode({
	type: "addTagToTicket",
	defaultLabel: "Add Tag to Ticket",
	summary: "Associates one or more tags with a Zoho Desk ticket.",
	defaultStorageKey: "zohoDesk.ticketTags",
	fields: [
		ticketIdField,
		tagsField
	],
	buildRequest: (config) => ({
		method: "POST",
		path: `/tickets/${encodeURIComponent(requiredText(config.ticketId, "Ticket ID"))}/associateTag`,
		data: {
			tags: requiredTags(config.tags)
		}
	})
});

export const removeTagFromTicketNode = createZohoRequestNode({
	type: "removeTagFromTicket",
	defaultLabel: "Remove Tag from Ticket",
	summary: "Dissociates one or more tags from a Zoho Desk ticket.",
	defaultStorageKey: "zohoDesk.ticketTags",
	fields: [
		ticketIdField,
		tagsField
	],
	buildRequest: (config) => ({
		method: "POST",
		path: `/tickets/${encodeURIComponent(requiredText(config.ticketId, "Ticket ID"))}/dissociateTag`,
		data: {
			tags: requiredTags(config.tags)
		}
	})
});

export const replaceTicketTagsNode = createZohoRequestNode({
	type: "replaceTicketTags",
	defaultLabel: "Replace Ticket Tags",
	summary: "Replaces one Zoho Desk tag with another tag across tickets.",
	defaultStorageKey: "zohoDesk.ticketTags",
	fields: [
		textField("tagId", "Tag ID", "Tag ID to replace.", true),
		textField("replacementTagId", "Replacement Tag ID", "Tag ID that should replace the current tag.", true)
	],
	buildRequest: (config) => ({
		method: "PATCH",
		path: `/tags/${encodeURIComponent(requiredText(config.tagId, "Tag ID"))}/replace`,
		data: {
			id: requiredText(config.replacementTagId, "Replacement Tag ID")
		}
	})
});
