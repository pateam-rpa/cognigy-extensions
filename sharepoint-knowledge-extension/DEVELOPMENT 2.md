# SharePoint Knowledge Extension Developer Guide

This document is for maintainers and developers working on the SharePoint Cognigy Knowledge Connector. Keep `README.md` high level and user-facing; put implementation notes, release workflow details, and troubleshooting guidance here.

## Package Boundary

This package is the SharePoint Knowledge Connector extension. It should stay separate from the Zoho Desk workflow-node package in `../zoho-desk-extension`.

Expected workspace layout:

```text
zoho-desk-extension/
sharepoint-knowledge-extension/
```

The SharePoint package owns:

- the Cognigy Knowledge Connector under `src/knowledge-connectors`
- the Microsoft Graph client-credentials connection schema under `src/connections`
- Microsoft Graph, text, and validation helpers under `src/lib`
- package-local build scripts, Azure provisioning script, package metadata, icon, README, and developer docs

## Runtime Shape

The extension entry point is `src/module.ts`.

It registers:

- no workflow nodes
- one Knowledge Connector, `sharePointKnowledgeConnector`
- one connection, `sharepoint-client-credentials`
- extension label `SharePoint Knowledge`

The import flow is:

```text
Cognigy Knowledge Connector
-> normalize connector config
-> request Microsoft Graph access token
-> resolve SharePoint site
-> resolve default document library drive
-> crawl folder children
-> download supported text files
-> normalize and chunk text
-> upsert Cognigy Knowledge Sources
-> create Knowledge Chunks
-> delete stale sources created by this connector
```

Each imported file is keyed by Microsoft Graph `driveItem.id` through `externalIdentifier`. If Cognigy reports that an existing source is unchanged, chunk upload is skipped for that file.

## Descriptor Rules

The Cognigy Add Knowledge UI is sensitive to descriptor shape.

Maintain these rules:

- Keep the connector `type` as `sharePointKnowledgeConnector`.
- Use `createKnowledgeConnector` from `@cognigy/extension-tools`.
- Keep connector fields simple and field-based.
- Do not add custom `sections` or `form` metadata unless tested against a known-good Cognigy Knowledge Connector descriptor.
- After changing descriptor metadata, inspect `build/module.js` and run the smoke check before uploading.

Immediate Cognigy UI failures such as "unable to render the main content" usually indicate descriptor metadata drift, not a Microsoft Graph runtime problem.

## New Developer Setup

From the workspace root:

```bash
cd sharepoint-knowledge-extension
npm install
npm run build
```

The build command runs:

```text
transpile -> lint -> smoke -> zip
```

The smoke check loads `build/module.js` and verifies that exactly one Knowledge Connector and exactly one connection are registered with the expected types.

If dependencies are already installed in `node_modules`, `npm run build` is enough for local verification.

## Credentials For Manual Testing

Never commit real Microsoft tenant IDs, client IDs, or client secrets. Use placeholders in docs, examples, and issue notes.

The Cognigy connection fields are:

```text
tenantId=<microsoft-tenant-id-or-domain>
clientId=<entra-app-client-id>
clientSecret=<entra-app-client-secret>
graphBaseUrl=https://graph.microsoft.com/v1.0
requestTimeoutMs=10000
```

The Entra app requires Microsoft Graph application permissions with admin consent:

```text
Sites.Read.All
Files.Read.All
```

The connector uses the OAuth 2.0 client credentials flow:

```text
POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
scope=https://graph.microsoft.com/.default
grant_type=client_credentials
```

## Azure Cloud Shell Provisioning

The package includes a setup helper for creating an Entra app registration:

```bash
chmod +x scripts/create-azure-app-cloud-shell.sh
./scripts/create-azure-app-cloud-shell.sh
```

The script prints a JSON object with Cognigy-ready placeholder-equivalent fields:

```json
{
  "cognigyConnection": {
    "connectionType": "sharepoint-client-credentials",
    "tenantId": "<tenant-id>",
    "clientId": "<client-id>",
    "clientSecret": "<client-secret>",
    "graphBaseUrl": "https://graph.microsoft.com/v1.0",
    "requestTimeoutMs": "10000"
  },
  "cognigyKnowledgeConnectorFields": {
    "hostname": "<tenant>.sharepoint.com",
    "sitePath": "/sites/<site-name>",
    "folderPath": "",
    "recursive": true,
    "maxFiles": 50,
    "maxChunkCharacters": 3500,
    "tags": ["sharepoint"]
  }
}
```

The client secret is shown only once by Microsoft. Put it in the Cognigy connection immediately and do not store it in the repository.

## Connector Configuration

The connector fields are defined in `src/knowledge-connectors/sharePointKnowledgeConnector.ts`.

Important field behavior:

- `hostname` is the SharePoint host, for example `contoso.sharepoint.com`.
- `sitePath` is the actual site path, for example `/sites/support` or `/teams/ExampleTeam`.
- `folderPath` is relative to the default document library root.
- `recursive` controls whether subfolders are crawled.
- `maxFiles` limits supported files considered in one run.
- `maxChunkCharacters` controls deterministic chunking.
- `tags` are deduplicated and always include `sharepoint`.

For Teams-connected SharePoint URLs, keep the actual URL shape. A URL under `/teams/ExampleTeam/...` should use `sitePath=/teams/ExampleTeam`, not `/sites/teams/ExampleTeam`.

## Supported Files And Current Limitations

V1 intentionally imports text-first files only:

```text
.txt
.md
.markdown
.csv
.json
.html
.htm
.xml
.yml
.yaml
.log
```

Current limitations:

- Office documents are skipped.
- PDFs are skipped.
- Binary extraction and OCR are not implemented.
- The connector uses the site's default document library drive.
- File identity is based on Microsoft Graph `driveItem.id`.
- Stale-source deletion runs after a successful crawl/import and removes previous sources from this connector that were not seen in the current run.
- `maxFiles` is a safety limit, not a paging or scheduling system.

Add binary conversion or library selection only as deliberate product work, because it changes dependency footprint, runtime cost, and failure modes.

## Build And Package Workflow

Create the Cognigy upload artifact:

```bash
npm run build
tar tzf sharepoint-knowledge-v$(node -p "require('./package.json').version").tar.gz
```

The upload tarball contains:

- compiled `build/*`
- `package.json`
- `package-lock.json`
- `README.md`
- `icon.png`

Create a source archive for sharing or review:

```bash
npm run zip:source
unzip -tq sharepoint-knowledge-source-v$(node -p "require('./package.json').version").zip
```

The source archive intentionally includes source/config/docs/icon files and excludes generated or bulky folders such as:

- `node_modules`
- `build`
- upload tarballs
- older source ZIPs

Keep `README.md` in the upload tarball. Keep `DEVELOPMENT.md` in the source ZIP.

## Changing Import Behavior

Use this checklist for import changes:

1. Update `src/knowledge-connectors/sharePointKnowledgeConnector.ts` for connector field or crawl behavior.
2. Update `src/lib/graphClient.ts` for Graph routing, paging, token, or error behavior.
3. Update `src/lib/text.ts` for text normalization, supported extensions, or chunking.
4. Keep `externalIdentifier` stable unless you intentionally want Cognigy to recreate sources.
5. Preserve wrapped Microsoft Graph errors with status, request, and response body context.
6. Update `scripts/smoke.js` for descriptor-level expectations.
7. Run `npm run build`.
8. Update `README.md` only for user-facing capability changes. Keep implementation detail in this file.

## Manual Acceptance Testing

Local build checks do not call Microsoft Graph or Cognigy Knowledge APIs. Manual acceptance requires real credentials and a Cognigy environment.

Recommended manual checks:

- create a Cognigy connection with tenant/client credentials
- run the connector against a small folder with text, Markdown, CSV, JSON, and HTML files
- confirm Knowledge Sources and chunks appear in Cognigy Knowledge
- rerun without changes and confirm unchanged sources are not re-chunked
- modify one file and confirm only that source is updated
- remove one file and confirm the stale source is deleted
- test a folder path with subfolders when `recursive=true`
- test invalid credentials
- test an invalid `sitePath`
- test an invalid `folderPath`

## Troubleshooting

### Add Knowledge Shows "Unable To Render The Main Content"

Treat this as a descriptor problem first.

Check:

- `npm run build` passes
- `scripts/smoke.js` sees `sharePointKnowledgeConnector`
- `build/module.js` exports `knowledge` with one connector
- connector fields use simple label and description values
- no custom `sections` or `form` metadata was added

Compare the built descriptor with a known-good Cognigy Knowledge Connector before changing Graph code.

### Graph Request Fails With Status 400

The Graph client wraps failures with step context, request details, status, and response body when available.

Debug in this order:

1. Token acquisition.
2. Site resolution.
3. Default drive lookup.
4. Folder listing.
5. File download.

For site resolution, verify:

- `hostname` has no protocol, for example `contoso.sharepoint.com`
- `sitePath` matches the real SharePoint URL path
- root site uses `/`
- Teams-connected sites use `/teams/<name>` when the actual URL does

### Token Request Fails

Check:

- tenant ID or tenant domain is correct
- client ID belongs to the same tenant
- client secret is current and copied exactly
- application permissions were added
- admin consent was granted
- conditional access policy is not blocking app-only token issuance

### Folder Listing Fails

Check:

- the app has access to the target site
- `folderPath` is relative to the default document library root
- leading and trailing slashes are not required
- spaces and special characters are allowed but should match the SharePoint folder names

### Files Are Missing From The Import

Check:

- file extension is in the supported text-first list
- `maxFiles` is high enough
- `recursive` is enabled when files are in subfolders
- files are in the default document library
- files are not empty after text normalization

Office documents and PDFs are expected to be skipped in this version.

### Stale Sources Were Deleted

The connector deletes previous sources from this connector when their external identifiers are not seen in a successful current run. If a folder path, site path, or max-file limit is changed, review the expected source set before running in a production Knowledge project.
