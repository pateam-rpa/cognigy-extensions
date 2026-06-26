# Knowledge Connector Patterns

## Descriptor Shape

Cognigy's Add Knowledge UI is sensitive to descriptor metadata.

- Use `createKnowledgeConnector` from `@cognigy/extension-tools`.
- Register connectors through the extension's `knowledge` array.
- Prefer a camelCase connector type that names the source family, such as `remoteContentKnowledgeConnector`.
- Use plain string `label` and `description` values for fields.
- Avoid translation objects for Knowledge field labels/descriptions unless verified against the current Cognigy UI.
- Keep `sections` and `form` empty or absent unless tested against a known-good Knowledge connector descriptor.
- If the Add Knowledge UI says it cannot render main content, inspect descriptor shape before debugging provider API or runtime import code.

## Source Lifecycle

- Use one Knowledge Source per remote file/document.
- Use a stable `externalIdentifier`, such as the provider's canonical document, file, page, or object ID.
- Keep `externalIdentifier` stable unless the intended behavior is to recreate sources.
- Use source names that help operators identify the remote file, but do not put raw URLs or deep paths into fields with strict Cognigy formats.
- Build `description` as a plain sanitized sentence derived from the file name or source title.
- Keep exact path and URL in chunk metadata when useful.
- Skip chunk upload when `upsertKnowledgeSource` says the source is unchanged.
- Delete stale sources only after a successful crawl/import, and only within the active connector scope.

## Chunking

- Use a safe default around `2000` characters.
- Treat `3000` as a practical upper bound unless Cognigy confirms a higher Knowledge chunk limit.
- Avoid large single chunks, even when the embedding model token limit looks higher.
- Split by paragraph boundaries first, then enforce a hard character limit.
- Include file path, chunk index, text length, source ID, and metadata size in chunk-create error context when possible.
- If chunk creation fails, lower `maxFiles` and `maxChunkCharacters` to isolate the file.

## Provider API Crawler Patterns

For content repository, intranet, cloud-drive, or crawler-backed connectors:

- Use the provider's least-privilege app, service-account, OAuth, API-key, or client-credentials pattern.
- Resolve the actual container, site, workspace, space, library, or collection before traversal.
- Preserve the provider's real URL/path shape; do not rewrite provider-managed path segments by guess.
- Resolve the provider's default content container before folder or page traversal when the API has that concept.
- Use provider-recommended listing and download/content endpoints instead of generic URL scraping when available.
- Follow pagination links only when they match the configured provider API base URL or trusted continuation-token format.
- Refresh access tokens before expiry during long crawls.
- Preserve provider API errors with failing step, status, request URL, correlation/request ID, and response body.

## Supported Files

Keep v1 text-first unless the user explicitly requests binary extraction:

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

Office, PDF, binary extraction, OCR, and library selection are product work. They change dependencies, runtime cost, and failure modes.

## Validation And Cleanup

- Parse integers strictly as decimal integers.
- Parse booleans explicitly; reject values such as `yes` or `maybe`.
- Treat `maxFiles` as a safety limit, not a scheduler.
- Do not delete stale sources after a partial crawl or failed import.
- Scope stale deletion by connector type/source prefix/folder metadata so unrelated Knowledge Sources are not removed.
- Keep customer-specific paths, tenant names, workspace names, folder names, and repository IDs out of committed package docs and scripts. Put one-off values in chat snippets or local-only artifacts.

## Smoke Tests

Smoke tests should load `build/module.js` and assert:

- Exactly the expected Knowledge connector and connection types are registered.
- Descriptor labels/descriptions are strings.
- Connector uses fields-only metadata unless custom form metadata is intentional.
- Validation rejects malformed integers and booleans.
- Token refresh and guarded pagination behavior are covered with mocks.
- Stale-source deletion is scoped to the current connector configuration.
