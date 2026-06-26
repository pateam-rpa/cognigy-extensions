# Local Security Scans

Run the repeatable local scan from the workspace root:

```bash
./scripts/security-scan.sh
```

The script scans both Cognigy extension packages:

- `zoho-desk-extension`
- `sharepoint-knowledge-extension`

It writes reports to `.security-reports/`, which is ignored by git. Override that location with:

```bash
SECURITY_REPORT_DIR=/tmp/cognigy-security-reports ./scripts/security-scan.sh
```

## Required Tools

Install the local scanners before running the command:

```bash
brew install semgrep gitleaks osv-scanner
```

Node.js/npm must also be available because the package dependency scan uses `npm audit`, and the wrapper uses Node.js to classify JSON scanner output.

## What Blocks The Run

The first version is intentionally strict only on high-signal findings:

- `npm audit --audit-level=high` fails for high or critical dependency findings.
- OSV-Scanner fails only when its report contains high or critical dependency findings.
- Gitleaks fails on detected secrets in git history or the current git-visible worktree.
- Semgrep fails on `ERROR` rules from the standard JavaScript/TypeScript rules and `security/semgrep.yml`.
- Missing scanners or scanner runtime errors fail the run with an install or report pointer.

Warnings are still reported, but they do not block the command.

## Current Custom Semgrep Coverage

The local rules focus on risks specific to these Cognigy extensions:

- outbound `axios` calls without an inline bounded timeout;
- Knowledge Source descriptions derived from raw SharePoint URLs or paths;
- outbound fetches that use Cognigy config URL fields;
- console output that mentions token or client-secret fields;
- empty custom descriptor arrays that can indicate Cognigy descriptor shape drift.

## Triage Rules

Treat scanner output as a review queue, not a blind rewrite trigger:

- Fix secrets immediately, then rotate the exposed credential.
- For dependency findings, prefer targeted upgrades that keep the Cognigy runtime contract intact.
- For Semgrep warnings, confirm whether the finding is real before changing behavior.
- If a warning is intentionally accepted, document the reason near the relevant code or in this file before suppressing a rule.

The scan does not build or repackage extensions. Keep using each package's existing `npm run build` before creating upload artifacts.
