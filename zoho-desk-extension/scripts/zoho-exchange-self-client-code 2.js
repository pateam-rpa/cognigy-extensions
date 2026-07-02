#!/usr/bin/env node

const axios = require("axios");

const DATA_CENTER_URLS = {
	com: "https://accounts.zoho.com",
	eu: "https://accounts.zoho.eu",
	in: "https://accounts.zoho.in",
	"com.au": "https://accounts.zoho.com.au",
	jp: "https://accounts.zoho.jp",
	ca: "https://accounts.zohocloud.ca",
	sa: "https://accounts.zoho.sa",
	uk: "https://accounts.zoho.uk"
};
const REQUEST_TIMEOUT_MS = 10000;

const parseArgs = (args) => {
	const result = {};

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];

		if (!arg.startsWith("--")) {
			continue;
		}

		const withoutPrefix = arg.slice(2);
		const equalsIndex = withoutPrefix.indexOf("=");

		if (equalsIndex >= 0) {
			result[withoutPrefix.slice(0, equalsIndex)] = withoutPrefix.slice(equalsIndex + 1);
			continue;
		}

		result[withoutPrefix] = args[index + 1];
		index += 1;
	}

	return result;
};

const requiredValue = (value, name) => {
	if (!value || !String(value).trim()) {
		throw new Error(`${name} is required.`);
	}

	return String(value).trim();
};

const normalizeDataCenter = (value) => {
	const dataCenter = (value || "com").trim().toLowerCase();

	if (!DATA_CENTER_URLS[dataCenter]) {
		throw new Error(`dataCenter must be one of: ${Object.keys(DATA_CENTER_URLS).join(", ")}.`);
	}

	return dataCenter;
};

const main = async () => {
	const args = parseArgs(process.argv.slice(2));
	const clientId = requiredValue(args.clientId || process.env.ZOHO_CLIENT_ID, "clientId");
	const clientSecret = requiredValue(args.clientSecret || process.env.ZOHO_CLIENT_SECRET, "clientSecret");
	const code = requiredValue(args.code || process.env.ZOHO_SELF_CLIENT_CODE || process.env.ZOHO_CODE, "code");
	const dataCenter = normalizeDataCenter(args.dataCenter || process.env.ZOHO_DATA_CENTER);
	const tokenUrl = `${DATA_CENTER_URLS[dataCenter]}/oauth/v2/token`;
	const body = new URLSearchParams();

	body.append("client_id", clientId);
	body.append("client_secret", clientSecret);
	body.append("grant_type", "authorization_code");
	body.append("code", code);

	const response = await axios.post(tokenUrl, body.toString(), {
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded"
		},
		timeout: REQUEST_TIMEOUT_MS
	});

	console.log(JSON.stringify({
		dataCenter,
		tokenUrl,
		access_token: response.data.access_token,
		refresh_token: response.data.refresh_token,
		api_domain: response.data.api_domain,
		token_type: response.data.token_type,
		expires_in: response.data.expires_in
	}, null, 2));
};

main().catch((error) => {
	const details = error.response && error.response.data ? error.response.data : error.message;

	console.error("Failed to exchange Zoho Self Client code.");
	console.error(typeof details === "string" ? details : JSON.stringify(details, null, 2));
	console.error("");
	console.error("Usage:");
	console.error("  node scripts/zoho-exchange-self-client-code.js --clientId <id> --clientSecret <secret> --dataCenter <com|eu|in|com.au|jp|ca|sa|uk> --code <grant-code>");
	console.error("");
	console.error("Environment alternatives:");
	console.error("  ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_DATA_CENTER, ZOHO_SELF_CLIENT_CODE");
	process.exitCode = 1;
});
