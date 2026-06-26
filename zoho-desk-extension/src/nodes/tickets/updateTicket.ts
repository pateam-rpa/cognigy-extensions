import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { connectionField, ZOHO_DESK_COLOR } from "../../lib/nodeFields";
import { parseJsonObject } from "../../lib/json";
import { serializeZohoError, zohoDeskRequest } from "../../lib/zohoDeskClient";
import { storageFields, storageSection, storeResult } from "../../lib/storage";
import { IStorageConfig, IZohoDeskConnection } from "../../lib/types";
import { optionalText, requiredText } from "../../lib/validation";

interface IUpdateTicketConfig extends IStorageConfig {
	connection: IZohoDeskConnection;
	ticketId: string;
	ticket: unknown;
	disableClosureNotification?: string;
}

interface IUpdateTicketParams extends INodeFunctionBaseParams {
	config: IUpdateTicketConfig;
}

const defaultTicketUpdate = `{
	"status": "Open"
}`;

export const updateTicketNode = createNodeDescriptor({
	type: "updateTicket",
	defaultLabel: {
		default: "Update Ticket"
	},
	summary: {
		default: "Updates a Zoho Desk ticket by ID."
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
			key: "ticket",
			label: {
				default: "Ticket Data"
			},
			type: "json",
			defaultValue: defaultTicketUpdate,
			description: {
				default: "Zoho Desk ticket fields to patch, such as status, priority, cf, assigneeId, or teamId."
			},
			params: {
				required: true
			}
		},
		{
			key: "disableClosureNotification",
			label: {
				default: "Disable Closure Notification"
			},
			type: "select",
			defaultValue: "",
			description: {
				default: "Optional Zoho query parameter for closure notification behavior."
			},
			params: {
				options: [
					{
						label: "Do not send parameter",
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
		},
		...storageFields("zohoDesk.updatedTicket")
	],
	sections: [
		{
			key: "advanced",
			label: {
				default: "Advanced"
			},
			defaultCollapsed: true,
			fields: [
				"disableClosureNotification"
			]
		},
		storageSection
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "field", key: "ticketId" },
		{ type: "field", key: "ticket" },
		{ type: "section", key: "advanced" },
		{ type: "section", key: "storage" }
	],
	appearance: {
		color: ZOHO_DESK_COLOR
	},
	function: async ({ cognigy, config }: IUpdateTicketParams) => {
		try {
			const ticket = parseJsonObject(config.ticket, "Ticket Data");
			if (Object.keys(ticket).length === 0) {
				throw new Error("Ticket Data must contain at least one field.");
			}

			const disableClosureNotification = optionalText(config.disableClosureNotification);
			const params = disableClosureNotification ? {
				disableClosureNotification
			} : undefined;
			const result = await zohoDeskRequest(config.connection, {
				method: "PATCH",
				path: `/tickets/${encodeURIComponent(requiredText(config.ticketId, "Ticket ID"))}`,
				params,
				data: ticket
			});

			storeResult(cognigy, config, result);
		} catch (error) {
			storeResult(cognigy, config, serializeZohoError(error));
		}
	}
});
