#!/bin/bash
# Usage: bash scripts/sync-vercel-env.sh
# Reads VERCEL_TOKEN and VERCEL_PROJECT_ID from .env.local (or env), never hardcodes secrets.

# Load from .env.local if present
if [ -f "$(dirname "$0")/../.env.local" ]; then
  set -o allexport
  source "$(dirname "$0")/../.env.local"
  set +o allexport
fi

TOKEN="${VERCEL_TOKEN}"
PROJECT="${VERCEL_PROJECT_ID:-prj_egEq7UcravdLAt6cxtuWIYSEbjpy}"

if [ -z "$TOKEN" ]; then
  echo "Error: VERCEL_TOKEN not set. Add it to .env.local or export it." >&2
  exit 1
fi

patch_env() {
  local ID=$1
  local KEY=$2
  local VAL=$3
  local TYPE=$4
  BODY=$(python3 -c "import json; print(json.dumps({'value': '$VAL', 'type': '$TYPE', 'target': ['production','preview']}))")
  RESULT=$(curl -s -X PATCH "https://api.vercel.com/v10/projects/${PROJECT}/env/${ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$BODY")
  echo "${KEY}: $(echo $RESULT | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('key') or d.get('error','unknown'))")"
}

patch_env "lqLHTCBZ7cvu8v8X" "TELNYX_API_KEY"       "${TELNYX_API_KEY}" "encrypted"
patch_env "6Wpc6h17ZwXX6j6k" "TELNYX_PUBLIC_KEY"    "${TELNYX_PUBLIC_KEY}" "encrypted"
patch_env "lE49WMCeNumNC6cf" "TELNYX_CONNECTION_ID" "${TELNYX_CONNECTION_ID}" "plain"
patch_env "tr8HAzyDFJVv1vU4" "NEXT_PUBLIC_APP_URL"  "${NEXT_PUBLIC_APP_URL:-https://trykove.app}" "plain"

echo ""
echo "Triggering redeploy..."
# Get latest deployment ID and redeploy it
LATEST=$(curl -s "https://api.vercel.com/v6/deployments?projectId=${PROJECT}&limit=1&target=production" \
  -H "Authorization: Bearer ${TOKEN}")
DEPLOY_ID=$(echo $LATEST | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['deployments'][0]['uid'])" 2>/dev/null)
echo "Latest deployment: $DEPLOY_ID"
REDEPLOY=$(curl -s -X POST "https://api.vercel.com/v13/deployments?forceNew=1&withLatestCommit=1" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"kove\",\"deploymentId\":\"${DEPLOY_ID}\"}")
echo "Redeploy: $(echo $REDEPLOY | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('url') or d.get('error',{}).get('message','')[:120])" 2>/dev/null)"
