---
name: cognigy-extension-packaging-release
description: "Build, package, version, zip, verify, or hand off Cognigy extension artifacts for normal node extensions and Knowledge Connector packages. Use when preparing upload tarballs, source ZIPs, wrapper ZIPs, package version bumps, lockfile metadata, README Version Log entries, icon validation, production-only package simulations, or shareable code archives. Do not use for implementation-only changes unless artifacts or release bookkeeping are part of the request."
---

# Cognigy Extension Packaging Release

## Workflow

1. Inspect the package layout and current dirty state before building.
2. Determine the requested artifact type:
   - Cognigy upload tarball.
   - Source ZIP.
   - Four-file wrapper ZIP.
   - Clean handoff source folder/archive.
3. Keep generated artifacts out of tracked source unless the repo intentionally tracks a specific bundle.
4. Use package-local scripts when present.
5. Verify artifacts directly, not by assuming the build succeeded.
6. Update package-local README Version Log sections when substantive package work should be recorded.

Read [packaging-and-versioning.md](references/packaging-and-versioning.md) before changing versions, packaging scripts, source ZIPs, wrapper ZIPs, icons, or README version logs.
