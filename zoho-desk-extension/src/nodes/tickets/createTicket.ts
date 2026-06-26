import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { connectionField, ZOHO_DESK_COLOR } from "../../lib/nodeFields";
import { parseJsonObject, pruneEmpty } from "../../lib/json";
import { serializeZohoError, zohoDeskRequest } from "../../lib/zohoDeskClient";
import { storageFields, storageSection, storeResult } from "../../lib/storage";
import { IStorageConfig, IZohoDeskConnection } from "../../lib/types";
import { optionalText, requiredText } from "../../lib/validation";

interface ICreateTicketConfig extends IStorageConfig {
	connection: IZohoDeskConnection;
	subject: string;
	departmentId: string;
	description?: string;
	email?: string;
	contactLastName?: string;
	contactId?: string;
	status?: string;
	priority?: string;
	channel?: string;
	additionalTicketFields?: unknown;
}

interface ICreateTicketParams extends INodeFunctionBaseParams {
	config: ICreateTicketConfig;
}

const defaultAdditionalTicketFields = `{
	"cf": {}
}`;

export const createTicketNode = createNodeDescriptor({
	type: "createTicket",
	defaultLabel: {
		default: "Create Ticket"
	},
	summary: {
		default: "Creates a new Zoho Desk ticket."
	},
	fields: [
		connectionField,
		{
			key: "subject",
			label: {
				default: "Subject"
			},
			type: "cognigyText",
			description: {
				default: "The subject of the new ticket."
			},
			params: {
				required: true
			}
		},
		{
			key: "departmentId",
			label: {
				default: "Department ID"
			},
			type: "cognigyText",
			description: {
				default: "Zoho Desk department ID for the ticket."
			},
			params: {
				required: true
			}
		},
		{
			key: "description",
			label: {
				default: "Description"
			},
			type: "cognigyText",
			description: {
				default: "Ticket description."
			}
		},
		{
			key: "email",
			label: {
				default: "Contact Email"
			},
			type: "cognigyText",
			description: {
				default: "Used as ticket email and to create the contact object when no Contact ID is supplied."
			}
		},
		{
			key: "contactLastName",
			label: {
				default: "Contact Last Name"
			},
			type: "cognigyText",
			description: {
				default: "Used for the contact object when no Contact ID is supplied. Falls back to Contact Email."
			}
		},
		{
			key: "contactId",
			label: {
				default: "Contact ID"
			},
			type: "cognigyText",
			description: {
				default: "Existing Zoho Desk contact ID. If supplied, no contact object is sent."
			}
		},
		{
			key: "status",
			label: {
				default: "Status"
			},
			type: "cognigyText",
			defaultValue: "Open",
			description: {
				default: "Zoho Desk status value. Text is used because portals can customize statuses."
			}
		},
		{
			key: "priority",
			label: {
				default: "Priority"
			},
			type: "cognigyText",
			description: {
				default: "Zoho Desk priority value. Text is used because portals can customize priorities."
			}
		},
		{
			key: "channel",
			label: {
				default: "Channel"
			},
			type: "cognigyText",
			defaultValue: "Chat",
			description: {
				default: "Zoho Desk channel value, for example Chat, Email, Phone, or Web."
			}
		},
		{
			key: "additionalTicketFields",
			label: {
				default: "Additional Ticket Fields"
			},
			type: "json",
			defaultValue: defaultAdditionalTicketFields,
			description: {
				default: "Optional Zoho ticket payload fields such as cf, category, assigneeId, or teamId."
			}
		},
		...storageFields("zohoDesk.ticket")
	],
	sections: [
		{
			key: "advanced",
			label: {
				default: "Advanced"
			},
			defaultCollapsed: true,
			fields: [
				"contactId",
				"contactLastName",
				"status",
				"priority",
				"channel",
				"additionalTicketFields"
			]
		},
		storageSection
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "field", key: "subject" },
		{ type: "field", key: "departmentId" },
		{ type: "field", key: "description" },
		{ type: "field", key: "email" },
		{ type: "section", key: "advanced" },
		{ type: "section", key: "storage" }
	],
	appearance: {
		color: ZOHO_DESK_COLOR
	},
	function: async ({ cognigy, config }: ICreateTicketParams) => {
		try {
			const additionalFields: Record<string, unknown> = {
				...parseJsonObject(config.additionalTicketFields, "Additional Ticket Fields")
			};
			delete additionalFields.contact;
			delete additionalFields.contactId;

			const email = optionalText(config.email);
			const contactId = optionalText(config.contactId);
			const payload: Record<string, unknown> = {
				...additionalFields,
				...pruneEmpty({
					subject: requiredText(config.subject, "Subject"),
					departmentId: requiredText(config.departmentId, "Department ID"),
					description: optionalText(config.description),
					email,
					status: optionalText(config.status),
					priority: optionalText(config.priority),
					channel: optionalText(config.channel)
				})
			};

			if (contactId) {
				payload.contactId = contactId;
			} else {
				if (!email) {
					throw new Error("Create Ticket requires Contact ID or Contact Email.");
				}

				const contact = pruneEmpty({
					email,
					lastName: optionalText(config.contactLastName) || email
				});

				payload.contact = contact;
			}

			const result = await zohoDeskRequest(config.connection, {
				method: "POST",
				path: "/tickets",
				data: payload
			});

			storeResult(cognigy, config, result);
		} catch (error) {
			storeResult(cognigy, config, serializeZohoError(error));
		}
	}
});
