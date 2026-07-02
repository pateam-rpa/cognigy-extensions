#!/usr/bin/env bash

set -u
set -o pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="${SECURITY_REPORT_DIR:-$ROOT/.security-reports}"
PACKAGES=(
	"zoho-desk-extension"
	"sharepoint-knowledge-extension"
)

failures=()
warnings=()
GITLEAKS_WORKTREE_TMP=""

section() {
	printf '\n== %s ==\n' "$1"
}

pass() {
	printf 'PASS: %s\n' "$1"
}

warn() {
	printf 'WARN: %s\n' "$1"
	warnings+=("$1")
}

fail() {
	printf 'FAIL: %s\n' "$1"
	failures+=("$1")
}

has_command() {
	command -v "$1" >/dev/null 2>&1
}

require_command() {
	local command_name="$1"
	local install_hint="$2"

	if has_command "$command_name"; then
		return 0
	fi

	fail "Missing required scanner '$command_name'. Install it with: $install_hint"
	return 1
}

json_array_has_items() {
	local report_path="$1"

	node - "$report_path" <<'NODE'
const fs = require("fs");
const reportPath = process.argv[2];

if (!fs.existsSync(reportPath)) {
	process.exit(2);
}

const raw = fs.readFileSync(reportPath, "utf8").trim();
if (!raw) {
	process.exit(1);
}

const parsed = JSON.parse(raw);
process.exit(Array.isArray(parsed) && parsed.length > 0 ? 0 : 1);
NODE
}

osv_has_high_or_critical() {
	local report_path="$1"

	node - "$report_path" <<'NODE'
const fs = require("fs");
const reportPath = process.argv[2];
const raw = fs.readFileSync(reportPath, "utf8").trim();

if (!raw) {
	process.exit(1);
}

const report = JSON.parse(raw);
const results = Array.isArray(report.results) ? report.results : [];

const severityText = vulnerability => JSON.stringify([
	vulnerability.severity,
	vulnerability.database_specific && vulnerability.database_specific.severity,
	vulnerability.ecosystem_specific && vulnerability.ecosystem_specific.severity
]).toUpperCase();

const scoreValues = vulnerability => {
	const values = [];
	const collect = value => {
		if (typeof value === "number") {
			values.push(value);
			return;
		}
		if (typeof value !== "string") {
			return;
		}
		const numeric = value.match(/(?:^|[^0-9])([0-9](?:\.[0-9])?)(?:$|[^0-9])/);
		if (numeric) {
			values.push(Number(numeric[1]));
		}
	};

	for (const entry of vulnerability.severity || []) {
		collect(entry && entry.score);
	}
	collect(vulnerability.cvss);
	return values;
};

for (const result of results) {
	for (const pkg of result.packages || []) {
		for (const vulnerability of pkg.vulnerabilities || []) {
			const text = severityText(vulnerability);
			if (text.includes("CRITICAL") || text.includes("HIGH")) {
				process.exit(0);
			}
			if (scoreValues(vulnerability).some(score => score >= 7)) {
				process.exit(0);
			}
		}
	}
}

process.exit(1);
NODE
}

prepare_reports() {
	mkdir -p "$REPORT_DIR"
	rm -f "$REPORT_DIR"/*.json "$REPORT_DIR"/*.txt 2>/dev/null || true
}

run_npm_audit() {
	section "npm audit"

	if ! require_command "npm" "install Node.js/npm from https://nodejs.org/"; then
		return
	fi

	for package_dir in "${PACKAGES[@]}"; do
		local absolute_package_dir="$ROOT/$package_dir"
		local report_path="$REPORT_DIR/npm-audit-${package_dir}.json"

		if [ ! -f "$absolute_package_dir/package-lock.json" ]; then
			fail "$package_dir is missing package-lock.json; npm audit is not repeatable."
			continue
		fi

		if (cd "$absolute_package_dir" && npm audit --audit-level=high --json >"$report_path"); then
			pass "$package_dir has no high or critical npm audit findings."
		else
			fail "$package_dir has high/critical npm audit findings or npm audit failed. See $report_path"
		fi
	done
}

run_osv_scanner() {
	section "OSV-Scanner"

	if ! require_command "osv-scanner" "brew install osv-scanner"; then
		return
	fi
	if ! require_command "node" "install Node.js from https://nodejs.org/"; then
		return
	fi

	local report_json="$REPORT_DIR/osv-scanner.json"
	local report_text="$REPORT_DIR/osv-scanner.txt"
	local report_error="$REPORT_DIR/osv-scanner.stderr.txt"
	local osv_command=(osv-scanner)

	if osv-scanner scan --help >/dev/null 2>&1; then
		osv_command=(osv-scanner scan)
	fi

	"${osv_command[@]}" -r "$ROOT" --format json >"$report_json" 2>"$report_error"
	local json_status=$?
	"${osv_command[@]}" -r "$ROOT" --format table >"$report_text" 2>>"$report_error"
	local table_status=$?

	if [ "$json_status" -eq 0 ] && [ "$table_status" -eq 0 ]; then
		pass "No OSV dependency vulnerabilities found."
		return
	fi

	if [ "$json_status" -ge 127 ] || [ "$table_status" -ge 127 ]; then
		fail "OSV-Scanner failed to run cleanly. See $report_error"
		return
	fi

	if osv_has_high_or_critical "$report_json"; then
		fail "OSV-Scanner found high/critical dependency vulnerabilities. See $report_text and $report_json"
	else
		warn "OSV-Scanner found dependency vulnerabilities below the blocking threshold. See $report_text and $report_json"
	fi
}

copy_git_visible_tree() {
	local target_dir="$1"

	(
		cd "$ROOT" || exit 1
		git ls-files --cached --others --exclude-standard -z |
			while IFS= read -r -d '' path; do
				if [ -f "$path" ]; then
					mkdir -p "$target_dir/$(dirname "$path")"
					cp -p "$path" "$target_dir/$path"
				fi
			done
	)
}

run_gitleaks() {
	section "Gitleaks"

	if ! require_command "gitleaks" "brew install gitleaks"; then
		return
	fi
	if ! require_command "git" "install Git from https://git-scm.com/"; then
		return
	fi
	if ! require_command "node" "install Node.js from https://nodejs.org/"; then
		return
	fi

	local history_report="$REPORT_DIR/gitleaks-history.json"
	local worktree_report="$REPORT_DIR/gitleaks-worktree.json"
	local worktree_tmp

	worktree_tmp="$(mktemp -d "${TMPDIR:-/tmp}/cognigy-security.XXXXXX")"
	GITLEAKS_WORKTREE_TMP="$worktree_tmp"
	trap 'if [ -n "${GITLEAKS_WORKTREE_TMP:-}" ]; then rm -rf "$GITLEAKS_WORKTREE_TMP"; fi' EXIT

	if gitleaks git --redact --report-format json --report-path "$history_report" "$ROOT"; then
		pass "No secrets found in git history."
	else
		if json_array_has_items "$history_report"; then
			fail "Gitleaks found secrets in git history. See $history_report"
		else
			fail "Gitleaks git-history scan failed before producing findings. See $history_report"
		fi
	fi

	copy_git_visible_tree "$worktree_tmp/current-tree"

	if gitleaks dir --redact --report-format json --report-path "$worktree_report" "$worktree_tmp/current-tree"; then
		pass "No secrets found in the current git-visible worktree."
	else
		if json_array_has_items "$worktree_report"; then
			fail "Gitleaks found secrets in the current git-visible worktree. See $worktree_report"
		else
			fail "Gitleaks worktree scan failed before producing findings. See $worktree_report"
		fi
	fi
}

run_semgrep() {
	section "Semgrep"

	if ! require_command "semgrep" "brew install semgrep"; then
		return
	fi

	local semgrep_command=(semgrep)
	if semgrep scan --help >/dev/null 2>&1; then
		semgrep_command=(semgrep scan)
	fi

	local common_args=(
		--config p/javascript
		--config p/typescript
		--config "$ROOT/security/semgrep.yml"
		--metrics=off
		--exclude node_modules
		--exclude build
		--exclude "*.tar.gz"
		--exclude "*.zip"
	)
	local all_report="$REPORT_DIR/semgrep-all.json"
	local blocking_report="$REPORT_DIR/semgrep-blocking.json"
	local semgrep_state_dir="$REPORT_DIR/semgrep-state"

	mkdir -p "$semgrep_state_dir/config" "$semgrep_state_dir/cache"

	if XDG_CONFIG_HOME="$semgrep_state_dir/config" \
		XDG_CACHE_HOME="$semgrep_state_dir/cache" \
		SEMGREP_LOG_FILE="$semgrep_state_dir/semgrep.log" \
		SEMGREP_SETTINGS_FILE="$semgrep_state_dir/settings.yml" \
		SEMGREP_VERSION_CACHE_PATH="$semgrep_state_dir/version-cache" \
		"${semgrep_command[@]}" "${common_args[@]}" --json-output "$all_report" "$ROOT"; then
		pass "Semgrep full report completed. See $all_report"
	else
		fail "Semgrep full report failed, likely due to configuration or registry access. See $all_report"
		return
	fi

	if XDG_CONFIG_HOME="$semgrep_state_dir/config" \
		XDG_CACHE_HOME="$semgrep_state_dir/cache" \
		SEMGREP_LOG_FILE="$semgrep_state_dir/semgrep.log" \
		SEMGREP_SETTINGS_FILE="$semgrep_state_dir/settings.yml" \
		SEMGREP_VERSION_CACHE_PATH="$semgrep_state_dir/version-cache" \
		"${semgrep_command[@]}" "${common_args[@]}" --severity ERROR --error --json-output "$blocking_report" "$ROOT"; then
		pass "No blocking Semgrep findings."
	else
		fail "Semgrep found blocking ERROR-severity findings or failed. See $blocking_report"
	fi
}

summarize() {
	section "Summary"
	printf 'Reports: %s\n' "$REPORT_DIR"

	if [ "${#warnings[@]}" -gt 0 ]; then
		printf '\nWarnings:\n'
		for warning in "${warnings[@]}"; do
			printf ' - %s\n' "$warning"
		done
	fi

	if [ "${#failures[@]}" -gt 0 ]; then
		printf '\nFailures:\n'
		for failure in "${failures[@]}"; do
			printf ' - %s\n' "$failure"
		done
		exit 1
	fi

	printf '\nSecurity scan passed.\n'
}

main() {
	prepare_reports
	run_npm_audit
	run_osv_scanner
	run_gitleaks
	run_semgrep
	summarize
}

main "$@"
