import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { connectionField, ZOHO_DESK_COLOR } from "../../lib/nodeFields";
import { parseJsonStringArray } from "../../lib/json";
import { serializeZohoError, zohoDeskRequest } from "../../lib/zohoDeskClient";
import { storageFields, storageSection, storeResult } from "../../lib/storage";
import { IStorageConfig, IZohoDeskConnection } from "../../lib/types";
import { optionalText, requiredText } from "../../lib/validation";

interface IReplyToTicketConfig extends IStorageConfig {
	connection: IZohoDeskConnection;
	ticketId: string;
	message: string;
	fromEmailAddress: string;
	to: string;
	cc?: string;
	bcc?: string;
	sendImmediately?: string;
	isForward?: string;
	threadId?: string;
	contentType: string;
	attachmentIds?: unknown;
}

interface IReplyToTicketParams extends INodeFunctionBaseParams {
	config: IReplyToTicketConfig;
}

export const replyToTicketNode = createNodeDescriptor({
	type: "replyToTicket",
	defaultLabel: {
		default: "Reply to Ticket"
	},
	summary: {
		default: "Sends an email reply on a Zoho Desk ticket."
	},
	fields: [
		connectionField,
		{
			key: "ticketId",
			label: {
				default: "Ticket ID"
			},
			type: "cognigyText",
			description: {
				default: "The Zoho Desk ticket ID."
			},
			params: {
				required: true
			}
		},
		{
			key: "message",
			label: {
				default: "Message"
			},
			type: "cognigyText",
			description: {
				default: "Reply content. Use HTML when Content Type is html."
			},
			params: {
				required: true
			}
		},
		{
			key: "fromEmailAddress",
			label: {
				default: "From Email Address"
			},
			type: "cognigyText",
			description: {
				default: "Must be a from address configured in the Zoho Desk portal."
			},
			params: {
				required: true
			}
		},
		{
			key: "to",
			label: {
				default: "To"
			},
			type: "cognigyText",
			description: {
				default: "Recipient email address for the ticket reply."
			},
			params: {
				required: true
			}
		},
		{
			key: "cc",
			label: {
				default: "CC"
			},
			type: "cognigyText",
			description: {
				default: "Optional comma-separated CC email addresses."
			}
		},
		{
			key: "bcc",
			label: {
				default: "BCC"
			},
			type: "cognigyText",
			description: {
				default: "Optional comma-separated BCC email addresses."
			}
		},
		{
			key: "contentType",
			label: {
				default: "Content Type"
			},
			type: "select",
			defaultValue: "html",
			params: {
				options: [
					{
						label: "html",
						value: "html"
					},
					{
						label: "plainText",
						value: "plainText"
					}
				],
				required: true
			}
		},
		{
			key: "sendImmediately",
			label: {
				default: "Send Immediately"
			},
			type: "select",
			defaultValue: "true",
			description: {
				default: "Whether Zoho Desk should send the reply immediately."
			},
			params: {
				options: [
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
		},
		{
			key: "isForward",
			label: {
				default: "Is Forward"
			},
			type: "select",
			defaultValue: "false",
			description: {
				default: "Set to true when using this node to forward an email thread."
			},
			params: {
				options: [
					{
						label: "false",
						value: "false"
					},
					{
						label: "true",
						value: "true"
					}
				]
			}
		},
		{
			key: "threadId",
			label: {
				default: "Thread ID"
			},
			type: "cognigyText",
			description: {
				default: "Optional ID of the email thread this reply belongs to."
			}
		},
		{
			key: "attachmentIds",
			label: {
				default: "Attachment IDs"
			},
			type: "json",
			defaultValue: "[]",
			description: {
				default: "Optional JSON array of existing Zoho attachment IDs."
			}
		},
		...storageFields("zohoDesk.reply")
	],
	sections: [
		{
			key: "advanced",
			label: {
				default: "Advanced"
			},
			defaultCollapsed: true,
			fields: [
				"contentType",
				"cc",
				"bcc",
				"sendImmediately",
				"isForward",
				"threadId",
				"attachmentIds"
			]
		},
		storageSection
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "field", key: "ticketId" },
		{ type: "field", key: "fromEmailAddress" },
		{ type: "field", key: "to" },
		{ type: "field", key: "message" },
		{ type: "section", key: "advanced" },
		{ type: "section", key: "storage" }
	],
	appearance: {
		color: ZOHO_DESK_COLOR
	},
	function: async ({ cognigy, config }: IReplyToTicketParams) => {
		try {
			const attachmentIds = parseJsonStringArray(config.attachmentIds, "Attachment IDs");
			const payload: Record<string, unknown> = {
				channel: "EMAIL",
				content: requiredText(config.message, "Message"),
				contentType: optionalText(config.contentType) || "html",
				fromEmailAddress: requiredText(config.fromEmailAddress, "From Email Address"),
				to: requiredText(config.to, "To")
			};

			const cc = optionalText(config.cc);
			const bcc = optionalText(config.bcc);
			const sendImmediately = optionalText(config.sendImmediately);
			const isForward = optionalText(config.isForward);
			const threadId = optionalText(config.threadId);

			if (cc) {
				payload.cc = cc;
			}

			if (bcc) {
				payload.bcc = bcc;
			}

			if (sendImmediately) {
				payload.sendImmediately = sendImmediately === "true";
			}

			if (isForward) {
				payload.isForward = isForward === "true";
			}

			if (threadId) {
				payload.threadId = threadId;
			}

			if (attachmentIds.length > 0) {
				payload.attachmentIds = attachmentIds;
			}

			const result = await zohoDeskRequest(config.connection, {
				method: "POST",
				path: `/tickets/${encodeURIComponent(requiredText(config.ticketId, "Ticket ID"))}/sendReply`,
				data: payload
			});

			storeResult(cognigy, config, result);
		} catch (error) {
			storeResult(cognigy, config, serializeZohoError(error));
		}
	}
});
