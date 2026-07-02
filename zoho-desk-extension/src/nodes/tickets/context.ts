import { createNodeDescriptor } from "@cognigy/extension-tools";
import { connectionField, jsonField, selectField, textField, ZOHO_DESK_COLOR } from "../../lib/nodeFields";
import { createZohoRequestNode } from "../../lib/nodeFactory";
import { buildQueryParams, optionalBooleanParam, rawQueryField } from "../../lib/query";
import { parseJsonStringArray, pruneEmpty } from "../../lib/json";
import { storageFields, storageSection, storeResult } from "../../lib/storage";
import { integerInRange, optionalText, requiredText } from "../../lib/validation";
import { serializeZohoError, zohoDeskRequest } from "../../lib/zohoDeskClient";

const ticketIdField = textField("ticketId", "Ticket ID", "The Zoho Desk ticket ID.", true);

type CommentAuthorType = "agent" | "customer" | "both";

const getCommentTimestamp = (comment: any): number => {
	const timestamp = optionalText(
		comment && (
			comment.createdTime ||
			comment.commentTime ||
			comment.commentedTime ||
			comment.createdAt ||
			comment.modifiedTime
		)
	);
	const parsedTimestamp = timestamp ? Date.parse(timestamp) : 0;

	return Number.isNaN(parsedTimestamp) ? 0 : parsedTimestamp;
};

const getNestedText = (value: any, path: string[]): string | undefined => {
	let cursor = value;

	for (const segment of path) {
		if (!cursor || typeof cursor !== "object") {
			return undefined;
		}

		cursor = cursor[segment];
	}

	return optionalText(cursor);
};

const getCommentAuthorType = (comment: any): CommentAuthorType | "unknown" => {
	const candidates = [
		getNestedText(comment, ["author", "type"]),
		getNestedText(comment, ["commenter", "type"]),
		getNestedText(comment, ["commentedBy", "type"]),
		getNestedText(comment, ["createdBy", "type"]),
		getNestedText(comment, ["from", "type"]),
		getNestedText(comment, ["creator", "type"]),
		getNestedText(comment, ["authorType"]),
		getNestedText(comment, ["commenterType"]),
		getNestedText(comment, ["actorType"]),
		getNestedText(comment, ["direction"])
	]
		.filter(Boolean)
		.map(value => String(value).toLowerCase());

	if (candidates.some(value => ["agent", "staff", "support"].includes(value))) {
		return "agent";
	}

	if (candidates.some(value => ["customer", "contact", "enduser", "end_user", "inbound"].includes(value))) {
		return "customer";
	}

	return "unknown";
};

const parseCommentAuthorType = (value: unknown): CommentAuthorType => {
	const authorType = optionalText(value) || "both";

	if (authorType === "agent" || authorType === "customer" || authorType === "both") {
		return authorType;
	}

	throw new Error("Comment Author Type must be agent, customer, or both.");
};

const filterCommentsByAuthorType = (comments: any[], authorType: CommentAuthorType): any[] => {
	if (authorType === "both") {
		return comments;
	}

	return comments.filter(comment => getCommentAuthorType(comment) === authorType);
};

const buildCommentsResult = (response: unknown, comments: any[]): unknown => {
	if (response && typeof response === "object" && !Array.isArray(response)) {
		return {
			...(response as Record<string, unknown>),
			data: comments
		};
	}

	return {
		data: comments
	};
};

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

export const listTicketCommentsNode = createNodeDescriptor({
	type: "listTicketComments",
	defaultLabel: {
		default: "List Ticket Comments"
	},
	summary: {
		default: "Lists comments on a Zoho Desk ticket with optional author filtering and newest-first limiting."
	},
	fields: [
		connectionField,
		ticketIdField,
		textField("commentLimit", "Comment Limit", "Top number of most recent comments to return. Use 0 or leave empty for all comments.", false, "0"),
		selectField("commentAuthorType", "Comment Author Type", "both", [
			{
				label: "both",
				value: "both"
			},
			{
				label: "agent",
				value: "agent"
			},
			{
				label: "customer",
				value: "customer"
			}
		]),
		textField("pageSize", "Page Size", "Number of comments to fetch per Zoho API request.", false, "100"),
		rawQueryField,
		...storageFields("zohoDesk.comments")
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
				"commentLimit",
				"commentAuthorType"
			]
		},
		{
			key: "advanced",
			label: {
				default: "Advanced"
			},
			defaultCollapsed: true,
			fields: [
				"pageSize",
				"rawQueryParams"
			]
		},
		storageSection
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "section", key: "options" },
		{ type: "section", key: "advanced" },
		{ type: "section", key: "storage" }
	],
	appearance: {
		color: ZOHO_DESK_COLOR
	},
	function: async ({ cognigy, config }: any) => {
		try {
			const ticketId = requiredText(config.ticketId, "Ticket ID");
			const commentLimit = integerInRange(config.commentLimit, "Comment Limit", 0, 0, 5000);
			const pageSize = integerInRange(config.pageSize, "Page Size", 100, 1, 100);
			const authorType = parseCommentAuthorType(config.commentAuthorType);
			const comments: any[] = [];
			let filteredComments: any[] = [];
			let lastResponse: unknown = { data: [] };
			let from = 0;

			do {
				lastResponse = await zohoDeskRequest(config.connection, {
					method: "GET",
					path: `/tickets/${encodeURIComponent(ticketId)}/comments`,
					params: buildQueryParams(config.rawQueryParams, {
						from,
						limit: pageSize
					})
				});

				const pageComments = lastResponse && (lastResponse as any).data && Array.isArray((lastResponse as any).data)
					? (lastResponse as any).data
					: [];

				comments.push(...pageComments);
				filteredComments = filterCommentsByAuthorType(comments, authorType);

				if (pageComments.length < pageSize) {
					break;
				}

				from += pageSize;
			} while (true);

			const sortedComments = filteredComments
				.slice()
				.sort((left, right) => getCommentTimestamp(right) - getCommentTimestamp(left));
			const limitedComments = commentLimit > 0 ? sortedComments.slice(0, commentLimit) : sortedComments;

			storeResult(cognigy, config, buildCommentsResult(lastResponse, limitedComments));
		} catch (error) {
			storeResult(cognigy, config, serializeZohoError(error));
		}
	}
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
