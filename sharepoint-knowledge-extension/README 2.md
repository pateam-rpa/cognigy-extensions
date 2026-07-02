# SharePoint Knowledge Extension

This Cognigy extension adds a SharePoint Knowledge Connector. It imports text-first files from a SharePoint document library through Microsoft Graph and writes them into Cognigy Knowledge as Knowledge Sources and Knowledge Chunks.

The connector uses Microsoft Graph application permissions with the OAuth 2.0 client credentials flow. Cognigy stores the tenant ID, client ID, and client secret in a connection.

## Version Log

### 0.1.9 - 2026-06-26

- Replaced organization-specific SharePoint Teams path examples with generic placeholder values.

### 0.1.8 - 2026-06-25

- Tightened connector validation for numeric and boolean configuration values.
- Scoped stale-source cleanup to the current SharePoint source prefix and folder.
- Refreshed Microsoft Graph tokens before expiry during longer syncs and guarded paginated nextLink URLs.
- Added the repeatable local security scan workflow covering dependency audit, OSV-Scanner, Gitleaks, and Semgrep.

### 0.1.7 - 2026-06-22

- Added the standalone SharePoint Knowledge Connector package.
- Added Microsoft Graph client credentials connection support for tenant ID, client ID, client secret, optional Graph base URL, and request timeout.
- Added SharePoint site resolution, default document library traversal, recursive folder crawling, text-file download, deterministic text chunking, Knowledge Source upsert, Knowledge Chunk creation, unchanged-source skipping, and stale-source cleanup.
- Added support for text-first files: `.txt`, `.md`, `.markdown`, `.csv`, `.json`, `.html`, `.htm`, `.xml`, `.yml`, `.yaml`, and `.log`.
- Added Azure Cloud Shell provisioning script for creating the Microsoft Entra app registration and printing Cognigy-ready connection and connector values.
- Aligned the Knowledge Connector descriptor with Cognigy-compatible field metadata so the Add Knowledge UI can render the connector selection.
- Improved Microsoft Graph error reporting with request step, status, URL, and response body context.

## Requirements

- Cognigy.AI extension upload permissions.
- A Microsoft Entra app registration.
- Microsoft Graph application permissions with admin consent:
  - `Sites.Read.All`
  - `Files.Read.All`
- A SharePoint site and document library available to the app registration.

## Microsoft Setup

1. Create an app registration in Microsoft Entra ID.
2. Create a client secret.
3. Add Microsoft Graph application permissions:
   - `Sites.Read.All`
   - `Files.Read.All`
4. Grant admin consent for the permissions.
5. Copy the tenant ID, client ID, and client secret into the Cognigy connection.

## Azure Cloud Shell Setup

You can create the Microsoft Entra app registration from Azure Cloud Shell with:

```bash
chmod +x scripts/create-azure-app-cloud-shell.sh
./scripts/create-azure-app-cloud-shell.sh
```

The script creates:

- a single-tenant Microsoft Entra app registration
- a service principal
- a client secret
- Microsoft Graph application permission requests for `Sites.Read.All` and `Files.Read.All`
- admin consent when the signed-in Cloud Shell user is allowed to grant it

It prints one JSON object containing the Cognigy connection fields:

```json
{
  "cognigyConnection": {
    "connectionType": "sharepoint-client-credentials",
    "tenantId": "...",
    "clientId": "...",
    "clientSecret": "...",
    "graphBaseUrl": "https://graph.microsoft.com/v1.0",
    "requestTimeoutMs": "10000"
  },
  "cognigyKnowledgeConnectorFields": {
    "hostname": "<your-tenant>.sharepoint.com",
    "sitePath": "/sites/<site-name>",
    "folderPath": "",
    "recursive": true,
    "maxFiles": 50,
    "maxChunkCharacters": 3500,
    "tags": ["sharepoint"]
  }
}
```

Optional environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `APP_NAME` | `Cognigy SharePoint Knowledge Connector` | App registration display name. |
| `SECRET_DISPLAY_NAME` | `Cognigy SharePoint Client Secret` | Client secret display name. |
| `SECRET_YEARS` | `1` | Client secret validity in years. |
| `GRANT_ADMIN_CONSENT` | `true` | Set to `false` to skip automatic admin consent. |
| `SHAREPOINT_HOSTNAME` | `<your-tenant>.sharepoint.com` | SharePoint hostname printed in connector fields. |
| `SHAREPOINT_SITE_PATH` | `/sites/<site-name>` | SharePoint site path printed in connector fields. |
| `SHAREPOINT_FOLDER_PATH` | empty | Folder path relative to the default document library root. |
| `SHAREPOINT_RECURSIVE` | `true` | Whether the connector should include subfolders. |
| `SHAREPOINT_MAX_FILES` | `50` | Maximum supported files printed in connector fields. |
| `SHAREPOINT_MAX_CHUNK_CHARACTERS` | `3500` | Maximum chunk size printed in connector fields. |
| `SHAREPOINT_TAGS_JSON` | `["sharepoint"]` | JSON array of source tags printed in connector fields. |
| `OUTPUT_FILE` | empty | Optional path to also write the JSON output. |

Example with custom values:

```bash
APP_NAME="Cognigy SharePoint Knowledge - Prod" \
SECRET_YEARS=2 \
./scripts/create-azure-app-cloud-shell.sh
```

The client secret is shown only once by Microsoft. Store it in the Cognigy connection immediately.

The extension requests tokens from:

```text
https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
```

It uses the Graph scope:

```text
https://graph.microsoft.com/.default
```

## Connection

Create a Cognigy connection of type `SharePoint Client Credentials`.

| Field | Description |
| --- | --- |
| `tenantId` | Microsoft tenant ID or tenant domain. |
| `clientId` | Entra app registration client ID. |
| `clientSecret` | Entra app registration client secret. |
| `graphBaseUrl` | Optional. Defaults to `https://graph.microsoft.com/v1.0`. |
| `requestTimeoutMs` | Optional. Defaults to `10000`; allowed range is `1000` to `30000`. |

## Connector Configuration

| Field | Description |
| --- | --- |
| `SharePoint Connection` | The Cognigy connection above. |
| `Knowledge Source Prefix` | Prefix for source names. Defaults to `SharePoint`. |
| `SharePoint Hostname` | Example: `contoso.sharepoint.com`. |
| `Site Path` | Examples: `/sites/support` for SharePoint sites, `/teams/ExampleTeam` for Teams-connected sites. Use `/` for the root site. |
| `Folder Path` | Path relative to the default document library root. Leave empty for root. |
| `Include Subfolders` | Recursively imports supported files from subfolders. Defaults to enabled. |
| `Maximum Files` | Import limit for supported files. Defaults to `50`; allowed range is `1` to `500`. |
| `Maximum Chunk Characters` | Maximum text chunk size. Defaults to `3500`; allowed range is `500` to `12000`. |
| `Tags` | Tags added to each Knowledge Source. The connector always includes `sharepoint`. |

## Import Behavior

The connector resolves the SharePoint site with Microsoft Graph, walks the configured default document library folder, downloads supported files, splits text into deterministic chunks, and calls Cognigy Knowledge APIs.

Each imported file becomes one Cognigy Knowledge Source:

| Cognigy field | Value |
| --- | --- |
| `externalIdentifier` | Microsoft Graph `driveItem.id`. |
| `name` | `{Knowledge Source Prefix}: {folder/file path}`. |
| `description` | Plain sanitized SharePoint document label derived from the file name. |
| `tags` | Configured tags plus `sharepoint`. |
| `chunkCount` | Number of generated chunks. |
| `contentHashOrTimestamp` | Graph `eTag`, `cTag`, or `lastModifiedDateTime`. |

The exact SharePoint folder path and web URL are still attached to generated chunks as metadata.

If Cognigy reports that a source is unchanged, chunks are not uploaded again. After a successful crawl/import, previous sources created by this connector that were not seen in the current run are deleted.

## Supported Files

V1 intentionally imports text-first files only:

- `.txt`
- `.md`
- `.markdown`
- `.csv`
- `.json`
- `.html`
- `.htm`
- `.xml`
- `.yml`
- `.yaml`
- `.log`

Office documents and PDFs are skipped in this version. Add conversion or extraction support in a later version if needed.

## Build

Install dependencies and build the upload artifact:

```bash
npm install
npm run build
```

The build runs TypeScript transpilation, TSLint, a smoke check, and creates:

```text
sharepoint-knowledge-v<version>.tar.gz
```

The tarball contains the compiled extension, package files, README, and `icon.png`.

## Verification

Recommended local checks:

```bash
npm run build
tar tzf sharepoint-knowledge-v<version>.tar.gz
```

Manual acceptance tests require real Microsoft Graph credentials:

- create a Cognigy connection with tenant/client credentials
- run the connector against a small SharePoint folder containing text, Markdown, CSV, JSON, and HTML files
- confirm Knowledge Sources and chunks appear in Build > Knowledge
- modify one file and rerun; confirm only the changed source is re-chunked
- remove one file and rerun; confirm the stale source is deleted
- test invalid credentials and an invalid folder path for clear connector failures

## References

- Cognigy Extensions: https://docs.cognigy.com/ai/for-developers/extensions
- Cognigy extension-tools: https://www.npmjs.com/package/@cognigy/extension-tools
- Cognigy example Knowledge Connector: https://github.com/Cognigy/Extensions/blob/master/docs/example/src/knowledge-connectors/simpleKnowledgeConnector.ts
- Microsoft Graph client credentials flow: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow
- Microsoft Graph get site by path: https://learn.microsoft.com/en-us/graph/api/site-getbypath
- Microsoft Graph list drive item children: https://learn.microsoft.com/en-us/graph/api/driveitem-list-children
- Microsoft Graph download drive item content: https://learn.microsoft.com/en-us/graph/api/driveitem-get-content
