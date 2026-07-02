# Normal Node Patterns

## Package Shape

Use the package-local shape already present unless the user is creating a new extension:

- `src/module.ts` registers the extension, nodes, connections, and labels.
- `src/connections/*` declares Cognigy connection schemas.
- `src/nodes/<area>/*.ts` contains workflow node descriptors.
- `src/lib/*` contains shared storage, validation, query, and API client helpers.
- `scripts/smoke.js` should load `build/module.js` and assert the descriptors that Cognigy will see.

Do not copy another integration blindly. Use existing packages as shape references, then map behavior to the target provider API.

## Node And Branch Rules

- Register every visible workflow node and mini branch node in `src/module.ts`.
- Parent nodes that route to children should declare child dependencies in their descriptor.
- Use `On Found` only when a concrete result is present.
- Use `On Not Found` only for true not-found results such as a vendor 404 or empty search.
- Use `On Error` for auth, timeout, validation, server, and unexpected vendor failures.
- In Cognigy, branch order can be runtime-sensitive. Preserve known-good ordering and add smoke tests before changing it.

## Result Storage

- Respect the node's configured storage location and dotted storage key.
- Do not hardcode project-specific storage keys; those belong in Cognigy Flow configuration.
- For same-message visibility, update the live `cognigy.input` or `cognigy.context` object at the dotted key when the local SDK behavior requires it.
- Also call Cognigy's official storage API so the platform persists the result.
- Avoid intermediate `null` writes unless the platform behavior is proven and covered. They can leak into later nodes.
- Add smoke coverage for stale value replacement and repeated node calls when storage behavior changes.

## API Client Rules

- Add bounded timeouts to every outbound token, API, and file-download request.
- Normalize regional base URLs from stable connection fields rather than asking users for hidden URL fields unless the current package intentionally exposes them.
- Add no-cache headers on GET search/list calls if repeated Cognigy executions can show stale results.
- Serialize vendor errors into a stable stored structure with message, status, code, request context, and response body details when safe.
- Redact or omit secrets from errors and logs.

## Provider Semantics

- Verify endpoint semantics against provider docs before naming a node.
- A user-facing "reply", "comment", "note", or "message" action should call the provider endpoint with matching semantics; similar-looking endpoints can create different records.
- Search field names can be misleading. Document and test provider quirks such as exact match, prefix search, contains search, and wildcard requirements.
- Keep destructive or broad administrative endpoints out unless the user explicitly expands scope.

## Validation

- Reject blank required strings after trimming.
- Parse integers strictly as plain decimal integers; do not accept partial strings, floats, hex, or scientific notation.
- Validate booleans explicitly when values can arrive as strings.
- Validate JSON arrays used for tags, attachment IDs, or recipients; require strings when the API expects strings.
- Validate attachment URLs as `http` or `https`; reject unsupported schemes before downloading.
- Bound attachment size and avoid local filesystem writes for runtime uploads.

## Smoke Tests

Smoke tests should assert behavior that has failed before:

- Module loads from `build/module.js`.
- Connection type and expected fields are registered.
- All user nodes and mini branch nodes are registered.
- Branch dependencies remain intact.
- Storage replacement and repeated node calls work.
- Provider-specific endpoint paths and payload shapes are protected.
- Invalid user input is stored as a structured error rather than thrown raw unless the node should fail before storage.
