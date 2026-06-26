import { IConnectionSchema } from "@cognigy/extension-tools";

export const sharePointClientCredentialsConnection: IConnectionSchema = {
	type: "sharepoint-client-credentials",
	label: "SharePoint Client Credentials",
	fields: [
		{
			fieldName: "tenantId"
		},
		{
			fieldName: "clientId"
		},
		{
			fieldName: "clientSecret"
		},
		{
			fieldName: "graphBaseUrl"
		},
		{
			fieldName: "requestTimeoutMs"
		}
	]
};
