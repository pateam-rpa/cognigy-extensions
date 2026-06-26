import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { connectionField, ZOHO_DESK_COLOR } from "./nodeFields";
import { storageFields, storageSection, storeResult } from "./storage";
import { IStorageConfig, IZohoDeskConnection } from "./types";
import { serializeZohoError, IZohoRequestOptions, zohoDeskRequest } from "./zohoDeskClient";

interface IZohoNodeConfig extends IStorageConfig {
	connection: IZohoDeskConnection;
	[key: string]: unknown;
}

interface IZohoRequestNodeParams extends INodeFunctionBaseParams {
	config: IZohoNodeConfig;
}

interface IZohoRequestNodeDefinition {
	type: string;
	defaultLabel: string;
	summary: string;
	defaultStorageKey: string;
	fields?: any[];
	sections?: any[];
	form?: any[];
	buildRequest: (config: IZohoNodeConfig) => IZohoRequestOptions | Promise<IZohoRequestOptions>;
}

const formFromFields = (fields: any[]): any[] => fields.map((field: any) => ({
	type: "field",
	key: field.key
}));

export const createZohoRequestNode = (definition: IZohoRequestNodeDefinition): any => {
	const fields = [
		connectionField,
		...(definition.fields || []),
		...storageFields(definition.defaultStorageKey)
	];
	const sections = [
		...(definition.sections || []),
		storageSection
	];
	const form = definition.form || [
		{ type: "field", key: "connection" },
		...formFromFields(definition.fields || []),
		{ type: "section", key: "storage" }
	];

	return createNodeDescriptor({
		type: definition.type,
		defaultLabel: {
			default: definition.defaultLabel
		},
		summary: {
			default: definition.summary
		},
		fields,
		sections,
		form,
		appearance: {
			color: ZOHO_DESK_COLOR
		},
		function: async ({ cognigy, config }: IZohoRequestNodeParams) => {
			try {
				const request = await definition.buildRequest(config);
				const result = await zohoDeskRequest(config.connection, request);

				storeResult(cognigy, config, result);
			} catch (error) {
				storeResult(cognigy, config, serializeZohoError(error));
			}
		}
	});
};
