# Zoho Desk Extension Developer Guide

This document is for maintainers and developers working on the Zoho Desk Cognigy extension. Keep `README.md` high level and user-facing; put implementation notes, release workflow details, and troubleshooting guidance here.

## Package Boundary

This package is the Zoho Desk workflow-node extension. It should stay separate from the SharePoint Knowledge Connector package in `../sharepoint-knowledge-extension`.

Expected workspace layout:

```text
zoho-desk-extension/
sharepoint-knowledge-extension/
```

The Zoho package owns:

- Zoho Desk Cognigy nodes under `src/nodes`.
- The Zoho Desk Cognigy connection schema under `src/connections`.
- Shared node, storage, validation, query, and API helpers under `src/lib`.
- Package-local build scripts, package metadata, icon, README, and developer docs.

## Runtime Shape

The extension entry point is `src/module.ts`.

It registers:

- workflow nodes for tickets, discovery, ticket context, attachments, tags, contacts, and resolutions
- the `zoho-desk-oauth` connection
- extension label `Zoho Desk`

Most nodes use `createZohoRequestNode` from `src/lib/nodeFactory.ts`. That helper standardizes:

- the Cognigy connection field
- storage fields and storage section
- request execution through `zohoDeskRequest`
- structured error storage through `serializeZohoError`

The request flow is:

```text
Cognigy node function
-> buildRequest(config)
-> zohoDeskRequest(connection, request)
-> refresh Zoho OAuth access token
-> resolve Zoho Desk organization ID
-> call Zoho Desk API
-> store result or structured error
```

Errors should be stored in the configured result location. Do not throw raw Zoho errors from normal node execution unless Cognigy should fail the node before storage can happen.

## New Developer Setup

From the workspace root:

```bash
cd zoho-desk-extension
npm install
npm run build
```

The build command runs:

```text
transpile -> lint -> smoke -> zip
```

The smoke check loads `build/module.js` and verifies the connection, registered nodes, child-node dependencies, selected field behavior, and data-center normalization.

If dependencies are already installed in `node_modules`, `npm run build` is enough for local verification.

## Credentials For Manual Testing

Never commit real Zoho credentials or refresh tokens. Use placeholders in docs, examples, and issue notes.

The public Cognigy connection exposes:

```text
clientId=<zoho-self-client-id>
clientSecret=<zoho-self-client-secret>
refreshToken=<zoho-refresh-token>
dataCenter=eu
```

Supported data centers are implemented in `src/lib/zohoDeskClient.ts`:

```text
com, eu, in, com.au, jp, ca, sa, uk
```

To exchange a Self Client grant code during manual setup:

```bash
ZOHO_CLIENT_ID="<zoho-self-client-id>" \
ZOHO_CLIENT_SECRET="<zoho-self-client-secret>" \
ZOHO_DATA_CENTER="eu" \
ZOHO_SELF_CLIENT_CODE="<one-time-grant-code>" \
node scripts/zoho-exchange-self-client-code.js
```

Store only the returned refresh token in the Cognigy connection. The grant code is short-lived and one-time use.

The runtime also contains normalization support for `orgId`, `accountsBaseUrl`, `apiBaseUrl`, and `requestTimeoutMs`, but those are not exposed in the current public connection schema. Treat them as implementation compatibility hooks unless the connection schema is deliberately expanded.

## Build And Package Workflow

Create the Cognigy upload artifact:

```bash
npm run build
tar tzf zoho-desk.tar.gz
```

`zoho-desk.tar.gz` is the upload artifact. It contains:

- compiled `build/*`
- `package.json`
- `package-lock.json`
- `README.md`
- `icon.png`

Create a source archive for sharing or review:

```bash
npm run zip:source
unzip -tq zoho-desk-source-v$(node -p "require('./package.json').version").zip
```

The source archive intentionally includes source/config/docs/icon files and excludes generated or bulky folders such as:

- `node_modules`
- `build`
- upload tarballs
- older source ZIPs

Keep `README.md` in the upload tarball. Keep `DEVELOPMENT.md` in the source ZIP.

## Adding Or Changing Nodes

Use the existing node pattern unless a new operation genuinely needs custom Cognigy behavior.

Checklist:

1. Add or update the node file under `src/nodes/<area>/`.
2. Prefer `createZohoRequestNode` for ordinary Zoho REST calls.
3. Build request payloads with the shared JSON, query, and validation helpers.
4. Store results with the `zohoDesk` namespace unless there is a strong compatibility reason not to.
5. Register the node in `src/module.ts`.
6. Update `scripts/smoke.js` so registration and critical fields are covered.
7. Run `npm run build`.
8. Update `README.md` only for user-facing capability changes. Keep implementation detail in this file.

For child-branch behavior, follow the existing `getTicket` and `filterTickets` pattern: the parent node owns the API call and explicitly declares the child node types in its dependencies.

## API Client Rules

The shared API client is `src/lib/zohoDeskClient.ts`.

Maintain these rules:

- Use the refresh token flow for every request.
- Resolve `orgId` automatically through `/organizations` unless an explicit value is available.
- Send `orgId` as a Zoho Desk request header.
- Preserve Zoho response details when serializing errors.
- Keep request timeouts bounded.
- Do not write attachment payloads to the local filesystem.

When adding endpoints, keep destructive or broad administrative APIs out unless the product scope explicitly changes.

Current intentionally excluded operations include:

- delete contact
- delete attachment
- delete resolution
- spam
- merge
- trash
- broad admin/configuration APIs

## Manual Acceptance Testing

Local build checks do not call Zoho. Manual acceptance requires real credentials and a Cognigy environment.

Recommended manual checks:

- create a Cognigy connection with placeholder-equivalent real values
- list departments, agents, and mail reply addresses
- create, get, update, and filter tickets
- verify found, not-found, and error child branches
- send a ticket reply
- add public and private ticket comments
- list threads and conversations
- upload an attachment from URL and from base64
- add, remove, and replace tags
- create, list, get, and update contacts
- list tickets by contact
- get and update a ticket resolution
- enter invalid OAuth credentials and verify a structured error is stored

## Troubleshooting

### Build Cannot Find Module After Moving Folders

Run commands from the package folder:

```bash
cd zoho-desk-extension
npm run build
```

The package scripts expect `src`, `scripts`, `tsconfig.json`, and `package.json` to be in the current working directory.

### Cognigy Upload Fails Or Extension Does Not Load

Rebuild and inspect the tarball:

```bash
npm run build
tar tzf zoho-desk.tar.gz
```

The tarball must include `build/module.js`, package files, README, and `icon.png`. If `build/module.js` is missing, the TypeScript step did not produce the compiled extension.

### Node Is Missing In Cognigy

Check:

- the node is exported from its source file
- `src/module.ts` imports and registers it
- `scripts/smoke.js` includes the node type
- `npm run build` was run before packaging

Then inspect `build/module.js` or run the smoke test directly:

```bash
npm run transpile
node scripts/smoke.js
```

### OAuth Refresh Fails

Check:

- `dataCenter` matches the Zoho account region
- the Self Client ID and secret are from the same Zoho account
- the grant code was exchanged only once
- the refresh token is copied exactly
- required Desk scopes were included when generating the grant code

The token endpoint is derived from the selected data center.

### Organization Resolution Fails

The client calls `/organizations` after refreshing the access token. If Zoho returns multiple organizations and no default can be identified, the runtime asks for an explicit organization ID. The current public connection schema does not expose `orgId`, so expanding that schema is the clean fix if multi-org accounts become a supported requirement.

### Request Returns A Structured Error

Structured errors are expected for Zoho API failures. Inspect the stored result object:

```json
{
  "error": {
    "message": "...",
    "status": 401,
    "errorCode": "...",
    "details": {}
  }
}
```

Use `status`, `errorCode`, and `details` to decide whether the issue is credentials, scopes, request payload shape, or a Zoho-side validation error.
