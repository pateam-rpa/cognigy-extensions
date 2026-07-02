const assert = require("assert");
const axios = require("axios");

const extension = require("../build/module.js").default;
const { parseJsonStringArray } = require("../build/lib/json.js");
const { storeResult } = require("../build/lib/storage.js");
const { chunkText, stripHtml } = require("../build/lib/text.js");
const { integerInRange, optionalBoolean } = require("../build/lib/validation.js");
const { getZohoDeskBaseUrls, normalizeConnection, serializeZohoError, zohoDeskRequest } = require("../build/lib/zohoDeskClient.js");
const {
	deleteStaleSources,
	listArticlesForCategories,
	resolveArticleScope,
	validatePermission
} = require("../build/knowledge-connectors/zohoDeskKnowledgeConnector.js");
const connectionTypes = extension.connections.map(connection => connection.type);
const knowledgeTypes = (extension.knowledge || []).map(connector => connector.type);
const nodeTypes = extension.nodes.map(node => node.type);

assert(connectionTypes.includes("zoho-desk-oauth"), "Zoho Desk connection is not registered.");
assert.deepStrictEqual(knowledgeTypes, ["zohoDeskKnowledgeConnector"]);

const zohoConnection = extension.connections.find(connection => connection.type === "zoho-desk-oauth");
const connectionFieldNames = zohoConnection.fields.map(field => field.fieldName);
const zohoKnowledgeConnector = extension.knowledge.find(connector => connector.type === "zohoDeskKnowledgeConnector");

assert.strictEqual(zohoConnection.label, "Zoho Desk Self Client OAuth");
assert.deepStrictEqual(connectionFieldNames, [
	"clientId",
	"clientSecret",
	"refreshToken",
	"dataCenter"
]);
assert.strictEqual(zohoKnowledgeConnector.label, "Zoho Desk Articles");
assert.strictEqual(typeof zohoKnowledgeConnector.function, "function");
assert.deepStrictEqual(zohoKnowledgeConnector.sections, [], "Knowledge connector should not define custom sections.");
assert.deepStrictEqual(zohoKnowledgeConnector.form, [], "Knowledge connector should not define a custom form.");

const knowledgeFieldDefaults = Object.fromEntries(zohoKnowledgeConnector.fields.map(field => [field.key, field.defaultValue]));
assert.strictEqual(knowledgeFieldDefaults.knowledgeSourcePrefix, "Zoho Desk");
assert.strictEqual(knowledgeFieldDefaults.includeChildCategories, true);
assert.strictEqual(knowledgeFieldDefaults.maxArticles, 50);
assert.strictEqual(knowledgeFieldDefaults.maxChunkCharacters, 2000);
assert.deepStrictEqual(knowledgeFieldDefaults.tags, ["zoho-desk", "articles"]);

zohoKnowledgeConnector.fields.forEach(field => {
	assert.strictEqual(typeof field.label, "string", `${field.key} label should be a plain string.`);

	if (field.description) {
		assert.strictEqual(typeof field.description, "string", `${field.key} description should be a plain string.`);
	}
});

[
	"createTicket",
	"getTicket",
	"onFoundTicket",
	"onNotFoundTicket",
	"onErrorTicket",
	"updateTicket",
	"filterTickets",
	"onFoundTicketByFilter",
	"onNotFoundTicketsByFilter",
	"onErrorTicketsByFilter",
	"replyToTicket",
	"listDepartments",
	"listAgents",
	"listMailReplyAddresses",
	"listTicketThreads",
	"listTicketConversations",
	"listTicketComments",
	"addTicketComment",
	"listTicketAttachments",
	"uploadTicketAttachment",
	"searchTags",
	"listTicketTags",
	"listTagsInTicket",
	"addTagToTicket",
	"removeTagFromTicket",
	"replaceTicketTags",
	"getContact",
	"listContacts",
	"createContact",
	"updateContact",
	"listTicketsByContact",
	"getTicketResolution",
	"getResolutionHistory",
	"updateTicketResolution"
].forEach(nodeType => {
	assert(nodeTypes.includes(nodeType), `${nodeType} node is not registered.`);
});

const getTicketNode = extension.nodes.find(node => node.type === "getTicket");
const filterTicketsNode = extension.nodes.find(node => node.type === "filterTickets");
const replyToTicketNode = extension.nodes.find(node => node.type === "replyToTicket");
const listTicketCommentsNode = extension.nodes.find(node => node.type === "listTicketComments");
const uploadTicketAttachmentNode = extension.nodes.find(node => node.type === "uploadTicketAttachment");

assert.deepStrictEqual(getTicketNode.dependencies.children, [
	"onFoundTicket",
	"onNotFoundTicket",
	"onErrorTicket"
]);

assert.deepStrictEqual(filterTicketsNode.dependencies.children, [
	"onFoundTicketByFilter",
	"onNotFoundTicketsByFilter",
	"onErrorTicketsByFilter"
]);

const replyFieldKeys = replyToTicketNode.fields.map(field => field.key);

[
	"fromEmailAddress",
	"to",
	"message",
	"contentType"
].forEach(fieldKey => {
	assert(replyFieldKeys.includes(fieldKey), `Reply to Ticket is missing ${fieldKey}.`);
});

assert(!replyFieldKeys.includes("isPublic"), "Reply to Ticket should send email replies, not comments.");

const commentFieldDefaults = Object.fromEntries(listTicketCommentsNode.fields.map(field => [field.key, field.defaultValue]));
assert.strictEqual(commentFieldDefaults.commentLimit, "0");
assert.strictEqual(commentFieldDefaults.commentAuthorType, "both");
assert.strictEqual(commentFieldDefaults.pageSize, "100");

assert.deepStrictEqual(getZohoDeskBaseUrls(), {
	accountsBaseUrl: "https://accounts.zoho.com",
	apiBaseUrl: "https://desk.zoho.com/api/v1"
});

assert.deepStrictEqual(getZohoDeskBaseUrls("eu"), {
	accountsBaseUrl: "https://accounts.zoho.eu",
	apiBaseUrl: "https://desk.zoho.eu/api/v1"
});

assert.deepStrictEqual(getZohoDeskBaseUrls("ca"), {
	accountsBaseUrl: "https://accounts.zohocloud.ca",
	apiBaseUrl: "https://desk.zohocloud.ca/api/v1"
});

const normalizedLegacyConnection = normalizeConnection({
	clientId: "client-id",
	clientSecret: "client-secret",
	refreshToken: "refresh-token",
	orgId: "123456789",
	dataCenter: "eu",
	accountsBaseUrl: "https://accounts.example.test/",
	apiBaseUrl: "https://desk.example.test/api/v1/",
	requestTimeoutMs: "9000"
});

assert.strictEqual(normalizedLegacyConnection.dataCenter, "eu");
assert.strictEqual(normalizedLegacyConnection.orgId, "123456789");
assert.strictEqual(normalizedLegacyConnection.accountsBaseUrl, "https://accounts.example.test");
assert.strictEqual(normalizedLegacyConnection.apiBaseUrl, "https://desk.example.test/api/v1");
assert.strictEqual(normalizedLegacyConnection.requestTimeoutMs, 9000);
assert.throws(() => integerInRange("1e3", "Limit", 10, 1, 100), /Limit must be an integer/);
assert.deepStrictEqual(parseJsonStringArray("[\" tag-a \"]", "Tags"), ["tag-a"]);
assert.throws(() => parseJsonStringArray("[123]", "Attachment IDs"), /Attachment IDs item 1 must be a non-empty string/);
assert.strictEqual(serializeZohoError(null).error.message, "Zoho Desk request failed.");

const inputWrites = [];
const storageCognigy = {
	input: {
		zohoDesk: {
			tickets: {
				data: [{ id: "stale-ticket" }]
			}
		}
	},
	context: {},
	api: {
		addToContext: () => {
			throw new Error("Input storage should not write to context.");
		},
		addToInput: (...args) => inputWrites.push(args)
	}
};

storeResult(storageCognigy, {
	storeLocation: "input",
	inputKey: "zohoDesk.tickets",
	contextKey: ""
}, {
	data: []
});

assert.deepStrictEqual(inputWrites, [
	["zohoDesk.tickets", { data: [] }]
]);
assert.deepStrictEqual(storageCognigy.input.zohoDesk.tickets, { data: [] });

const readHeader = (headers, key) => {
	if (headers && typeof headers.get === "function") {
		return headers.get(key);
	}

	return headers && (headers[key] || headers[key.toLowerCase()]);
};

const knowledgeConnection = {
	clientId: "client-id",
	clientSecret: "client-secret",
	refreshToken: "refresh-token",
	orgId: "123456789",
	dataCenter: "eu"
};

const knowledgeTree = {
	id: "root-1",
	name: "Support",
	translations: [
		{
			name: "Help"
		}
	],
	children: [
		{
			id: "getting-started-id",
			name: "Getting Started",
			children: [
				{
					id: "agents-id",
					name: "Agents",
					children: []
				}
			]
		}
	]
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

const tokenOr = (config, data) => {
	if (config.url.endsWith("/oauth/v2/token")) {
		return {
			config,
			data: {
				access_token: "access-token"
			},
			headers: {},
			status: 200,
			statusText: "OK"
		};
	}

	return data();
};

const assertKnowledgeValidationAndTextHelpers = () => {
	assert.strictEqual(validatePermission("all"), "ALL");
	assert.strictEqual(validatePermission(""), undefined);
	assert.throws(() => validatePermission("PUBLIC"), /Permission must be empty/);
	assert.strictEqual(optionalBoolean(true, false), true);
	assert.strictEqual(optionalBoolean(false, true), false);

	assert.strictEqual(stripHtml("<script>bad()</script><p>A&nbsp;B<br>C</p>"), "A B\nC");
	assert(chunkText(`Intro\n\n${"x".repeat(550)}`, 500).every(chunk => chunk.length <= 500));
};

const assertKnowledgeScopeNameResolution = async () => {
	await withAxiosAdapter(async config => tokenOr(config, () => {
		if (config.url.endsWith("/kbRootCategories")) {
			return {
				config,
				data: {
					data: [
						knowledgeTree
					]
				},
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		if (config.url.endsWith("/kbRootCategories/root-1/categoryTree")) {
			return {
				config,
				data: knowledgeTree,
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		throw new Error(`Unexpected request URL: ${config.url}`);
	}), async () => {
		const scope = await resolveArticleScope(knowledgeConnection, {
			rootCategoryName: "support",
			categoryPath: "Getting Started",
			includeChildCategories: true,
			permission: "agents"
		});

		assert.strictEqual(scope.rootCategoryId, "root-1");
		assert.strictEqual(scope.selectedCategoryId, "getting-started-id");
		assert.deepStrictEqual(scope.categoryIds, [
			"getting-started-id",
			"agents-id"
		]);
		assert.strictEqual(scope.scopeKey, "root-root-1:category-getting-started-id:children-true:permission-AGENTS");
	});
};

const assertKnowledgeAmbiguousNamesFail = async () => {
	await assert.rejects(() => withAxiosAdapter(async config => tokenOr(config, () => {
		if (config.url.endsWith("/kbRootCategories")) {
			return {
				config,
				data: {
					data: [
						{
							id: "root-1",
							name: "Support"
						},
						{
							id: "root-2",
							translations: [
								{
									name: "support"
								}
							]
						}
					]
				},
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		throw new Error(`Unexpected request URL: ${config.url}`);
	}), async () => {
		await resolveArticleScope(knowledgeConnection, {
			rootCategoryName: "Support"
		});
	}), /ambiguous.*Root Category ID/);

	await assert.rejects(() => withAxiosAdapter(async config => tokenOr(config, () => {
		if (config.url.endsWith("/kbRootCategories/root-1/categoryTree")) {
			return {
				config,
				data: {
					id: "root-1",
					name: "Support",
					children: [
						{
							id: "agents-1",
							name: "Agents"
						},
						{
							id: "agents-2",
							translations: [
								{
									name: "agents"
								}
							]
						}
					]
				},
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		throw new Error(`Unexpected request URL: ${config.url}`);
	}), async () => {
		await resolveArticleScope(knowledgeConnection, {
			rootCategoryId: "root-1",
			categoryPath: "Agents"
		});
	}), /ambiguous.*Category ID/);
};

const assertKnowledgeExactIdFallback = async () => {
	const rootListRequests = [];

	await withAxiosAdapter(async config => tokenOr(config, () => {
		if (config.url.endsWith("/kbRootCategories")) {
			rootListRequests.push(config);
		}

		if (config.url.endsWith("/kbRootCategories/root-1/categoryTree")) {
			return {
				config,
				data: knowledgeTree,
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		throw new Error(`Unexpected request URL: ${config.url}`);
	}), async () => {
		const scope = await resolveArticleScope(knowledgeConnection, {
			rootCategoryId: "root-1",
			categoryId: "agents-id",
			includeChildCategories: false
		});

		assert.strictEqual(scope.selectedCategoryId, "agents-id");
		assert.deepStrictEqual(scope.categoryIds, [
			"agents-id"
		]);
	});

	assert.deepStrictEqual(rootListRequests, []);
};

const assertKnowledgeArticlePagination = async () => {
	const articleRequests = [];

	await withAxiosAdapter(async config => tokenOr(config, () => {
		if (config.url.endsWith("/articles")) {
			articleRequests.push(config);

			return {
				config,
				data: {
					data: config.params.from === 0
						? Array.from({ length: 50 }, (_item, index) => ({
							id: `article-${index}`,
							title: `Article ${index}`
						}))
						: [
							{
								id: "article-50",
								title: "Article 50"
							}
						]
				},
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		throw new Error(`Unexpected request URL: ${config.url}`);
	}), async () => {
		const result = await listArticlesForCategories(knowledgeConnection, ["agents-id"], 51, "AGENTS");

		assert.strictEqual(result.articles.length, 51);
		assert.strictEqual(result.truncated, false);
	});

	assert.deepStrictEqual(articleRequests.map(request => request.params), [
		{
			from: 0,
			limit: 50,
			status: "Published",
			categoryId: "agents-id",
			permission: "AGENTS"
		},
		{
			from: 50,
			limit: 50,
			status: "Published",
			categoryId: "agents-id",
			permission: "AGENTS"
		}
	]);

	await withAxiosAdapter(async config => tokenOr(config, () => {
		if (config.url.endsWith("/articles")) {
			return {
				config,
				data: {
					data: Array.from({ length: 50 }, (_item, index) => ({
						id: `full-page-article-${index}`,
						title: `Full Page Article ${index}`
					}))
				},
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		throw new Error(`Unexpected request URL: ${config.url}`);
	}), async () => {
		const result = await listArticlesForCategories(knowledgeConnection, ["agents-id"], 50, undefined);

		assert.strictEqual(result.articles.length, 50);
		assert.strictEqual(result.truncated, true);
	});
};

const assertKnowledgeConnectorImportsAndCleansScope = async () => {
	const articleRequests = [];
	const detailRequests = [];
	const deletedSourceIds = [];
	const chunks = [];
	const scopeKey = "root-root-1:category-getting-started-id:children-true:permission-AGENTS";

	await withAxiosAdapter(async config => tokenOr(config, () => {
		if (config.url.endsWith("/kbRootCategories")) {
			return {
				config,
				data: {
					data: [
						knowledgeTree
					]
				},
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		if (config.url.endsWith("/kbRootCategories/root-1/categoryTree")) {
			return {
				config,
				data: knowledgeTree,
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		if (config.url.endsWith("/articles")) {
			articleRequests.push(config);

			return {
				config,
				data: {
					data: config.params.categoryId === "getting-started-id"
						? [
							{
								id: "article-1",
								title: "One",
								latestPublishedVersion: "1.0"
							}
						]
						: [
							{
								id: "article-1",
								title: "One duplicate",
								latestPublishedVersion: "1.0"
							},
							{
								id: "article-2",
								title: "Two",
								latestPublishedVersion: "null"
							}
						]
				},
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		if (config.url.endsWith("/articles/article-1") || config.url.endsWith("/articles/article-2")) {
			detailRequests.push(config);
			const id = config.url.split("/").pop();

			return {
				config,
				data: {
					id,
					title: id === "article-1" ? "One" : "Two",
					summary: "Short &amp; <b>useful</b>",
					answer: "<p>First paragraph.<br>Still first paragraph.</p><p>Second paragraph.</p>",
					articleNumber: id === "article-1" ? "101" : "102",
					categoryId: id === "article-1" ? "getting-started-id" : "agents-id",
					category: {
						id: id === "article-1" ? "getting-started-id" : "agents-id",
						name: id === "article-1" ? "Getting Started" : "Agents"
					},
					latestPublishedVersion: id === "article-1" ? "1.0" : "2.0",
					latestVersion: id === "article-1" ? "1.0" : "2.0",
					modifiedTime: "2026-07-02T10:00:00.000Z",
					permission: "AGENTS",
					portalUrl: `https://desk.example.test/kb/articles/${id}`,
					status: "Published",
					webUrl: `https://desk.example.test/support/${id}`
				},
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		throw new Error(`Unexpected request URL: ${config.url}`);
	}), async () => {
		await zohoKnowledgeConnector.function({
			config: {
				connection: knowledgeConnection,
				knowledgeSourcePrefix: "Zoho Desk",
				rootCategoryName: "Support",
				categoryPath: "Getting Started",
				includeChildCategories: true,
				permission: "AGENTS",
				maxArticles: "10",
				maxChunkCharacters: "500",
				tags: ["articles", "kb"]
			},
			sources: [
				{
					knowledgeSourceId: "stale-source",
					name: "Zoho Desk: Support: Getting Started subtree: Stale",
					externalIdentifier: `zohoDesk:published:${scopeKey}:article:stale`,
					chunkCount: 1
				},
				{
					knowledgeSourceId: "outside-source",
					name: "Zoho Desk: Other: Stale",
					externalIdentifier: "zohoDesk:published:root-other:category-other:children-true:permission-AGENTS:article:stale",
					chunkCount: 1
				}
			],
			api: {
				upsertKnowledgeSource: async params => {
					if (params.externalIdentifier.endsWith(":article:article-1")) {
						return null;
					}

					assert.deepStrictEqual(params.tags, [
						"zoho-desk",
						"articles",
						"kb"
					]);
					assert.strictEqual(params.description, "Zoho Desk article Two");
					return {
						knowledgeSourceId: "source-2"
					};
				},
				createKnowledgeChunk: async params => {
					chunks.push(params);
					return {};
				},
				deleteKnowledgeSource: async params => {
					deletedSourceIds.push(params.knowledgeSourceId);
					return {};
				}
			}
		});
	});

	assert.deepStrictEqual(articleRequests.map(request => request.params.categoryId), [
		"getting-started-id",
		"agents-id"
	]);
	assert.deepStrictEqual(detailRequests.map(request => request.params), [
		{
			version: "1.0"
		},
		{}
	]);
	assert.strictEqual(chunks.length, 1);
	assert.strictEqual(chunks[0].knowledgeSourceId, "source-2");
	assert(!chunks[0].text.includes("<b>"));
	assert(chunks[0].text.includes("First paragraph.\nStill first paragraph."));
	assert.strictEqual(chunks[0].data.categoryName, "Agents");
	assert.strictEqual(chunks[0].data.rootCategoryName, "Support");
	assert.strictEqual(chunks[0].data.selectedCategoryName, "Getting Started");
	assert.deepStrictEqual(deletedSourceIds, ["stale-source"]);
};

const assertKnowledgeCleanupSkipsWhenTruncated = async () => {
	const deletedSourceIds = [];

	await withAxiosAdapter(async config => tokenOr(config, () => {
		if (config.url.endsWith("/kbRootCategories/root-1/categoryTree")) {
			return {
				config,
				data: knowledgeTree,
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		if (config.url.endsWith("/articles")) {
			return {
				config,
				data: {
					data: [
						{
							id: "article-1",
							title: "One"
						},
						{
							id: "article-2",
							title: "Two"
						}
					]
				},
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		if (config.url.endsWith("/articles/article-1")) {
			return {
				config,
				data: {
					id: "article-1",
					title: "One",
					answer: "<p>Imported</p>",
					modifiedTime: "2026-07-02T10:00:00.000Z"
				},
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		throw new Error(`Unexpected request URL: ${config.url}`);
	}), async () => {
		await zohoKnowledgeConnector.function({
			config: {
				connection: knowledgeConnection,
				knowledgeSourcePrefix: "Zoho Desk",
				rootCategoryId: "root-1",
				categoryId: "agents-id",
				includeChildCategories: false,
				maxArticles: "1",
				maxChunkCharacters: "500",
				tags: []
			},
			sources: [
				{
					knowledgeSourceId: "stale-source",
					name: "Zoho Desk: Support: Agents: Stale",
					externalIdentifier: "zohoDesk:published:root-root-1:category-agents-id:children-false:permission-any:article:stale",
					chunkCount: 1
				}
			],
			api: {
				upsertKnowledgeSource: async () => ({
					knowledgeSourceId: "source-1"
				}),
				createKnowledgeChunk: async () => ({}),
				deleteKnowledgeSource: async params => {
					deletedSourceIds.push(params.knowledgeSourceId);
					return {};
				}
			}
		});
	});

	assert.deepStrictEqual(deletedSourceIds, []);
};

const assertKnowledgeDeleteStaleSources = async () => {
	const deletedSourceIds = [];

	await deleteStaleSources({
		deleteKnowledgeSource: async params => {
			deletedSourceIds.push(params.knowledgeSourceId);
			return {};
		}
	}, [
		{
			knowledgeSourceId: "keep",
			name: "Zoho Desk: Support: Keep",
			externalIdentifier: "zohoDesk:published:scope:article:keep",
			chunkCount: 1
		},
		{
			knowledgeSourceId: "delete",
			name: "Zoho Desk: Support: Delete",
			externalIdentifier: "zohoDesk:published:scope:article:delete",
			chunkCount: 1
		},
		{
			knowledgeSourceId: "outside",
			name: "Zoho Desk: Other: Delete",
			externalIdentifier: "zohoDesk:published:other:article:delete",
			chunkCount: 1
		}
	], new Set(["zohoDesk:published:scope:article:keep"]), "Zoho Desk", {
		scopeKey: "scope",
		scopeLabel: "Support",
		categoryIds: [],
		exhaustive: true
	});

	assert.deepStrictEqual(deletedSourceIds, ["delete"]);
};

const assertNoCacheGetHeaders = async () => {
	const originalAdapter = axios.defaults.adapter;
	const requests = [];

	axios.defaults.adapter = async config => {
		requests.push(config);

		return {
			config,
			data: config.url.endsWith("/oauth/v2/token") ? { access_token: "access-token" } : { data: [] },
			headers: {},
			status: 200,
			statusText: "OK"
		};
	};

	try {
		await zohoDeskRequest({
			clientId: "client-id",
			clientSecret: "client-secret",
			refreshToken: "refresh-token",
			orgId: "123456789",
			dataCenter: "eu"
		}, {
			method: "GET",
			path: "/tickets/search",
			params: {
				subject: "cached lookup"
			}
		});
	} finally {
		axios.defaults.adapter = originalAdapter;
	}

	const ticketSearchRequest = requests.find(request => request.url.endsWith("/tickets/search"));

	assert(ticketSearchRequest, "Ticket search request was not issued.");
	assert.strictEqual(readHeader(ticketSearchRequest.headers, "Cache-Control"), "no-cache, no-store, max-age=0");
	assert.strictEqual(readHeader(ticketSearchRequest.headers, "Pragma"), "no-cache");
	assert.strictEqual(readHeader(ticketSearchRequest.headers, "Expires"), "0");
};

const assertFilterBranchesAndStoresFreshResult = async () => {
	const originalAdapter = axios.defaults.adapter;
	const events = [];
	const filterCognigy = {
		input: {
			zohoDesk: {
				tickets: {
					data: [{ id: "stale-ticket" }]
				}
			}
		},
		context: {},
		api: {
			addToContext: () => {
				throw new Error("Input storage should not write to context.");
			},
			addToInput: (...args) => events.push(["store", ...args]),
			setNextNode: id => events.push(["next", id])
		}
	};

	axios.defaults.adapter = async config => {
		return {
			config,
			data: config.url.endsWith("/oauth/v2/token") ? { access_token: "access-token" } : { data: [{ id: "ticket-id" }] },
			headers: {},
			status: 200,
			statusText: "OK"
		};
	};

	try {
		await filterTicketsNode.function({
			cognigy: filterCognigy,
			config: {
				connection: {
					clientId: "client-id",
					clientSecret: "client-secret",
					refreshToken: "refresh-token",
					orgId: "123456789",
					dataCenter: "eu"
				},
				storeLocation: "input",
				inputKey: "zohoDesk.tickets",
				contextKey: "",
				subject: "fresh lookup"
			},
			childConfigs: [
				{
					type: "onFoundTicketByFilter",
					id: "found-node"
				}
			]
		});
	} finally {
		axios.defaults.adapter = originalAdapter;
	}

	assert.deepStrictEqual(events, [
		["next", "found-node"],
		["store", "zohoDesk.tickets", { data: [{ id: "ticket-id" }] }]
	]);
	assert.deepStrictEqual(filterCognigy.input.zohoDesk.tickets, { data: [{ id: "ticket-id" }] });
};

const assertSequentialFilterCallsCanStoreDifferentInputKeys = async () => {
	const originalAdapter = axios.defaults.adapter;
	const events = [];
	const filterCognigy = {
		input: {},
		context: {},
		api: {
			addToContext: () => {
				throw new Error("Input storage should not write to context.");
			},
			addToInput: (...args) => events.push(["store", ...args]),
			setNextNode: id => events.push(["next", id])
		}
	};
	const baseConfig = {
		connection: {
			clientId: "client-id",
			clientSecret: "client-secret",
			refreshToken: "refresh-token",
			orgId: "123456789",
			dataCenter: "eu"
		},
		storeLocation: "input",
		contextKey: ""
	};
	const childConfigs = [
		{
			type: "onFoundTicketByFilter",
			id: "found-node"
		}
	];

	axios.defaults.adapter = async config => {
		const subject = config.params && config.params.subject;

		return {
			config,
			data: config.url.endsWith("/oauth/v2/token") ? { access_token: "access-token" } : { data: [{ id: subject }] },
			headers: {},
			status: 200,
			statusText: "OK"
		};
	};

	try {
		await filterTicketsNode.function({
			cognigy: filterCognigy,
			config: {
				...baseConfig,
				inputKey: "zohoDesk.tickets",
				subject: "primary-ticket"
			},
			childConfigs
		});

		await filterTicketsNode.function({
			cognigy: filterCognigy,
			config: {
				...baseConfig,
				inputKey: "zohoDesk.similarTickets",
				subject: "similar-ticket"
			},
			childConfigs
		});
	} finally {
		axios.defaults.adapter = originalAdapter;
	}

	assert.deepStrictEqual(events, [
		["next", "found-node"],
		["store", "zohoDesk.tickets", { data: [{ id: "primary-ticket" }] }],
		["next", "found-node"],
		["store", "zohoDesk.similarTickets", { data: [{ id: "similar-ticket" }] }]
	]);
	assert.deepStrictEqual(filterCognigy.input.zohoDesk.tickets, { data: [{ id: "primary-ticket" }] });
	assert.deepStrictEqual(filterCognigy.input.zohoDesk.similarTickets, { data: [{ id: "similar-ticket" }] });
};

const assertListTicketCommentsFiltersSortsAndLimits = async () => {
	const originalAdapter = axios.defaults.adapter;
	const inputWrites = [];
	const requests = [];

	axios.defaults.adapter = async config => {
		requests.push(config);

		if (config.url.endsWith("/oauth/v2/token")) {
			return {
				config,
				data: { access_token: "access-token" },
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		const pages = {
			0: [
				{
					id: "old-agent",
					createdTime: "2026-06-24T10:00:00.000Z",
					commentedBy: {
						type: "agent"
					}
				},
				{
					id: "new-customer",
					createdTime: "2026-06-26T10:00:00.000Z",
					commentedBy: {
						type: "customer"
					}
				}
			],
			2: [
				{
					id: "new-agent",
					createdTime: "2026-06-25T10:00:00.000Z",
					commentedBy: {
						type: "agent"
					}
				},
				{
					id: "older-agent",
					createdTime: "2026-06-23T10:00:00.000Z",
					commentedBy: {
						type: "agent"
					}
				}
			]
		};

		return {
			config,
			data: {
				data: pages[config.params.from] || []
			},
			headers: {},
			status: 200,
			statusText: "OK"
		};
	};

	try {
		await listTicketCommentsNode.function({
			cognigy: {
				input: {},
				context: {},
				api: {
					addToContext: () => {
						throw new Error("Input storage should not write to context.");
					},
					addToInput: (...args) => inputWrites.push(args)
				}
			},
			config: {
				connection: {
					clientId: "client-id",
					clientSecret: "client-secret",
					refreshToken: "refresh-token",
					orgId: "123456789",
					dataCenter: "eu"
				},
				storeLocation: "input",
				inputKey: "zohoDesk.comments",
				contextKey: "",
				ticketId: "ticket-id",
				commentLimit: "2",
				commentAuthorType: "agent",
				pageSize: "2",
				rawQueryParams: "{}"
			}
		});
	} finally {
		axios.defaults.adapter = originalAdapter;
	}

	const commentRequests = requests.filter(request => request.url.endsWith("/tickets/ticket-id/comments"));

	assert.deepStrictEqual(commentRequests.map(request => request.params), [
		{
			from: 0,
			limit: 2
		},
		{
			from: 2,
			limit: 2
		},
		{
			from: 4,
			limit: 2
		}
	]);
	assert.deepStrictEqual(inputWrites, [
		[
			"zohoDesk.comments",
			{
				data: [
					{
						id: "new-agent",
						createdTime: "2026-06-25T10:00:00.000Z",
						commentedBy: {
							type: "agent"
						}
					},
					{
						id: "old-agent",
						createdTime: "2026-06-24T10:00:00.000Z",
						commentedBy: {
							type: "agent"
						}
					}
				]
			}
		]
	]);
};

const assertListTicketCommentsZeroLimitReturnsAll = async () => {
	const originalAdapter = axios.defaults.adapter;
	const inputWrites = [];

	axios.defaults.adapter = async config => {
		if (config.url.endsWith("/oauth/v2/token")) {
			return {
				config,
				data: { access_token: "access-token" },
				headers: {},
				status: 200,
				statusText: "OK"
			};
		}

		return {
			config,
			data: {
				data: config.params.from === 0
					? [
						{
							id: "older-customer",
							createdTime: "2026-06-24T10:00:00.000Z",
							commentedBy: {
								type: "customer"
							}
						},
						{
							id: "new-customer",
							createdTime: "2026-06-26T10:00:00.000Z",
							commentedBy: {
								type: "customer"
							}
						}
					]
					: []
			},
			headers: {},
			status: 200,
			statusText: "OK"
		};
	};

	try {
		await listTicketCommentsNode.function({
			cognigy: {
				input: {},
				context: {},
				api: {
					addToContext: () => {
						throw new Error("Input storage should not write to context.");
					},
					addToInput: (...args) => inputWrites.push(args)
				}
			},
			config: {
				connection: {
					clientId: "client-id",
					clientSecret: "client-secret",
					refreshToken: "refresh-token",
					orgId: "123456789",
					dataCenter: "eu"
				},
				storeLocation: "input",
				inputKey: "zohoDesk.comments",
				contextKey: "",
				ticketId: "ticket-id",
				commentLimit: "0",
				commentAuthorType: "both",
				pageSize: "2",
				rawQueryParams: "{}"
			}
		});
	} finally {
		axios.defaults.adapter = originalAdapter;
	}

	assert.deepStrictEqual(inputWrites[0][1].data.map(comment => comment.id), [
		"new-customer",
		"older-customer"
	]);
};

const assertStoredNodeError = async (node, config, expectedMessage) => {
	const inputWrites = [];

	await node.function({
		cognigy: {
			api: {
				addToContext: () => {
					throw new Error("Input storage should not write to context.");
				},
				addToInput: (...args) => inputWrites.push(args)
			}
		},
		config
	});

	const lastWrite = inputWrites[inputWrites.length - 1];

	assert(lastWrite, "Node did not store a result.");
	assert.strictEqual(lastWrite[0], config.inputKey);
	assert.match(lastWrite[1].error.message, expectedMessage);
};

const assertUploadValidation = async () => {
	const baseConfig = {
		connection: {
			clientId: "client-id",
			clientSecret: "client-secret",
			refreshToken: "refresh-token",
			dataCenter: "eu"
		},
		storeLocation: "input",
		inputKey: "zohoDesk.attachment",
		contextKey: "",
		ticketId: "123456789",
		fileName: "example.txt",
		mimeType: "text/plain",
		isPublic: ""
	};

	await assertStoredNodeError(uploadTicketAttachmentNode, {
		...baseConfig,
		sourceType: "url",
		fileUrl: "ftp://example.test/file.txt",
		fileUrlHeaders: "{}"
	}, /File URL must use http or https/);

	await assertStoredNodeError(uploadTicketAttachmentNode, {
		...baseConfig,
		sourceType: "base64",
		base64Content: "not valid base64!"
	}, /Base64 Content must be valid base64/);
};

const runAsyncSmoke = async () => {
	assertKnowledgeValidationAndTextHelpers();
	await assertKnowledgeScopeNameResolution();
	await assertKnowledgeAmbiguousNamesFail();
	await assertKnowledgeExactIdFallback();
	await assertKnowledgeArticlePagination();
	await assertKnowledgeConnectorImportsAndCleansScope();
	await assertKnowledgeCleanupSkipsWhenTruncated();
	await assertKnowledgeDeleteStaleSources();
	await assertNoCacheGetHeaders();
	await assertFilterBranchesAndStoresFreshResult();
	await assertSequentialFilterCallsCanStoreDifferentInputKeys();
	await assertListTicketCommentsFiltersSortsAndLimits();
	await assertListTicketCommentsZeroLimitReturnsAll();
	await assertUploadValidation();
};

runAsyncSmoke()
	.then(() => {
		console.log("Zoho Desk extension smoke test passed.");
	})
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
