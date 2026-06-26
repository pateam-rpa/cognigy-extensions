---
name: cognigy-knowledge-connector
description: "Build, maintain, review, or debug Cognigy Knowledge Connector extensions for remote document sources, content repositories, crawlers, or ingestion providers. Use when working with createKnowledgeConnector, knowledge registration, Add Knowledge UI descriptor shape, Knowledge Source upserts, Knowledge Chunks, externalIdentifier stability, stale-source cleanup, chunk sizing, provider API crawling, or source metadata. Do not use for normal workflow-node-only changes, packaging-only work, security scans, or pasted runtime errors unless Knowledge connector code changes are required."
---

# Cognigy Knowledge Connector

## Workflow

1. Inspect the active connector descriptor, compiled `build/module.js`, and package smoke test before changing runtime import logic.
2. Keep the Cognigy-facing descriptor conservative:
   - `createKnowledgeConnector`.
   - CamelCase connector `type`.
   - Plain string field labels and descriptions.
   - Fields-only descriptor unless a known-good Cognigy UI test proves custom `sections` or `form`.
3. Keep import identity stable:
   - One Knowledge Source per remote document/file.
   - Stable `externalIdentifier`.
   - Plain, sanitized Knowledge Source descriptions.
   - Stale deletion scoped to the current connector prefix/source/folder.
4. Prefer small chunks and precise error context.
5. Run package smoke/build checks and add coverage for descriptor shape, validation, token refresh, guarded paging, and cleanup scope.

Read [knowledge-connector-patterns.md](references/knowledge-connector-patterns.md) when changing connector descriptors, crawlers, source metadata, chunking, or stale cleanup.
