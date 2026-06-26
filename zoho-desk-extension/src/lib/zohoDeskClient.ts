import axios, { AxiosRequestConfig, Method } from "axios";
import { INormalizedZohoDeskConnection, IZohoDeskConnection, IZohoErrorBody } from "./types";
import { integerInRange, optionalText, requiredText } from "./validation";

const DEFAULT_DATA_CENTER = "com";
const DEFAULT_REQUEST_TIMEOUT_MS = 8000;
const MIN_REQUEST_TIMEOUT_MS = 1000;
const MAX_REQUEST_TIMEOUT_MS = 15000;
const NO_CACHE_HEADERS: Record<string, string> = {
	"Cache-Control": "no-cache, no-store, max-age=0",
	Pragma: "no-cache",
	Expires: "0"
};

interface IZohoDataCenterUrls {
	accountsBaseUrl: string;
	apiBaseUrl: string;
}

const DATA_CENTER_URLS: Record<string, IZohoDataCenterUrls> = {
	com: {
		accountsBaseUrl: "https://accounts.zoho.com",
		apiBaseUrl: "https://desk.zoho.com/api/v1"
	},
	eu: {
		accountsBaseUrl: "https://accounts.zoho.eu",
		apiBaseUrl: "https://desk.zoho.eu/api/v1"
	},
	in: {
		accountsBaseUrl: "https://accounts.zoho.in",
		apiBaseUrl: "https://desk.zoho.in/api/v1"
	},
	"com.au": {
		accountsBaseUrl: "https://accounts.zoho.com.au",
		apiBaseUrl: "https://desk.zoho.com.au/api/v1"
	},
	jp: {
		accountsBaseUrl: "https://accounts.zoho.jp",
		apiBaseUrl: "https://desk.zoho.jp/api/v1"
	},
	ca: {
		accountsBaseUrl: "https://accounts.zohocloud.ca",
		apiBaseUrl: "https://desk.zohocloud.ca/api/v1"
	},
	sa: {
		accountsBaseUrl: "https://accounts.zoho.sa",
		apiBaseUrl: "https://desk.zoho.sa/api/v1"
	},
	uk: {
		accountsBaseUrl: "https://accounts.zoho.uk",
		apiBaseUrl: "https://desk.zoho.uk/api/v1"
	}
};

export interface IZohoRequestOptions {
	method: Method;
	path: string;
	params?: Record<string, unknown>;
	data?: unknown;
	headers?: Record<string, string>;
	responseType?: AxiosRequestConfig["responseType"];
}

const normalizeBaseUrl = (value: string | undefined, fallback: string): string => {
	const baseUrl = value && value.trim() ? value.trim() : fallback;
	return baseUrl.replace(/\/+$/, "");
};

const ensureLeadingSlash = (value: string): string => value.startsWith("/") ? value : `/${value}`;

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return !!value && typeof value === "object" && !Array.isArray(value);
};

const stringField = (value: unknown): string | undefined => typeof value === "string" && value ? value : undefined;

export const normalizeDataCenter = (value: unknown): string => {
	const dataCenter = (optionalText(value) || DEFAULT_DATA_CENTER).toLowerCase();

	if (!DATA_CENTER_URLS[dataCenter]) {
		throw new Error(`Zoho Data Center must be one of: ${Object.keys(DATA_CENTER_URLS).join(", ")}.`);
	}

	return dataCenter;
};

export const getZohoDeskBaseUrls = (dataCenterValue?: unknown): IZohoDataCenterUrls => {
	const dataCenter = normalizeDataCenter(dataCenterValue);
	return DATA_CENTER_URLS[dataCenter];
};

export const normalizeConnection = (connection: IZohoDeskConnection): INormalizedZohoDeskConnection => {
	const dataCenter = normalizeDataCenter(connection && connection.dataCenter);
	const urls = DATA_CENTER_URLS[dataCenter];

	return {
		clientId: requiredText(connection && connection.clientId, "Zoho Client ID"),
		clientSecret: requiredText(connection && connection.clientSecret, "Zoho Client Secret"),
		refreshToken: requiredText(connection && connection.refreshToken, "Zoho Refresh Token"),
		orgId: optionalText(connection && connection.orgId),
		dataCenter,
		accountsBaseUrl: normalizeBaseUrl(connection && connection.accountsBaseUrl, urls.accountsBaseUrl),
		apiBaseUrl: normalizeBaseUrl(connection && connection.apiBaseUrl, urls.apiBaseUrl),
		requestTimeoutMs: integerInRange(
			connection && connection.requestTimeoutMs,
			"Request Timeout",
			DEFAULT_REQUEST_TIMEOUT_MS,
			MIN_REQUEST_TIMEOUT_MS,
			MAX_REQUEST_TIMEOUT_MS
		)
	};
};

const requestAccessToken = async (connection: INormalizedZohoDeskConnection): Promise<string> => {
	const tokenUrl = `${connection.accountsBaseUrl}/oauth/v2/token`;
	const body = new URLSearchParams();

	body.append("refresh_token", connection.refreshToken);
	body.append("client_id", connection.clientId);
	body.append("client_secret", connection.clientSecret);
	body.append("grant_type", "refresh_token");

	const response = await axios.post(tokenUrl, body.toString(), {
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded"
		},
		timeout: connection.requestTimeoutMs
	});

	if (!response.data || !response.data.access_token) {
		throw new Error("Zoho OAuth refresh did not return an access token.");
	}

	return response.data.access_token;
};

const resolveOrganizationId = async (
	connection: INormalizedZohoDeskConnection,
	accessToken: string
): Promise<string> => {
	if (connection.orgId) {
		return connection.orgId;
	}

	const response = await axios.get(`${connection.apiBaseUrl}/organizations`, {
		headers: {
			Accept: "application/json",
			Authorization: `Zoho-oauthtoken ${accessToken}`
		},
		timeout: connection.requestTimeoutMs
	});
	const organizations = response && response.data && Array.isArray(response.data.data) ? response.data.data : [];

	if (organizations.length === 1 && organizations[0].id) {
		return String(organizations[0].id);
	}

	const defaultOrganization = organizations.find((organization: any) => String(organization.isDefault) === "true");

	if (defaultOrganization && defaultOrganization.id) {
		return String(defaultOrganization.id);
	}

	if (organizations.length > 1) {
		const organizationList = organizations
			.map((organization: any) => `${organization.id || "unknown"} (${organization.portalName || organization.companyName || "unnamed"})`)
			.join(", ");

		throw new Error(`Multiple Zoho Desk organizations were found. Add the matching orgId to the connection. Found: ${organizationList}.`);
	}

	throw new Error("Zoho Desk organization ID could not be resolved from /organizations.");
};

export const getAccessToken = async (connection: IZohoDeskConnection): Promise<string> => {
	return requestAccessToken(normalizeConnection(connection));
};

export const zohoDeskRequest = async <T>(
	connection: IZohoDeskConnection,
	options: IZohoRequestOptions
): Promise<T> => {
	const normalizedConnection = normalizeConnection(connection);
	const accessToken = await requestAccessToken(normalizedConnection);
	const orgId = await resolveOrganizationId(normalizedConnection, accessToken);
	const customHeaders = options.headers || {};
	const hasContentType = Object.keys(customHeaders).some((key: string) => key.toLowerCase() === "content-type");
	const cacheHeaders = String(options.method).toUpperCase() === "GET" ? NO_CACHE_HEADERS : {};
	const headers: Record<string, string> = {
		Accept: "application/json",
		Authorization: `Zoho-oauthtoken ${accessToken}`,
		orgId,
		...cacheHeaders,
		...customHeaders
	};

	if (!hasContentType) {
		headers["Content-Type"] = "application/json";
	}

	const request: AxiosRequestConfig = {
		method: options.method,
		url: `${normalizedConnection.apiBaseUrl}${ensureLeadingSlash(options.path)}`,
		params: options.params,
		data: options.data,
		headers,
		responseType: options.responseType,
		timeout: normalizedConnection.requestTimeoutMs
	};

	const response = await axios(request);
	return response.data as T;
};

export const serializeZohoError = (error: any): { error: Record<string, unknown> } => {
	const response = error && error.response;
	const data = response && response.data;
	const body = isRecord(data) ? data as IZohoErrorBody : {};
	const thrownMessage = stringField(error && error.message) || stringField(error);
	const errorBody: Record<string, unknown> = {
		message: stringField(body.message) || stringField(body.error_description) || stringField(body.error) || thrownMessage || "Zoho Desk request failed."
	};

	if (response && response.status) {
		errorBody.status = response.status;
	}

	if (stringField(body.errorCode) || stringField(body.code)) {
		errorBody.errorCode = stringField(body.errorCode) || stringField(body.code);
	}

	if (body.details || body.data) {
		errorBody.details = body.details || body.data;
	} else if (data) {
		errorBody.details = data;
	}

	return {
		error: errorBody
	};
};

export const isZohoHttpStatus = (error: any, status: number): boolean => {
	return !!(error && error.response && error.response.status === status);
};
