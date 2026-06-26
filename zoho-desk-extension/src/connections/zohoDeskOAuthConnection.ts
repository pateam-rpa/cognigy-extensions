import { IConnectionSchema } from "@cognigy/extension-tools";

export const zohoDeskOAuthConnection: IConnectionSchema = {
	type: "zoho-desk-oauth",
	label: "Zoho Desk Self Client OAuth",
	fields: [
		{
			fieldName: "clientId"
		},
		{
			fieldName: "clientSecret"
		},
		{
			fieldName: "refreshToken"
		},
		{
			fieldName: "dataCenter"
		}
	]
};
