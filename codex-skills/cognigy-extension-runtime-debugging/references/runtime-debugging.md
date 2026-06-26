# Runtime Debugging

## First Pass

Start with facts:

- Read the full pasted error or attachment.
- Identify package: normal workflow-node extension or Knowledge connector.
- Inspect current `package.json`, README Version Log, and `build/module.js`.
- Check whether the user may be running an older upload artifact.
- Check whether Cognigy may be using an old saved connection schema.

Do not assume old thread memory is current. Verify against the files in front of you.

## Hosted Versus Local

Local checks can prove:

- TypeScript compiles.
- Lint passes.
- Smoke tests cover descriptor and mocked behavior.
- Tarballs contain the right code and version.
- The module loads from an extracted production package.

Local checks cannot prove:

- Cognigy actually executes a specific node path.
- Hosted Cognigy uses the new uploaded package.
- An existing Cognigy connection discarded old hidden fields.
- Real provider credentials, scopes, permissions, and account-level entitlements are valid.
- AI Agent prompt/tool handoff reads the same input key the node writes.

When hosted evidence is needed, ask for the specific execution trace, final Input/Context, node config, package version visible in Cognigy, or full platform error.

## Normal Node Debugging

For missing or stale outputs:

- Confirm the node actually executed in the same message path.
- Confirm `Where to store the result` and the exact dotted storage key.
- Check key casing, for example `caseData` versus `casedata`.
- Confirm later nodes or prompts read the same key.
- Check whether an error branch was taken.
- Add a temporary Say/Debug node before and after the extension node in Cognigy.
- Add local smoke tests for repeated calls and stale value replacement.

For branching bugs:

- Check `setNextNode` order only with evidence. Some Cognigy behavior depends on route-first patterns.
- Add smoke tests that assert the known-good event order.
- Keep `On Not Found` reserved for true not-found and use `On Error` for failures.

For provider API errors:

- Distinguish wrong endpoint from wrong credentials.
- HTML from a different product or portal on an API call often means the API base URL or regional host is wrong.
- Provider search fields may need exact, prefix, contains, or wildcard syntax. Verify against primary docs and capture it in tests.
- Verify semantic endpoint names: replies, comments, conversations, tags, contacts, and resolutions differ.

## Knowledge Connector Debugging

Identify the failing stage:

- Token request.
- Site resolve.
- Default drive resolve.
- Folder listing.
- File download.
- Source upsert.
- Chunk creation.
- Stale-source deletion.

For provider API crawler errors:

- Preserve status, request URL, response body, request ID, and failed stage.
- Check actual remote URL/path shape; do not rewrite provider-managed path segments by guess.
- Check app-only, service-account, OAuth, API-key, or admin-consent permissions for the exact content being crawled.
- Use provider-recommended listing/download/content endpoints unless the connector intentionally supports another traversal mode.

For Knowledge source validation:

- Raw URLs or deep paths can fail strict description formats.
- Use sanitized sentence-like descriptions and keep exact path/URL in metadata.

For chunk failures:

- A 4900 character file can still fail if sent as one chunk.
- Start with `maxChunkCharacters: 2000`.
- Test with low `maxFiles` to isolate the file.
- Add error context with file path, chunk index, chunk length, source ID, and metadata size.

## Schema Cache And Version Mismatch

If Cognigy still shows old fields or behavior:

- Verify the upload tarball embedded version.
- Bump package version when public connection or descriptor shape changed.
- Rebuild and upload the new tarball.
- Create a new Cognigy connection instead of reusing an old one when hidden fields may persist.
- Confirm the node package in Cognigy is the expected version before debugging runtime logic.

## Response Pattern

When closing a runtime debug task:

- State what was proven locally.
- State what was changed.
- State the new artifact path/version if rebuilt.
- State the hosted evidence still needed, if any.
- Avoid claiming Cognigy runtime success unless it was actually run in Cognigy.
