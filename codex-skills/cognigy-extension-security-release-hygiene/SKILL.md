---
name: cognigy-extension-security-release-hygiene
description: "Run security scans, harden, sanitize, or prepare Cognigy extension repositories for sharing or public GitHub release. Use for repeatable local scanning, npm audit, OSV-Scanner, Gitleaks, Semgrep, customer-name sweeps, generated artifact scans, git-history checks, fresh-clone verification, or repo visibility changes. Do not use for ordinary feature work or packaging unless scan hygiene or public-release readiness is part of the request."
---

# Cognigy Extension Security Release Hygiene

## Workflow

1. Prefer existing workspace commands and config over ad hoc scanner invocations.
2. Explain scan coverage precisely:
   - Current worktree.
   - Tracked files.
   - Untracked non-ignored files.
   - Ignored/generated artifacts.
   - Git history.
   - Fresh remote clone, when public release matters.
3. Run or update the repeatable scan only when the user asks for implementation/execution.
4. Treat scanner findings as triage inputs, not noise.
5. Before public release, scan source, archives, wrapper ZIPs, git history, and GitHub-visible state.

Read [security-scan-and-public-release.md](references/security-scan-and-public-release.md) before changing scanner setup, hardening findings, customer-data cleanup, git history, or repository visibility.
