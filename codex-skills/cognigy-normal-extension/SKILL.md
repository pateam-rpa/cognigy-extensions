---
name: cognigy-normal-extension
description: "Build, maintain, review, or debug Cognigy workflow-node extensions that integrate with external APIs or internal services. Use when working on @cognigy/extension-tools normal-node packages with src/module.ts, src/connections, src/nodes, node descriptors, child branch nodes, result storage, provider API behavior, validation, request timeouts, structured error storage, or smoke tests. Do not use for Cognigy Knowledge Connector-only work, packaging-only work, security scans, or pasted runtime errors unless normal node implementation changes are required."
---

# Cognigy Normal Extension

## Workflow

1. Inspect the current package before applying remembered patterns:
   - `package.json`, `src/module.ts`, `src/connections`, `src/nodes`, `src/lib`, and `scripts/smoke.js`.
   - Determine the installed `@cognigy/extension-tools` behavior from local code or installed types.
2. Preserve extension boundaries:
   - Keep flow-specific keys and business labels in node configuration, not hardcoded extension behavior.
   - Register mini branch nodes in `src/module.ts` when parent nodes use Cognigy child routing.
   - Use explicit `On Error` branches when auth, timeout, or server failures should not look like not-found results.
3. Validate provider semantics before changing nodes:
   - Verify that a "reply", "comment", "search", or "update" node calls the provider endpoint that matches the user-facing action.
   - Browse primary/provider docs when endpoint behavior or payload shape may have changed.
4. Add regression coverage in the package-local smoke test for every non-trivial behavior change.
5. Run the package's normal verification flow. If packaging or release artifacts are requested, use `$cognigy-extension-packaging-release`.

Read [normal-node-patterns.md](references/normal-node-patterns.md) when changing node behavior, storage, branching, API clients, validation, or smoke tests.
