const assert = require("assert");
const axios = require("axios");

const extension = require("../build/module.js").default;
const { parseJsonStringArray } = require("../build/lib/json.js");
const { storeResult } = require("../build/lib/storage.js");
const { integerInRange } = require("../build/lib/validation.js");
const { getZohoDeskBaseUrls, normalizeConnection, serializeZohoError, zohoDeskRequest } = require("../build/lib/zohoDeskClient.js");
const connectionTypes = extension.connections.map(connection => connection.type);
const nodeTypes = extension.nodes.map(node => node.type);

assert(connectionTypes.includes("zoho-desk-oauth"), "Zoho Desk connection is not registered.");

const zohoConnection = extension.connections.find(connection => connection.type === "zoho-desk-oauth");
const connectionFieldNames = zohoConnection.fields.map(field => field.fieldName);

assert.strictEqual(zohoConnection.label, "Zoho Desk Self Client OAuth");
assert.deepStrictEqual(connectionFieldNames, [
	"clientId",
	"clientSecret",
	"refreshToken",
	"dataCenter"
]);

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
