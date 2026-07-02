"use strict";

const assert = require("assert");
const axios = require("axios");

const extensionModule = require("../build/module");
const extension = extensionModule.default || extensionModule;
const { deleteStaleSources } = require("../build/knowledge-connectors/sharePointKnowledgeConnector");
const { SharePointGraphClient } = require("../build/lib/graphClient");
const { integerInRange, optionalBoolean } = require("../build/lib/validation");

if (!extension || !Array.isArray(extension.knowledge)) {
	throw new Error("Extension does not export a knowledge connector array.");
}

if (extension.knowledge.length !== 1) {
	throw new Error(`Expected exactly one knowledge connector, got ${extension.knowledge.length}.`);
}

if (!Array.isArray(extension.connections) || extension.connections.length !== 1) {
	throw new Error("Expected exactly one connection schema.");
}

const connector = extension.knowledge[0];
const connection = extension.connections[0];

if (connector.type !== "sharePointKnowledgeConnector") {
	throw new Error(`Unexpected connector type: ${connector.type}`);
}

if (connection.type !== "sharepoint-client-credentials") {
	throw new Error(`Unexpected connection type: ${connection.type}`);
}

if (typeof connector.function !== "function") {
	throw new Error("Knowledge connector function is missing.");
}

assert.throws(() => integerInRange("10x", "Maximum Files", 50, 1, 500), /Maximum Files must be an integer/);
assert.throws(() => optionalBoolean("maybe", true), /Boolean field must be true or false/);

const assertScopedStaleDeletion = async () => {
	const deletedSourceIds = [];

	await deleteStaleSources({
		deleteKnowledgeSource: async ({ knowledgeSourceId }) => {
			deletedSourceIds.push(knowledgeSourceId);
		}
	}, [
		{
			knowledgeSourceId: "keep",
			externalIdentifier: "keep-id",
			name: "SharePoint: General/KnowledgeAI/keep.md"
		},
		{
			knowledgeSourceId: "delete",
			externalIdentifier: "stale-id",
			name: "SharePoint: General/KnowledgeAI/stale.md"
		},
		{
			knowledgeSourceId: "outside-folder",
			externalIdentifier: "outside-id",
			name: "SharePoint: Other/outside.md"
		},
		{
			knowledgeSourceId: "outside-prefix",
			externalIdentifier: "other-prefix-id",
			name: "Other: General/KnowledgeAI/outside.md"
		}
	], new Set(["keep-id"]), "SharePoint", "General/KnowledgeAI");

	assert.deepStrictEqual(deletedSourceIds, ["delete"]);
};

const withAxiosAdapter = async (adapter, callback) => {
	const originalAdapter = axios.defaults.adapter;

	axios.defaults.adapter = adapter;

	try {
		await callback();
	} finally {
		axios.defaults.adapter = originalAdapter;
	}
};

const assertGraphTokenRefreshAndNextLinkGuard = async () => {
	let tokenRequests = 0;
	const graphRequests = [];

	await withAxiosAdapter(async config => {
		if (config.url.includes("/oauth2/v2.0/token")) {
			tokenRequests += 1;

			return {
				config,
				data: {
					access_token: `token-${tokenRequests}`,
					expires_in: 1
				},
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		graphRequests.push(config);

		if (config.url === "https://graph.microsoft.com/v1.0/drives/drive-id/root/children") {
			return {
				config,
				data: {
					value: [],
					"@odata.nextLink": "https://graph.microsoft.com/v1.0/drives/drive-id/root/children?$skiptoken=2"
				},
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		if (config.url === "https://graph.microsoft.com/v1.0/drives/drive-id/root/children?$skiptoken=2") {
			return {
				config,
				data: {
					value: []
				},
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		throw new Error(`Unexpected request URL: ${config.url}`);
	}, async () => {
		const client = new SharePointGraphClient({
			tenantId: "tenant-id",
			clientId: "client-id",
			clientSecret: "client-secret",
			requestTimeoutMs: 1000
		});

		await client.listDriveChildrenByPath("drive-id", "");
	});

	assert.strictEqual(tokenRequests, 2);
	assert.deepStrictEqual(graphRequests.map(request => request.headers.Authorization), [
		"Bearer token-1",
		"Bearer token-2"
	]);

	await withAxiosAdapter(async config => {
		if (config.url.includes("/oauth2/v2.0/token")) {
			return {
				config,
				data: {
					access_token: "token",
					expires_in: 3600
				},
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		return {
			config,
			data: {
				value: [],
				"@odata.nextLink": "https://evil.example.test/v1.0/drives/drive-id/root/children?$skiptoken=2"
			},
			headers: {},
			status: 200,
			statusText: "OK"
		};
	}, async () => {
		const client = new SharePointGraphClient({
			tenantId: "tenant-id",
			clientId: "client-id",
			clientSecret: "client-secret",
			requestTimeoutMs: 1000
		});

		await assert.rejects(() => client.listDriveChildrenByPath("drive-id", ""), /unexpected nextLink/);
	});
};

Promise.all([
	assertScopedStaleDeletion(),
	assertGraphTokenRefreshAndNextLinkGuard()
])
	.then(() => {
		console.log("Smoke check passed.");
	})
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
