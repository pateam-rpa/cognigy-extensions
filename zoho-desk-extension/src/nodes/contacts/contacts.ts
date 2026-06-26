import { booleanSelectField, jsonField, textField } from "../../lib/nodeFields";
import { createZohoRequestNode } from "../../lib/nodeFactory";
import { buildQueryParams, optionalBooleanParam, rawQueryField } from "../../lib/query";
import { parseJsonObject, pruneEmpty } from "../../lib/json";
import { integerInRange, optionalText, requiredText } from "../../lib/validation";

const contactIdField = textField("contactId", "Contact ID", "The Zoho Desk contact ID.", true);
const optionalContactTextFields = [
	textField("firstName", "First Name"),
	textField("email", "Email"),
	textField("phone", "Phone"),
	textField("mobile", "Mobile"),
	textField("secondaryEmail", "Secondary Email"),
	textField("title", "Title"),
	textField("type", "Type"),
	textField("ownerId", "Owner ID"),
	textField("accountId", "Account ID"),
	textField("language", "Language"),
	textField("city", "City"),
	textField("state", "State"),
	textField("country", "Country"),
	textField("street", "Street"),
	textField("zip", "ZIP"),
	textField("description", "Description"),
	textField("facebook", "Facebook"),
	textField("twitter", "Twitter")
];
const createContactTextFields = [
	textField("firstName", "First Name"),
	textField("lastName", "Last Name", undefined, true),
	...optionalContactTextFields.slice(1)
];
const updateContactTextFields = [
	textField("firstName", "First Name"),
	textField("lastName", "Last Name"),
	...optionalContactTextFields.slice(1)
];

const commonContactPayload = (config: Record<string, unknown>): Record<string, unknown> => pruneEmpty({
	firstName: optionalText(config.firstName),
	lastName: optionalText(config.lastName),
	email: optionalText(config.email),
	phone: optionalText(config.phone),
	mobile: optionalText(config.mobile),
	secondaryEmail: optionalText(config.secondaryEmail),
	title: optionalText(config.title),
	type: optionalText(config.type),
	ownerId: optionalText(config.ownerId),
	accountId: optionalText(config.accountId),
	language: optionalText(config.language),
	city: optionalText(config.city),
	state: optionalText(config.state),
	country: optionalText(config.country),
	street: optionalText(config.street),
	zip: optionalText(config.zip),
	description: optionalText(config.description),
	facebook: optionalText(config.facebook),
	twitter: optionalText(config.twitter)
});

const buildContactPayload = (
	config: Record<string, unknown>,
	jsonValue: unknown,
	jsonFieldName: string,
	requireLastName: boolean
): Record<string, unknown> => {
	const payload = {
		...parseJsonObject(jsonValue, jsonFieldName),
		...commonContactPayload(config)
	};

	if (requireLastName) {
		payload.lastName = requiredText(config.lastName || payload.lastName, "Last Name");
	}

	if (Object.keys(payload).length === 0) {
		throw new Error(`${jsonFieldName} or at least one contact field is required.`);
	}

	return payload;
};

export const getContactNode = createZohoRequestNode({
	type: "getContact",
	defaultLabel: "Get Contact",
	summary: "Gets a Zoho Desk contact by ID.",
	defaultStorageKey: "zohoDesk.contact",
	fields: [
		contactIdField,
		textField("include", "Include", "Optional secondary data. Zoho supports accounts and owner."),
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
				"contactId",
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
		path: `/contacts/${encodeURIComponent(requiredText(config.contactId, "Contact ID"))}`,
		params: buildQueryParams(config.rawQueryParams, {
			include: optionalText(config.include)
		})
	})
});

export const listContactsNode = createZohoRequestNode({
	type: "listContacts",
	defaultLabel: "List Contacts",
	summary: "Lists Zoho Desk contacts.",
	defaultStorageKey: "zohoDesk.contacts",
	fields: [
		textField("include", "Include", "Optional secondary data. Zoho supports accounts."),
		textField("from", "From", "Zero-based result offset.", false, "0"),
		textField("limit", "Limit", "Maximum number of contacts to return.", false, "25"),
		textField("viewId", "View ID", "Optional Zoho contact view ID."),
		textField("sortBy", "Sort By", "Optional sort field, for example firstName, lastName, createdTime, or -createdTime."),
		textField("fields", "Fields", "Optional comma-separated field API names."),
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
				"include",
				"from",
				"limit",
				"viewId",
				"sortBy",
				"fields"
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
		path: "/contacts",
		params: buildQueryParams(config.rawQueryParams, {
			include: optionalText(config.include),
			from: integerInRange(config.from, "From", 0, 0, 4999),
			limit: integerInRange(config.limit, "Limit", 25, 1, 100),
			viewId: optionalText(config.viewId),
			sortBy: optionalText(config.sortBy),
			fields: optionalText(config.fields)
		})
	})
});

export const createContactNode = createZohoRequestNode({
	type: "createContact",
	defaultLabel: "Create Contact",
	summary: "Creates a Zoho Desk contact.",
	defaultStorageKey: "zohoDesk.contact",
	fields: [
		...createContactTextFields,
		jsonField("additionalContactFields", "Additional Contact Fields", "{}", "Optional Zoho contact payload fields such as cf.")
	],
	sections: [
		{
			key: "contact",
			label: {
				default: "Contact"
			},
			defaultCollapsed: false,
			fields: [
				"firstName",
				"lastName",
				"email",
				"phone",
				"mobile"
			]
		},
		{
			key: "advanced",
			label: {
				default: "Advanced"
			},
			defaultCollapsed: true,
			fields: [
				"secondaryEmail",
				"title",
				"type",
				"ownerId",
				"accountId",
				"language",
				"city",
				"state",
				"country",
				"street",
				"zip",
				"description",
				"facebook",
				"twitter",
				"additionalContactFields"
			]
		}
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "section", key: "contact" },
		{ type: "section", key: "advanced" },
		{ type: "section", key: "storage" }
	],
	buildRequest: (config) => ({
		method: "POST",
		path: "/contacts",
		data: buildContactPayload(config, config.additionalContactFields, "Additional Contact Fields", true)
	})
});

export const updateContactNode = createZohoRequestNode({
	type: "updateContact",
	defaultLabel: "Update Contact",
	summary: "Updates a Zoho Desk contact.",
	defaultStorageKey: "zohoDesk.contact",
	fields: [
		contactIdField,
		...updateContactTextFields,
		jsonField("contactData", "Contact Data", "{}", "Optional Zoho contact patch payload fields such as cf.")
	],
	sections: [
		{
			key: "contact",
			label: {
				default: "Contact"
			},
			defaultCollapsed: false,
			fields: [
				"contactId",
				"firstName",
				"lastName",
				"email",
				"phone",
				"mobile"
			]
		},
		{
			key: "advanced",
			label: {
				default: "Advanced"
			},
			defaultCollapsed: true,
			fields: [
				"secondaryEmail",
				"title",
				"type",
				"ownerId",
				"accountId",
				"language",
				"city",
				"state",
				"country",
				"street",
				"zip",
				"description",
				"facebook",
				"twitter",
				"contactData"
			]
		}
	],
	form: [
		{ type: "field", key: "connection" },
		{ type: "section", key: "contact" },
		{ type: "section", key: "advanced" },
		{ type: "section", key: "storage" }
	],
	buildRequest: (config) => ({
		method: "PATCH",
		path: `/contacts/${encodeURIComponent(requiredText(config.contactId, "Contact ID"))}`,
		data: buildContactPayload(config, config.contactData, "Contact Data", false)
	})
});

export const listTicketsByContactNode = createZohoRequestNode({
	type: "listTicketsByContact",
	defaultLabel: "List Tickets by Contact",
	summary: "Lists tickets received from a specific Zoho Desk contact.",
	defaultStorageKey: "zohoDesk.contactTickets",
	fields: [
		contactIdField,
		textField("departmentId", "Department ID", "Optional department filter."),
		textField("from", "From", "Zero-based result offset.", false, "0"),
		textField("limit", "Limit", "Maximum number of tickets to return.", false, "25"),
		textField("sortBy", "Sort By", "Optional sort field, for example createdTime, modifiedTime, or -modifiedTime."),
		textField("dueDate", "Due Date", "Optional due date filter, for example overdue, today, tomorrow, currentWeek, or currentMonth."),
		booleanSelectField("isSpam", "Is Spam"),
		textField("include", "Include", "Optional secondary ticket data."),
		rawQueryField
	],
	sections: [
		{
			key: "filters",
			label: {
				default: "Filters"
			},
			defaultCollapsed: false,
			fields: [
				"contactId",
				"departmentId",
				"from",
				"limit",
				"sortBy",
				"dueDate",
				"isSpam",
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
		{ type: "section", key: "filters" },
		{ type: "section", key: "advanced" },
		{ type: "section", key: "storage" }
	],
	buildRequest: (config) => ({
		method: "GET",
		path: `/contacts/${encodeURIComponent(requiredText(config.contactId, "Contact ID"))}/tickets`,
		params: buildQueryParams(config.rawQueryParams, {
			departmentId: optionalText(config.departmentId),
			from: integerInRange(config.from, "From", 0, 0, 4999),
			limit: integerInRange(config.limit, "Limit", 25, 1, 100),
			sortBy: optionalText(config.sortBy),
			dueDate: optionalText(config.dueDate),
			isSpam: optionalBooleanParam(config.isSpam),
			include: optionalText(config.include)
		})
	})
});
