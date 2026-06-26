export interface IZohoDeskConnection {
	clientId: string;
	clientSecret: string;
	refreshToken: string;
	dataCenter?: string;
	orgId?: string;
	accountsBaseUrl?: string;
	apiBaseUrl?: string;
	requestTimeoutMs?: string;
}

export interface INormalizedZohoDeskConnection {
	clientId: string;
	clientSecret: string;
	refreshToken: string;
	orgId?: string;
	dataCenter: string;
	accountsBaseUrl: string;
	apiBaseUrl: string;
	requestTimeoutMs: number;
}

export interface IStorageConfig {
	storeLocation: "input" | "context";
	inputKey: string;
	contextKey: string;
}

export interface IZohoErrorBody {
	message?: string;
	error?: string;
	error_description?: string;
	errorCode?: string;
	code?: string;
	details?: unknown;
	data?: unknown;
}
