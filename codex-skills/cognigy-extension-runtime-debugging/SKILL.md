---
name: cognigy-extension-runtime-debugging
description: "Diagnose pasted Cognigy extension runtime errors, provider API failures, Knowledge Connector failures, Knowledge Source or chunk ingestion errors, stale Cognigy connection schemas, wrong package versions, missing node outputs, branch routing issues, or hosted-vs-local behavior gaps. Use when the user provides an error message, runtime payload, screenshot text, or says a Cognigy extension run does not work."
---

# Cognigy Extension Runtime Debugging

## Workflow

1. Inspect the pasted error, attachment, screenshot text, or runtime payload first.
2. Inspect the current package version, README Version Log, compiled output, and relevant source path before relying on prior memory.
3. Separate what can be proven locally from what requires hosted Cognigy evidence.
4. Prefer adding local smoke coverage or diagnostic context over guessing at hosted runtime behavior.
5. If implementation is requested, patch the narrowest failing path, rebuild/repackage only when needed, and report exactly what remains unverified.

Read [runtime-debugging.md](references/runtime-debugging.md) for normal-node, Knowledge connector, provider API, package-cache, and hosted Cognigy debugging patterns.
