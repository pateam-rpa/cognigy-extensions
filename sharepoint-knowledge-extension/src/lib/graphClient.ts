import axios, { AxiosRequestConfig, Method } from "axios";

import { integerInRange, optionalText, requiredText } from "./validation";

const DEFAULT_GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const MICROSOFT_AUTHORITY_BASE_URL = "https://login.microsoftonline.com";
const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
const MIN_REQUEST_TIMEOUT_MS = 1000;
const MAX_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_TOKEN_EXPIRES_IN_SECONDS = 3600;
const TOKEN_EXPIRY_SKEW_MS = 60000;

export interface ISharePointConnection {
	tenantId: string;
	clientId: string;
	clientSecret: string;
	graphBaseUrl?: string;
	requestTimeoutMs?: string | number;
}

interface INormalizedSharePointConnection {
	tenantId: string;
	clientId: string;
	clientSecret: string;
	graphBaseUrl: string;
	requestTimeoutMs: number;
}

interface IGraphRequestOptions {
	method: Method;
	path?: string;
	url?: string;
	params?: Record<string, unknown>;
	responseType?: AxiosRequestConfig["responseType"];
	context?: string;
}

interface IGraphCollection<T> {
	value?: T[];
	"@odata.nextLink"?: string;
}

export interface IGraphSite {
	id: string;
	name?: string;
	displayName?: string;
	webUrl?: string;
}

export interface IGraphDrive {
	id: string;
	name?: string;
	webUrl?: string;
}

export interface IGraphDriveItem {
	id: string;
	name: string;
	eTag?: string;
	cTag?: string;
	lastModifiedDateTime?: string;
	size?: number;
	webUrl?: string;
	file?: {
		mimeType?: string;
	};
	folder?: {
		childCount?: number;
	};
	parentReference?: {
		path?: string;
		driveId?: string;
		siteId?: string;
	};
}

const normalizeBaseUrl = (value: string | undefined, fallback: string): string => {
	const baseUrl = value && value.trim() ? value.trim() : fallback;
	return baseUrl.replace(/\/+$/, "");
};

const ensureLeadingSlash = (value: string): string => value.startsWith("/") ? value : `/${value}`;

export const normalizeFolderPath = (value: unknown): string => {
	const text = optionalText(value);

	if (!text || text === "/") {
		return "";
	}

	return text.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
};

const normalizeSitePath = (value: unknown): string => {
	const text = optionalText(value);

	if (!text || text === "/") {
		return "/";
	}

	return `/${text.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")}`;
};

const encodePathSegments = (value: string): string => {
	return value
		.split("/")
		.filter(Boolean)
		.map((segment: string) => encodeURIComponent(segment))
		.join("/");
};

const serializeResponseBody = (value: unknown): string => {
	if (value === undefined || value === null) {
		return "";
	}

	if (Buffer.isBuffer(value)) {
		return value.toString("utf8").slice(0, 2000);
	}

	if (typeof value === "string") {
		return value.slice(0, 2000);
	}

	try {
		return JSON.stringify(value).slice(0, 2000);
	} catch (_error) {
		return String(value).slice(0, 2000);
	}
};

const graphRequestError = (error: any, context: string): Error => {
	const response = error && error.response;
	const status = response && response.status;
	const body = response && serializeResponseBody(response.data);
	const method = error && error.config && error.config.method ? String(error.config.method).toUpperCase() : "REQUEST";
	const url = error && error.config && error.config.url ? error.config.url : "";
	const isSiteResolution = context.indexOf("resolving SharePoint site") !== -1;
	const parts = [
		`Microsoft Graph request failed while ${context}.`
	];

	if (status) {
		parts.push(`Status: ${status}.`);
	}

	if (method || url) {
		parts.push(`Request: ${method} ${url}.`);
	}

	if (body) {
		parts.push(`Response: ${body}.`);
	}

	if (!status && error && error.message) {
		parts.push(`Error: ${error.message}.`);
	}

	if (isSiteResolution) {
		parts.push("Check the Site Path value. For a Teams-connected SharePoint URL such as https://tenant.sharepoint.com/:f:/r/teams/ExampleTeam/Shared%20Documents/..., use /teams/ExampleTeam. Do not change it to /sites/teams/ExampleTeam unless the actual SharePoint URL path starts with /sites/.");
	}

	return new Error(parts.join(" "));
};

const normalizeConnection = (connection: ISharePointConnection): INormalizedSharePointConnection => {
	return {
		tenantId: requiredText(connection && connection.tenantId, "Microsoft Tenant ID"),
		clientId: requiredText(connection && connection.clientId, "Microsoft Client ID"),
		clientSecret: requiredText(connection && connection.clientSecret, "Microsoft Client Secret"),
		graphBaseUrl: normalizeBaseUrl(connection && connection.graphBaseUrl, DEFAULT_GRAPH_BASE_URL),
		requestTimeoutMs: integerInRange(
			connection && connection.requestTimeoutMs,
			"Request Timeout",
			DEFAULT_REQUEST_TIMEOUT_MS,
			MIN_REQUEST_TIMEOUT_MS,
			MAX_REQUEST_TIMEOUT_MS
		)
	};
};

export class SharePointGraphClient {
	private accessToken: string | undefined;
	private accessTokenExpiresAt = 0;
	private readonly connection: INormalizedSharePointConnection;

	public constructor(connection: ISharePointConnection) {
		this.connection = normalizeConnection(connection);
	}

	public async resolveSite(hostname: string, sitePathValue: string): Promise<IGraphSite> {
		const host = requiredText(hostname, "SharePoint Hostname");
		const sitePath = normalizeSitePath(sitePathValue);
		const path = sitePath === "/"
			? `/sites/${encodeURIComponent(host)}`
			: `/sites/${encodeURIComponent(host)}:${sitePath.split("/").map((part: string) => encodeURIComponent(part)).join("/")}`;

		return this.request<IGraphSite>({
			method: "GET",
			path,
			context: `resolving SharePoint site '${host}${sitePath}'`
		});
	}

	public async getSiteDefaultDrive(siteId: string): Promise<IGraphDrive> {
		const normalizedSiteId = requiredText(siteId, "SharePoint Site ID");

		return this.request<IGraphDrive>({
			method: "GET",
			path: `/sites/${normalizedSiteId}/drive`,
			context: `resolving default document library drive for SharePoint site '${normalizedSiteId}'`
		});
	}

	public async listDriveChildrenByPath(driveId: string, folderPathValue: string): Promise<IGraphDriveItem[]> {
		const normalizedDriveId = requiredText(driveId, "SharePoint Drive ID");
		const folderPath = normalizeFolderPath(folderPathValue);
		const path = folderPath
			? `/drives/${normalizedDriveId}/root:/${encodePathSegments(folderPath)}:/children`
			: `/drives/${normalizedDriveId}/root/children`;

		return this.listCollection<IGraphDriveItem>(path, `listing SharePoint folder '${folderPath || "/"}'`);
	}

	public async listDriveItemChildren(driveId: string, itemId: string): Promise<IGraphDriveItem[]> {
		const normalizedDriveId = requiredText(driveId, "SharePoint Drive ID");
		const normalizedItemId = requiredText(itemId, "SharePoint Drive Item ID");
		const path = `/drives/${normalizedDriveId}/items/${normalizedItemId}/children`;

		return this.listCollection<IGraphDriveItem>(path, `listing SharePoint child folder item '${normalizedItemId}'`);
	}

	public async downloadDriveItemContent(driveId: string, itemId: string): Promise<Buffer> {
		const normalizedDriveId = requiredText(driveId, "SharePoint Drive ID");
		const normalizedItemId = requiredText(itemId, "SharePoint Drive Item ID");
		const data = await this.request<ArrayBuffer | Buffer>({
			method: "GET",
			path: `/drives/${normalizedDriveId}/items/${normalizedItemId}/content`,
			responseType: "arraybuffer",
			context: `downloading SharePoint file item '${normalizedItemId}'`
		});

		return Buffer.isBuffer(data) ? data : Buffer.from(data);
	}

	private async listCollection<T>(initialPath: string, context: string): Promise<T[]> {
		const items: T[] = [];
		let path: string | undefined = initialPath;
		let url: string | undefined;

		while (path || url) {
			const page = await this.request<IGraphCollection<T>>({
				method: "GET",
				path,
				url,
				context
			});

			items.push(...(page.value || []));
			path = undefined;
			url = page["@odata.nextLink"] ? this.validateNextLink(page["@odata.nextLink"], context) : undefined;
		}

		return items;
	}

	private validateNextLink(nextLink: string, context: string): string {
		let parsedNextLink: URL;
		let parsedGraphBaseUrl: URL;

		try {
			parsedNextLink = new URL(nextLink);
			parsedGraphBaseUrl = new URL(this.connection.graphBaseUrl);
		} catch (_error) {
			throw new Error(`Microsoft Graph returned an invalid nextLink while ${context}.`);
		}

		const basePath = parsedGraphBaseUrl.pathname.replace(/\/+$/, "");
		const allowedPath = parsedNextLink.pathname === basePath || parsedNextLink.pathname.startsWith(`${basePath}/`);

		if (parsedNextLink.origin !== parsedGraphBaseUrl.origin || !allowedPath) {
			throw new Error(`Microsoft Graph returned an unexpected nextLink host or path while ${context}.`);
		}

		return parsedNextLink.toString();
	}

	private async request<T>(options: IGraphRequestOptions): Promise<T> {
		const accessToken = await this.getAccessToken();
		const request: AxiosRequestConfig = {
			method: options.method,
			url: options.url || `${this.connection.graphBaseUrl}${ensureLeadingSlash(options.path || "")}`,
			params: options.params,
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${accessToken}`
			},
			responseType: options.responseType,
			timeout: this.connection.requestTimeoutMs
		};
		try {
			const response = await axios(request);

			return response.data as T;
		} catch (error) {
			throw graphRequestError(error, options.context || "calling Microsoft Graph");
		}
	}

	private async getAccessToken(): Promise<string> {
		if (this.accessToken && Date.now() < this.accessTokenExpiresAt - TOKEN_EXPIRY_SKEW_MS) {
			return this.accessToken;
		}

		const tokenUrl = `${MICROSOFT_AUTHORITY_BASE_URL}/${encodeURIComponent(this.connection.tenantId)}/oauth2/v2.0/token`;
		const body = new URLSearchParams();

		body.append("client_id", this.connection.clientId);
		body.append("client_secret", this.connection.clientSecret);
		body.append("scope", GRAPH_SCOPE);
		body.append("grant_type", "client_credentials");

		let response;

		try {
			response = await axios.post(tokenUrl, body.toString(), {
				headers: {
					Accept: "application/json",
					"Content-Type": "application/x-www-form-urlencoded"
				},
				timeout: this.connection.requestTimeoutMs
			});
		} catch (error) {
			throw graphRequestError(error, "requesting a Microsoft Graph OAuth access token");
		}

		if (!response.data || !response.data.access_token) {
			throw new Error("Microsoft Graph OAuth did not return an access token.");
		}

		const expiresInSeconds = Number(response.data.expires_in || DEFAULT_TOKEN_EXPIRES_IN_SECONDS);

		this.accessToken = response.data.access_token;
		this.accessTokenExpiresAt = Date.now() + (Number.isFinite(expiresInSeconds) ? expiresInSeconds : DEFAULT_TOKEN_EXPIRES_IN_SECONDS) * 1000;
		return this.accessToken;
	}
}
