import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { connectionField, lockedMiniNodeConstraints, miniNodeAppearance, setChildNode, ZOHO_DESK_COLOR } from "../../lib/nodeFields";
import { isZohoHttpStatus, serializeZohoError, zohoDeskRequest } from "../../lib/zohoDeskClient";
import { storageFields, storageSection, storeResult } from "../../lib/storage";
import { IStorageConfig, IZohoDeskConnection } from "../../lib/types";
import { optionalText, requiredText } from "../../lib/validation";

interface IGetTicketConfig extends IStorageConfig {
	connection: IZohoDeskConnection;
	ticketId: string;
	include?: string;
}

interface IGetTicketParams extends INodeFunctionBaseParams {
	config: IGetTicketConfig;
	childConfigs: any[];
}

export const getTicketNode = createNodeDescriptor({
	type: "getTicket",
	defaultLabel: {
		default: "Get Ticket"
	},
	summary: {
		default: "Retrieves a Zoho Desk ticket by ID."
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
			key: "include",
			label: {
				default: "Include"
			},
			type: "cognigyText",
			description: {
				default: "Optional comma-separated Zoho include values, such as contacts,assignee,departments,team."
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
				"include"
			]
		},
		storageSection
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "field", key: "ticketId" },
		{ type: "section", key: "advanced" },
		{ type: "section", key: "storage" }
	],
	appearance: {
		color: ZOHO_DESK_COLOR
	},
	dependencies: {
		children: [
			"onFoundTicket",
			"onNotFoundTicket",
			"onErrorTicket"
		]
	},
	function: async ({ cognigy, config, childConfigs }: IGetTicketParams) => {
		const { api } = cognigy;

		try {
			const result = await zohoDeskRequest(config.connection, {
				method: "GET",
				path: `/tickets/${encodeURIComponent(requiredText(config.ticketId, "Ticket ID"))}`,
				params: optionalText(config.include) ? { include: optionalText(config.include) } : undefined
			});

			setChildNode(api, childConfigs, "onFoundTicket");
			storeResult(cognigy, config, result);
		} catch (error) {
			setChildNode(api, childConfigs, isZohoHttpStatus(error, 404) ? "onNotFoundTicket" : "onErrorTicket");
			storeResult(cognigy, config, serializeZohoError(error));
		}
	}
});

export const onFoundTicket = createNodeDescriptor({
	type: "onFoundTicket",
	parentType: "getTicket",
	defaultLabel: {
		default: "On Found"
	},
	constraints: lockedMiniNodeConstraints,
	appearance: miniNodeAppearance
});

export const onNotFoundTicket = createNodeDescriptor({
	type: "onNotFoundTicket",
	parentType: "getTicket",
	defaultLabel: {
		default: "On Not Found"
	},
	constraints: lockedMiniNodeConstraints,
	appearance: miniNodeAppearance
});

export const onErrorTicket = createNodeDescriptor({
	type: "onErrorTicket",
	parentType: "getTicket",
	defaultLabel: {
		default: "On Error"
	},
	constraints: lockedMiniNodeConstraints,
	appearance: miniNodeAppearance
});
