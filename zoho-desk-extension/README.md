# Zoho Desk Extension

This Cognigy extension adds Zoho Desk workflow nodes for tickets, ticket context, attachments, tags, contacts, and ticket resolutions, plus a Knowledge Connector for published Zoho Desk help-center articles.

The extension uses the Zoho Desk REST API `/api/v1` with Zoho's Self Client OAuth authorization-code flow. Cognigy stores a long-lived refresh token and uses it to refresh one-hour access tokens automatically.

## Version Log

### 0.4.0 - 2026-07-02

- Added `zohoDeskKnowledgeConnector` for importing published Zoho Desk help-center articles into Cognigy Knowledge.
- Added root-category name and category-path resolution with exact ID fallbacks for duplicate-name cases.
- Added scoped article-source cleanup, bounded pagination, plain-text article chunking, and smoke coverage for Knowledge imports.
- Hardened article import edge cases for HTML line breaks, Zoho `"null"` version markers, detail responses with missing list metadata, and exact-limit cleanup decisions.

### 0.3.10 - 2026-06-26

- Added smoke coverage and runtime troubleshooting guidance for running Filter Tickets twice with different configured result keys in the same Cognigy execution.
- Added `listTicketComments` for retrieving ticket comments with newest-first limiting and agent/customer/both author filtering.

### 0.3.9 - 2026-06-26

- Removed the mistaken hardcoded secondary storage write; alternate search result keys should be configured through the node's Input Key to store Result.

### 0.3.8 - 2026-06-26

- Withdrawn: this version added a mistaken hardcoded secondary storage write that was removed in 0.3.9.

### 0.3.7 - 2026-06-26

- Updated result storage to replace the live Cognigy input/context object at the configured dotted key before issuing the official storage API write, so later nodes in the same execution see the fresh search result.

### 0.3.6 - 2026-06-26

- Store Zoho results into Cognigy input with explicit simple replacement mode so repeat searches do not leave stale or null values behind.

### 0.3.5 - 2026-06-26

- Restored Cognigy child-node routing before result storage for ticket lookup/search nodes while keeping the intermediate null write removed.

### 0.3.4 - 2026-06-26

- Fixed repeat ticket search handoff so the fresh API result is stored before the flow continues to found, not-found, or error child nodes.
- Removed the intermediate null input write that could make the second search result appear as null.

### 0.3.3 - 2026-06-25

- Fixed repeat Zoho Desk searches so stored input results are replaced instead of leaving stale data behind.
- Added no-cache request headers for Zoho Desk GET calls to avoid runtime or proxy reuse of previous search responses.
- Tightened numeric, attachment, tag, and attachment ID validation so malformed values fail before Zoho API calls.
- Hardened structured error storage for non-standard thrown values.
- Added a bounded timeout to the Zoho Self Client grant-code exchange helper.
- Added the repeatable local security scan workflow covering dependency audit, OSV-Scanner, Gitleaks, and Semgrep.

### 0.3.2 - 2026-06-22

- Added the standalone Zoho Desk workflow-node extension package.
- Added Zoho Desk Self Client OAuth connection support with refresh-token access-token renewal and data-center aware account/API base URLs.
- Added automatic Zoho Desk organization ID resolution through `/organizations` and `orgId` request header handling.
- Added ticket workflow nodes for create, get, update, filter/search, and email reply flows, including found, not-found, and error child branches where applicable.
- Added ticket context nodes for threads, conversations, and public/private comments.
- Added discovery nodes for departments, agents, and mail reply addresses.
- Added attachment upload support from URL and base64 content without writing payloads to local disk.
- Added tag, contact, contact-ticket, ticket-resolution, and resolution-history nodes.
- Added structured error storage under the configured result location instead of failing normal node execution with raw Zoho errors.
- Kept destructive and broad administrative operations out of scope for this package version.

## Requirements

- Cognigy.AI extension upload permissions.
- A Zoho Desk Self Client in the Zoho API Console.
- A Self Client grant code exchanged for a refresh token.
- Zoho Desk OAuth scopes listed below.

## OAuth Scopes

Minimum scopes for the expanded node set and article Knowledge Connector:

- `Desk.tickets.READ`
- `Desk.tickets.CREATE`
- `Desk.tickets.UPDATE`
- `Desk.search.READ`
- `Desk.basic.READ`
- `Desk.departments.READ`
- `Desk.agents.READ`
- `Desk.channels.email.READ`
- `Desk.contacts.READ`
- `Desk.contacts.CREATE`
- `Desk.contacts.UPDATE`
- `Desk.articles.READ`

Customers can use broader Zoho scopes if they prefer simpler OAuth setup over least privilege.

## Self Client Setup

Use Zoho's Self Client option for backend/app-to-app Desk access:

1. Go to the Zoho API Console.
2. Create a `Self Client`.
3. Copy the `Client ID` and `Client Secret`.
4. Open the Self Client `Generate Code` tab.
5. Enter the required Desk scopes as comma-separated values.
6. Select a grant-code expiry, enter a description, and generate the code.
7. If Zoho asks for a Desk portal, select the portal this extension should access.
8. Exchange the generated code for an access token and refresh token.
9. Store the refresh token in the Cognigy connection.

The grant code is short-lived and one-time use. The refresh token is the value Cognigy needs for ongoing server-to-server calls.

From this repository, you can exchange the Self Client code with:

```bash
node scripts/zoho-exchange-self-client-code.js \
  --clientId "1000..." \
  --clientSecret "..." \
  --dataCenter "com" \
  --code "1000..."
```

You can also use environment variables:

```bash
ZOHO_CLIENT_ID="1000..." \
ZOHO_CLIENT_SECRET="..." \
ZOHO_DATA_CENTER="com" \
ZOHO_SELF_CLIENT_CODE="1000..." \
node scripts/zoho-exchange-self-client-code.js
```

Supported data centers:

| Data Center | Accounts URL | Desk API URL |
| --- | --- | --- |
| `com` | `https://accounts.zoho.com` | `https://desk.zoho.com/api/v1` |
| `eu` | `https://accounts.zoho.eu` | `https://desk.zoho.eu/api/v1` |
| `in` | `https://accounts.zoho.in` | `https://desk.zoho.in/api/v1` |
| `com.au` | `https://accounts.zoho.com.au` | `https://desk.zoho.com.au/api/v1` |
| `jp` | `https://accounts.zoho.jp` | `https://desk.zoho.jp/api/v1` |
| `ca` | `https://accounts.zohocloud.ca` | `https://desk.zohocloud.ca/api/v1` |
| `sa` | `https://accounts.zoho.sa` | `https://desk.zoho.sa/api/v1` |
| `uk` | `https://accounts.zoho.uk` | `https://desk.zoho.uk/api/v1` |

If `dataCenter` is empty, the extension uses `com`.

## Connection

Create a Cognigy connection of type `Zoho Desk Self Client OAuth`.

| Field | Description |
| --- | --- |
| `clientId` | Self Client ID from the Zoho API Console. |
| `clientSecret` | Self Client secret from the Zoho API Console. |
| `refreshToken` | Refresh token returned after exchanging the Self Client grant code. |
| `dataCenter` | Zoho data center code such as `com`, `eu`, `in`, `com.au`, `jp`, `ca`, `sa`, or `uk`. Defaults to `com` when empty. |

The extension automatically resolves the Zoho Desk organization ID from `GET /organizations` and sends it as the `orgId` header for Desk API calls. If Zoho returns multiple organizations and no default can be identified, the node returns a clear error listing the available organization IDs.

## Knowledge Connector

`Zoho Desk Articles` imports published Zoho Desk help-center articles into Cognigy Knowledge. It uses the same `zoho-desk-oauth` connection as the workflow nodes and requires `Desk.articles.READ` on the refresh token.

V1 imports article text only. It does not import tickets, ticket comments, attachments, or separate translated article variants.

### Article Filters

| Field | Description |
| --- | --- |
| `Knowledge Source Prefix` | Prefix used for Knowledge Source names. Defaults to `Zoho Desk`. |
| `Root Category Name` | Optional root Knowledge Base category name, for example `Support`. Matching is case-insensitive and exact. |
| `Category Path` | Optional path below the root, for example `Getting Started / Agents`. If empty, the matched root category is imported. |
| `Root Category ID` | Optional exact fallback when multiple root categories share the same display name. |
| `Category ID` | Optional exact fallback when multiple category or section names match the same path segment. |
| `Include Child Categories` | When enabled, imports the selected category and all descendants. Defaults to enabled. |
| `Permission` | Optional article permission filter. Valid values are empty, `ALL`, `REGISTEREDUSERS`, or `AGENTS`. |
| `Maximum Articles` | Safety limit for one run. Defaults to `50`; allowed range is `1` to `500`. |
| `Maximum Chunk Characters` | Maximum plain-text chunk size. Defaults to `2000`; allowed range is `500` to `3000`. |
| `Tags` | Tags added to each Knowledge Source. Defaults to `zoho-desk` and `articles`. |

If neither a root category nor a category is configured, the connector imports all published articles up to the configured safety limit. If a name or path segment is ambiguous, the run fails with matching names and IDs so the exact ID fields can be used.

The connector fetches each article detail before import so it can use the full published answer. Source cleanup is scoped to the configured prefix, resolved category scope, and permission filter. Stale cleanup is skipped when the crawl hits `Maximum Articles` or when any list, detail, source, or chunk operation fails.

## Nodes and Endpoints

### Ticket Workflow

| Node | Endpoint |
| --- | --- |
| `createTicket` | `POST /tickets` |
| `getTicket` | `GET /tickets/{ticketId}` |
| `updateTicket` | `PATCH /tickets/{ticketId}` |
| `filterTickets` | `GET /tickets/search` |
| `replyToTicket` | `POST /tickets/{ticketId}/sendReply` |

`getTicket` and `filterTickets` include found, not-found, and error child branches. `replyToTicket` sends an email reply. Use `addTicketComment` for public or private ticket comments.

### Discovery

| Node | Endpoint |
| --- | --- |
| `listDepartments` | `GET /departments` |
| `listAgents` | `GET /agents` |
| `listMailReplyAddresses` | `GET /mailReplyAddress` |

Discovery nodes support pagination and raw query parameter JSON for Zoho-specific filters.

### Ticket Context

| Node | Endpoint |
| --- | --- |
| `listTicketThreads` | `GET /tickets/{ticketId}/threads` |
| `listTicketConversations` | `GET /tickets/{ticketId}/conversations` |
| `listTicketComments` | `GET /tickets/{ticketId}/comments` |
| `addTicketComment` | `POST /tickets/{ticketId}/comments` |

`listTicketComments` supports a Comment Limit where `0` or empty returns all matching comments. Positive limits return the top matching comments after newest-first sorting and optional agent/customer/both author filtering.
`addTicketComment` supports `content`, `isPublic`, `contentType`, and optional `attachmentIds`.

### Attachments

| Node | Endpoint |
| --- | --- |
| `listTicketAttachments` | `GET /tickets/{ticketId}/attachments` |
| `uploadTicketAttachment` | `POST /tickets/{ticketId}/attachments` |

`uploadTicketAttachment` supports two source modes:

- `url`: downloads binary content from `fileUrl` and uploads it to Zoho Desk as multipart form data.
- `base64`: decodes `base64Content` and uploads it with `fileName` and optional `mimeType`.

No local filesystem writes are used for attachment uploads.

### Tags

| Node | Endpoint |
| --- | --- |
| `searchTags` | `GET /tags/search` |
| `listTicketTags` | `GET /ticketTags` |
| `listTagsInTicket` | `GET /tickets/{ticketId}/tags` |
| `addTagToTicket` | `POST /tickets/{ticketId}/associateTag` |
| `removeTagFromTicket` | `POST /tickets/{ticketId}/dissociateTag` |
| `replaceTicketTags` | `PATCH /tags/{tagId}/replace` |

`addTagToTicket` and `removeTagFromTicket` accept a JSON array of tag names. `replaceTicketTags` accepts the tag ID to replace and the replacement tag ID.

### Contacts

| Node | Endpoint |
| --- | --- |
| `getContact` | `GET /contacts/{contactId}` |
| `listContacts` | `GET /contacts` |
| `createContact` | `POST /contacts` |
| `updateContact` | `PATCH /contacts/{contactId}` |
| `listTicketsByContact` | `GET /contacts/{contactId}/tickets` |

Create and update contact nodes expose common fields and a JSON payload field for Zoho-specific properties such as `cf`.

### Resolution

| Node | Endpoint |
| --- | --- |
| `getTicketResolution` | `GET /tickets/{ticketId}/resolution` |
| `getResolutionHistory` | `GET /tickets/{ticketId}/resolutionHistory` |
| `updateTicketResolution` | `PATCH /tickets/{ticketId}/resolution` |

`updateTicketResolution` updates `content` and can notify the contact with `isNotifyContact`.

## Safe Scope

This extension intentionally excludes destructive or broad administrative operations in this pass:

- delete contact
- delete attachment
- delete resolution
- spam
- merge
- trash
- broad admin/configuration APIs

The Knowledge Connector also intentionally excludes ticket content, ticket comments, attachments, and translated article variants. It imports published help-center articles only.

## Result Storage

Each node stores the Zoho response in either Input or Context. Default keys use the `zohoDesk` namespace, for example:

- `zohoDesk.ticket`
- `zohoDesk.tickets`
- `zohoDesk.reply`
- `zohoDesk.departments`
- `zohoDesk.agents`
- `zohoDesk.mailReplyAddresses`
- `zohoDesk.threads`
- `zohoDesk.conversations`
- `zohoDesk.comments`
- `zohoDesk.comment`
- `zohoDesk.attachments`
- `zohoDesk.attachment`
- `zohoDesk.tags`
- `zohoDesk.ticketTags`
- `zohoDesk.contact`
- `zohoDesk.contacts`
- `zohoDesk.contactTickets`
- `zohoDesk.resolution`
- `zohoDesk.resolutionHistory`

Errors are stored instead of thrown:

```json
{
  "error": {
    "message": "Zoho Desk request failed.",
    "status": 401,
    "errorCode": "INVALID_TOKEN",
    "details": {}
  }
}
```

### Repeated Filter Tickets outputs

To keep two Filter Tickets results in one message execution, configure each node with a different `Input Key to store Result`. For example, store the primary lookup at `zohoDesk.tickets` and the second lookup at `zohoDesk.similarTickets`. The extension writes to the configured key and does not hardcode secondary result keys.

If the second key is missing in Cognigy, check these runtime conditions in the flow editor/debug output:

- The uploaded Zoho Desk extension package is the expected version.
- The second Filter Tickets node executes on the current branch.
- `Where to store the result` is `Input`.
- `Input Key to store Result` exactly matches the key the downstream prompt reads, including casing.
- The final Input is inspected immediately after the second node, before later nodes can overwrite or ignore it.

## Build

Install dependencies and build the upload artifact:

```bash
npm install
npm run build
```

The build runs TypeScript transpilation, TSLint, smoke tests, and creates `zoho-desk.tar.gz`.

The tarball contains the compiled extension, package files, README, and `icon.png`.

## Verification

Recommended local checks:

```bash
npm run build
tar tzf zoho-desk.tar.gz
```

Manual acceptance tests require real Zoho credentials:

- create a Zoho Self Client and exchange a grant code for a refresh token
- create a Cognigy connection with `clientId`, `clientSecret`, `refreshToken`, and `dataCenter`
- configure `Zoho Desk Articles` with a root category name and optional category path
- import a small published category and confirm Knowledge Sources and chunks are created
- verify duplicate-name categories can be selected with `Root Category ID` or `Category ID`
- list departments, agents, and reply addresses
- create a public and private ticket comment
- list threads and conversations
- upload attachments from URL and base64
- add, remove, and replace tags
- create, update, list, and get contacts
- list tickets by contact
- get and update ticket resolution
- confirm invalid OAuth credentials store structured errors

## References

- Cognigy Extensions: https://docs.cognigy.com/ai/for-developers/extensions
- Cognigy extension-tools: https://www.npmjs.com/package/@cognigy/extension-tools
- Freshdesk reference extension: https://github.com/Cognigy/Extensions/tree/master/extensions/freshdesk
- Zoho Self Client overview: https://www.zoho.com/accounts/protocol/oauth/self-client/overview.html
- Zoho Self Client authorization-code flow: https://www.zoho.com/accounts/protocol/oauth/self-client/authorization-code-flow.html
- Zoho Desk API: https://desk.zoho.com/DeskAPIDocument
- Zoho Desk list articles: https://desk.zoho.com/DeskAPIDocument#Articles_Listarticles
- Zoho Desk get article: https://desk.zoho.com/DeskAPIDocument#Articles_Getarticle
