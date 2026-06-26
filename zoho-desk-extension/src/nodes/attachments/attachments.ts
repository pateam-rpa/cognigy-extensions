import axios from "axios";
import FormData from "form-data";
import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { booleanSelectField, connectionField, jsonField, selectField, textField, ZOHO_DESK_COLOR } from "../../lib/nodeFields";
import { createZohoRequestNode } from "../../lib/nodeFactory";
import { buildQueryParams, optionalBooleanParam, rawQueryField } from "../../lib/query";
import { parseJsonObject, pruneEmpty } from "../../lib/json";
import { storageFields, storageSection, storeResult } from "../../lib/storage";
import { IStorageConfig, IZohoDeskConnection } from "../../lib/types";
import { integerInRange, optionalText, requiredText } from "../../lib/validation";
import { normalizeConnection, serializeZohoError, zohoDeskRequest } from "../../lib/zohoDeskClient";

interface IUploadTicketAttachmentConfig extends IStorageConfig {
	connection: IZohoDeskConnection;
	ticketId: string;
	sourceType: "url" | "base64";
	fileUrl?: string;
	fileUrlHeaders?: unknown;
	base64Content?: string;
	fileName: string;
	mimeType?: string;
	isPublic?: string;
}

interface IUploadTicketAttachmentParams extends INodeFunctionBaseParams {
	config: IUploadTicketAttachmentConfig;
}

const ticketIdField = textField("ticketId", "Ticket ID", "The Zoho Desk ticket ID.", true);

const parseHeaderFields = (value: unknown): Record<string, string> => {
	const parsedHeaders = parseJsonObject(value, "File URL Headers");
	const headers: Record<string, string> = {};

	Object.keys(parsedHeaders).forEach((key: string) => {
		const headerValue = parsedHeaders[key];

		if (headerValue != null) {
			headers[key] = String(headerValue);
		}
	});

	return headers;
};

const requiredHttpUrl = (value: unknown, fieldName: string): string => {
	const rawUrl = requiredText(value, fieldName);
	let parsedUrl: URL;

	try {
		parsedUrl = new URL(rawUrl);
	} catch (_error) {
		throw new Error(`${fieldName} must be a valid URL.`);
	}

	if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
		throw new Error(`${fieldName} must use http or https.`);
	}

	return parsedUrl.toString();
};

const getUrlFile = async (config: IUploadTicketAttachmentConfig): Promise<Buffer> => {
	const normalizedConnection = normalizeConnection(config.connection);
	const response = await axios.get(requiredHttpUrl(config.fileUrl, "File URL"), {
		headers: parseHeaderFields(config.fileUrlHeaders),
		responseType: "arraybuffer",
		timeout: normalizedConnection.requestTimeoutMs
	});

	return Buffer.from(response.data);
};

const assertValidBase64 = (value: string): void => {
	if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
		throw new Error("Base64 Content must be valid base64.");
	}

	const decoded = Buffer.from(value, "base64");
	const normalizedInput = value.replace(/=+$/, "");
	const normalizedRoundTrip = decoded.toString("base64").replace(/=+$/, "");

	if (decoded.length === 0 || normalizedInput !== normalizedRoundTrip) {
		throw new Error("Base64 Content must be valid base64.");
	}
};

const getBase64File = (config: IUploadTicketAttachmentConfig): Buffer => {
	const rawContent = requiredText(config.base64Content, "Base64 Content");
	const base64Content = rawContent.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");

	if (!base64Content) {
		throw new Error("Base64 Content is required.");
	}

	assertValidBase64(base64Content);
	return Buffer.from(base64Content, "base64");
};

export const listTicketAttachmentsNode = createZohoRequestNode({
	type: "listTicketAttachments",
	defaultLabel: "List Ticket Attachments",
	summary: "Lists attachments on a Zoho Desk ticket.",
	defaultStorageKey: "zohoDesk.attachments",
	fields: [
		ticketIdField,
		textField("from", "From", "Zero-based result offset.", false, "0"),
		textField("limit", "Limit", "Maximum number of attachments to return.", false, "25"),
		textField("sortBy", "Sort By", "Optional Zoho sort expression, for example createdTime or -createdTime."),
		booleanSelectField("isPublic", "Is Public"),
		textField("include", "Include", "Optional secondary data. Zoho supports creator."),
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
				"sortBy",
				"isPublic",
				"include"
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
		path: `/tickets/${encodeURIComponent(requiredText(config.ticketId, "Ticket ID"))}/attachments`,
		params: buildQueryParams(config.rawQueryParams, {
			from: integerInRange(config.from, "From", 0, 0, 4999),
			limit: integerInRange(config.limit, "Limit", 25, 1, 100),
			sortBy: optionalText(config.sortBy),
			isPublic: optionalBooleanParam(config.isPublic),
			include: optionalText(config.include)
		})
	})
});

export const uploadTicketAttachmentNode = createNodeDescriptor({
	type: "uploadTicketAttachment",
	defaultLabel: {
		default: "Upload Ticket Attachment"
	},
	summary: {
		default: "Uploads a URL or base64 file as a Zoho Desk ticket attachment."
	},
	fields: [
		connectionField,
		ticketIdField,
		selectField("sourceType", "Source Type", "url", [
			{
				label: "url",
				value: "url"
			},
			{
				label: "base64",
				value: "base64"
			}
		], "Use a URL download or a base64 payload as the attachment source."),
		textField("fileUrl", "File URL", "URL to download and upload to Zoho.", false, undefined, {
			key: "sourceType",
			value: "url"
		}),
		jsonField("fileUrlHeaders", "File URL Headers", "{}", "Optional request headers for the source URL."),
		textField("base64Content", "Base64 Content", "Raw base64 content or a data URL.", false, undefined, {
			key: "sourceType",
			value: "base64"
		}),
		textField("fileName", "File Name", "File name sent to Zoho Desk.", true),
		textField("mimeType", "MIME Type", "Optional content type sent with the file.", false, "application/octet-stream"),
		booleanSelectField("isPublic", "Is Public", "", "Whether the attachment should be public or private."),
		...storageFields("zohoDesk.attachment")
	],
	sections: [
		{
			key: "source",
			label: {
				default: "Source"
			},
			defaultCollapsed: false,
			fields: [
				"sourceType",
				"fileUrl",
				"base64Content",
				"fileName",
				"mimeType"
			]
		},
		{
			key: "advanced",
			label: {
				default: "Advanced"
			},
			defaultCollapsed: true,
			fields: [
				"fileUrlHeaders",
				"isPublic"
			]
		},
		storageSection
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "field", key: "ticketId" },
		{ type: "section", key: "source" },
		{ type: "section", key: "advanced" },
		{ type: "section", key: "storage" }
	],
	appearance: {
		color: ZOHO_DESK_COLOR
	},
	function: async ({ cognigy, config }: IUploadTicketAttachmentParams) => {
		try {
			const fileBuffer = config.sourceType === "base64" ? getBase64File(config) : await getUrlFile(config);
			const form = new FormData();

			form.append("file", fileBuffer, {
				filename: requiredText(config.fileName, "File Name"),
				contentType: optionalText(config.mimeType) || "application/octet-stream"
			});

			const result = await zohoDeskRequest(config.connection, {
				method: "POST",
				path: `/tickets/${encodeURIComponent(requiredText(config.ticketId, "Ticket ID"))}/attachments`,
				params: pruneEmpty({
					isPublic: optionalBooleanParam(config.isPublic)
				}),
				data: form,
				headers: form.getHeaders() as Record<string, string>
			});

			storeResult(cognigy, config, result);
		} catch (error) {
			storeResult(cognigy, config, serializeZohoError(error));
		}
	}
});
