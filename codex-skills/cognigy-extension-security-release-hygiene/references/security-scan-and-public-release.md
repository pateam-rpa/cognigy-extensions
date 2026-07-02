# Security Scan And Public Release

## Repeatable Scan Command

For this workspace family, prefer the root command:

```bash
./scripts/security-scan.sh
```

Expected scanner stack:

- `npm audit --audit-level=high` in both package folders.
- OSV-Scanner for dependency vulnerability context.
- Gitleaks for secrets in history and current git-visible worktree.
- Semgrep for JavaScript/TypeScript and repo-local Cognigy rules.

If tools are missing, report that as a setup blocker, install only with approval when needed, and rerun the wrapper.

## Semgrep State

Semgrep may try to write under `~/.semgrep`, which can fail in managed environments.

Route state and logs under ignored workspace-local paths such as `.security-reports/`:

- `XDG_CONFIG_HOME`
- `XDG_CACHE_HOME`
- `SEMGREP_LOG_FILE`
- `SEMGREP_SETTINGS_FILE`
- `SEMGREP_VERSION_CACHE_PATH`

Guard shell cleanup variables so early scanner failures do not trigger unbound-variable exits.

## Cognigy-Specific Rules

High-value Semgrep or review checks:

- Outbound `axios` or HTTP calls without bounded timeouts.
- Secret-like fields printed or stored in logs: `clientSecret`, `refreshToken`, `access_token`, `Authorization`.
- User-controlled URL fetches without validation.
- Knowledge Source descriptions derived from raw URL/path values.
- Empty or risky custom Knowledge descriptor `sections` / `form` arrays.
- Setup scripts that print or commit customer-specific tenant/site values.

Treat missing timeout findings as real until proven otherwise.

## Coverage Reporting

Always state what was scanned:

- `npm audit`: current package lockfiles on disk.
- OSV-Scanner: current workspace manifests/lockfiles/files according to command flags.
- Gitleaks: git history plus current git-visible worktree when both modes are run.
- Semgrep: often tracked files only unless configured otherwise.
- Archives: only covered if explicitly unpacked or scanned with archive-aware commands.
- Ignored local artifacts: not covered by normal tracked-file scans unless explicitly included.

If untracked `.ts` or `.js` files exist, do not assume Semgrep covered them.

## Customer Data Sweeps

When sweeping for customer names or examples:

- Search current tracked source.
- Search untracked non-ignored files.
- Search generated upload tarballs and source ZIPs.
- Search wrapper ZIPs.
- Search git history.
- Search a fresh remote clone when GitHub visibility matters.

Use neutral examples in committed code and docs; avoid real tenant, workspace, repository, folder, ticket, account, or customer identifiers.

## Public GitHub Hygiene

Before making a repo public:

- Confirm current tracked source is clean.
- Confirm tracked bundles/archives are clean.
- Confirm git history is clean, or decide explicitly to rewrite/recreate history.
- Force-pushing a one-commit clean history is destructive and should be deliberate.
- Verify from a fresh GitHub clone, not only local refs.
- Expire and prune local reflogs only when the user asked to clean local history too.

For leaked secrets, cleanup is not enough. Rotate credentials and consider provider/GitHub support purges.

## Version Logs

Security or hardening work that changes package behavior should normally be reflected in package-local README Version Log sections.

If the change only records already-performed work and the user does not ask for a release, update existing version-log entries without bumping package versions or rebuilding artifacts.
