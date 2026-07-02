#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-Cognigy SharePoint Knowledge Connector}"
SECRET_DISPLAY_NAME="${SECRET_DISPLAY_NAME:-Cognigy SharePoint Client Secret}"
SECRET_YEARS="${SECRET_YEARS:-1}"
GRANT_ADMIN_CONSENT="${GRANT_ADMIN_CONSENT:-true}"
GRAPH_BASE_URL="${GRAPH_BASE_URL:-https://graph.microsoft.com/v1.0}"
REQUEST_TIMEOUT_MS="${REQUEST_TIMEOUT_MS:-10000}"
OUTPUT_FILE="${OUTPUT_FILE:-}"
SHAREPOINT_HOSTNAME="${SHAREPOINT_HOSTNAME:-<your-tenant>.sharepoint.com}"
SHAREPOINT_SITE_PATH="${SHAREPOINT_SITE_PATH:-/sites/<site-name>}"
SHAREPOINT_FOLDER_PATH="${SHAREPOINT_FOLDER_PATH:-}"
SHAREPOINT_RECURSIVE="${SHAREPOINT_RECURSIVE:-true}"
SHAREPOINT_MAX_FILES="${SHAREPOINT_MAX_FILES:-50}"
SHAREPOINT_MAX_CHUNK_CHARACTERS="${SHAREPOINT_MAX_CHUNK_CHARACTERS:-3500}"
SHAREPOINT_TAGS_JSON="${SHAREPOINT_TAGS_JSON:-[\"sharepoint\"]}"

MICROSOFT_GRAPH_APP_ID="00000003-0000-0000-c000-000000000000"

require_command() {
	local command_name="$1"

	if ! command -v "${command_name}" >/dev/null 2>&1; then
		echo "Missing required command: ${command_name}" >&2
		exit 1
	fi
}

graph_app_role_id() {
	local permission_value="$1"
	local role_id

	role_id="$(az ad sp show \
		--id "${MICROSOFT_GRAPH_APP_ID}" \
		--query "appRoles[?value=='${permission_value}' && contains(allowedMemberTypes, 'Application')].id | [0]" \
		-o tsv)"

	if [[ -z "${role_id}" || "${role_id}" == "null" ]]; then
		echo "Could not resolve Microsoft Graph application permission: ${permission_value}" >&2
		exit 1
	fi

	printf "%s" "${role_id}"
}

service_principal_object_id() {
	local app_id="$1"
	local object_id=""

	for _attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
		if object_id="$(az ad sp show --id "${app_id}" --query id -o tsv 2>/dev/null)" && [[ -n "${object_id}" ]]; then
			printf "%s" "${object_id}"
			return 0
		fi

		sleep 5
	done

	echo "Service principal was created but could not be read yet. Try again in a few minutes." >&2
	exit 1
}

require_command az
require_command python3

if ! az account show >/dev/null 2>&1; then
	echo "Azure CLI is not logged in. Run 'az login' or use an authenticated Azure Cloud Shell session." >&2
	exit 1
fi

TENANT_ID="$(az account show --query tenantId -o tsv)"
SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
SIGNED_IN_USER="$(az account show --query user.name -o tsv)"

SITES_READ_ALL_ROLE_ID="$(graph_app_role_id "Sites.Read.All")"
FILES_READ_ALL_ROLE_ID="$(graph_app_role_id "Files.Read.All")"

APP_JSON="$(az ad app create \
	--display-name "${APP_NAME}" \
	--sign-in-audience AzureADMyOrg \
	--query "{appId:appId, objectId:id, displayName:displayName}" \
	-o json)"

APP_ID="$(APP_JSON="${APP_JSON}" python3 - <<'PY'
import json
import os

print(json.loads(os.environ["APP_JSON"])["appId"])
PY
)"

APP_OBJECT_ID="$(APP_JSON="${APP_JSON}" python3 - <<'PY'
import json
import os

print(json.loads(os.environ["APP_JSON"])["objectId"])
PY
)"

az ad sp create --id "${APP_ID}" --only-show-errors >/dev/null
SERVICE_PRINCIPAL_OBJECT_ID="$(service_principal_object_id "${APP_ID}")"

az ad app permission add \
	--id "${APP_ID}" \
	--api "${MICROSOFT_GRAPH_APP_ID}" \
	--api-permissions "${SITES_READ_ALL_ROLE_ID}=Role" "${FILES_READ_ALL_ROLE_ID}=Role" \
	--only-show-errors >/dev/null

CLIENT_SECRET="$(az ad app credential reset \
	--id "${APP_ID}" \
	--append \
	--display-name "${SECRET_DISPLAY_NAME}" \
	--years "${SECRET_YEARS}" \
	--query password \
	-o tsv)"

ADMIN_CONSENT_STATUS="not_requested"
ADMIN_CONSENT_MESSAGE="Admin consent was not attempted because GRANT_ADMIN_CONSENT is not true."

if [[ "${GRANT_ADMIN_CONSENT}" == "true" ]]; then
	if ADMIN_CONSENT_OUTPUT="$(az ad app permission admin-consent --id "${APP_ID}" --only-show-errors 2>&1)"; then
		ADMIN_CONSENT_STATUS="granted"
		ADMIN_CONSENT_MESSAGE="${ADMIN_CONSENT_OUTPUT:-Admin consent command completed.}"
	else
		ADMIN_CONSENT_STATUS="failed"
		ADMIN_CONSENT_MESSAGE="${ADMIN_CONSENT_OUTPUT}"
	fi
fi

ADMIN_CONSENT_URL="https://login.microsoftonline.com/${TENANT_ID}/adminconsent?client_id=${APP_ID}"
PORTAL_URL="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/${APP_ID}"
PERMISSIONS_JSON="$(printf '[{"name":"Sites.Read.All","type":"Application","id":"%s"},{"name":"Files.Read.All","type":"Application","id":"%s"}]' "${SITES_READ_ALL_ROLE_ID}" "${FILES_READ_ALL_ROLE_ID}")"

OUTPUT_JSON="$(APP_NAME="${APP_NAME}" \
	TENANT_ID="${TENANT_ID}" \
	SUBSCRIPTION_ID="${SUBSCRIPTION_ID}" \
	SIGNED_IN_USER="${SIGNED_IN_USER}" \
	APP_ID="${APP_ID}" \
	APP_OBJECT_ID="${APP_OBJECT_ID}" \
	SERVICE_PRINCIPAL_OBJECT_ID="${SERVICE_PRINCIPAL_OBJECT_ID}" \
	CLIENT_SECRET="${CLIENT_SECRET}" \
	SECRET_DISPLAY_NAME="${SECRET_DISPLAY_NAME}" \
	SECRET_YEARS="${SECRET_YEARS}" \
	GRAPH_BASE_URL="${GRAPH_BASE_URL}" \
	REQUEST_TIMEOUT_MS="${REQUEST_TIMEOUT_MS}" \
	SHAREPOINT_HOSTNAME="${SHAREPOINT_HOSTNAME}" \
	SHAREPOINT_SITE_PATH="${SHAREPOINT_SITE_PATH}" \
	SHAREPOINT_FOLDER_PATH="${SHAREPOINT_FOLDER_PATH}" \
	SHAREPOINT_RECURSIVE="${SHAREPOINT_RECURSIVE}" \
	SHAREPOINT_MAX_FILES="${SHAREPOINT_MAX_FILES}" \
	SHAREPOINT_MAX_CHUNK_CHARACTERS="${SHAREPOINT_MAX_CHUNK_CHARACTERS}" \
	SHAREPOINT_TAGS_JSON="${SHAREPOINT_TAGS_JSON}" \
	ADMIN_CONSENT_STATUS="${ADMIN_CONSENT_STATUS}" \
	ADMIN_CONSENT_MESSAGE="${ADMIN_CONSENT_MESSAGE}" \
	ADMIN_CONSENT_URL="${ADMIN_CONSENT_URL}" \
	PORTAL_URL="${PORTAL_URL}" \
	PERMISSIONS_JSON="${PERMISSIONS_JSON}" \
	python3 - <<'PY'
import json
import os
from datetime import datetime, timezone

permissions = json.loads(os.environ["PERMISSIONS_JSON"])
sharepoint_tags = json.loads(os.environ["SHAREPOINT_TAGS_JSON"])
sharepoint_recursive = os.environ["SHAREPOINT_RECURSIVE"].lower() == "true"

payload = {
	"createdAtUtc": datetime.now(timezone.utc).isoformat(),
	"azure": {
		"tenantId": os.environ["TENANT_ID"],
		"subscriptionId": os.environ["SUBSCRIPTION_ID"],
		"signedInUser": os.environ["SIGNED_IN_USER"],
	},
	"appRegistration": {
		"displayName": os.environ["APP_NAME"],
		"clientId": os.environ["APP_ID"],
		"appObjectId": os.environ["APP_OBJECT_ID"],
		"servicePrincipalObjectId": os.environ["SERVICE_PRINCIPAL_OBJECT_ID"],
		"portalUrl": os.environ["PORTAL_URL"],
	},
	"cognigyConnection": {
		"connectionType": "sharepoint-client-credentials",
		"tenantId": os.environ["TENANT_ID"],
		"clientId": os.environ["APP_ID"],
		"clientSecret": os.environ["CLIENT_SECRET"],
		"graphBaseUrl": os.environ["GRAPH_BASE_URL"],
		"requestTimeoutMs": os.environ["REQUEST_TIMEOUT_MS"],
	},
	"cognigyKnowledgeConnectorFields": {
		"hostname": os.environ["SHAREPOINT_HOSTNAME"],
		"sitePath": os.environ["SHAREPOINT_SITE_PATH"],
		"folderPath": os.environ["SHAREPOINT_FOLDER_PATH"],
		"recursive": sharepoint_recursive,
		"maxFiles": int(os.environ["SHAREPOINT_MAX_FILES"]),
		"maxChunkCharacters": int(os.environ["SHAREPOINT_MAX_CHUNK_CHARACTERS"]),
		"tags": sharepoint_tags,
	},
	"microsoftGraphApplicationPermissions": permissions,
	"adminConsent": {
		"status": os.environ["ADMIN_CONSENT_STATUS"],
		"message": os.environ["ADMIN_CONSENT_MESSAGE"],
		"manualConsentUrl": os.environ["ADMIN_CONSENT_URL"],
	},
	"secret": {
		"displayName": os.environ.get("SECRET_DISPLAY_NAME", "Cognigy SharePoint Client Secret"),
		"validForYears": int(os.environ["SECRET_YEARS"]),
		"warning": "The clientSecret is shown only once. Store it in the Cognigy connection now.",
	},
	"nextSteps": [
		"Create a Cognigy connection of type SharePoint Client Credentials using cognigyConnection.",
		"If adminConsent.status is failed, open adminConsent.manualConsentUrl as a Global Administrator and grant consent.",
		"Configure the SharePoint Knowledge Connector fields with your SharePoint hostname, sitePath, and folderPath.",
	],
}

print(json.dumps(payload, indent=2))
PY
)"

printf "%s\n" "${OUTPUT_JSON}"

if [[ -n "${OUTPUT_FILE}" ]]; then
	printf "%s\n" "${OUTPUT_JSON}" > "${OUTPUT_FILE}"
	echo "Wrote output to ${OUTPUT_FILE}" >&2
fi
