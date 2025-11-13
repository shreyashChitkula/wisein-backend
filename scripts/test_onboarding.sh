#!/usr/bin/env bash
# Simple end-to-end onboarding test script (development only)
# Usage:
#   EMAIL=regtest@example.com USERNAME=regtest123 bash scripts/test_onboarding.sh

set -euo pipefail
BASE_URL=${BASE_URL:-http://localhost:3000}
EMAIL=${EMAIL:-regtest@example.com}
USERNAME=${USERNAME:-regtest123}

echo "Starting onboarding flow for $EMAIL (username: $USERNAME) against $BASE_URL"

# Helper: extract JSON field using python3
json_field() {
	python3 - <<PY
import sys, json
obj = json.load(sys.stdin)
keys = sys.argv[1].split('.')
val = obj
for k in keys:
		val = val.get(k) if isinstance(val, dict) else None
print(val if val is not None else '')
PY
}

# 1) Send OTP (registration)
echo "\n[1] POST /auth/send-otp"
send_resp=$(curl -s -X POST "$BASE_URL/auth/send-otp" -H "Content-Type: application/json" -d '{"email":"'"$EMAIL"'","username":"'"$USERNAME"'"}')
echo "Response: $send_resp"

# 2) Retrieve OTP from debug endpoint (dev only)
echo "\n[2] GET /auth/debug/otp?email=..."
dbg_resp=$(curl -s -G --data-urlencode "email=$EMAIL" "$BASE_URL/auth/debug/otp")
echo "Debug response: $dbg_resp"
OTP=$(printf '%s' "$dbg_resp" | python3 -c "import sys,json;print(json.load(sys.stdin).get('otp',''))")
if [ -z "$OTP" ]; then
	echo "Failed to retrieve OTP from debug endpoint; aborting"
	exit 1
fi
echo "Retrieved OTP: $OTP"

# 3) Verify OTP
echo "\n[3] POST /auth/verify-otp"
verify_resp=$(curl -s -X POST "$BASE_URL/auth/verify-otp" -H "Content-Type: application/json" -d '{"email":"'"$EMAIL"'","otp":"'"$OTP"'"}')
echo "Verify response: $verify_resp"

ACCESS_TOKEN=$(printf '%s' "$verify_resp" | python3 -c "import sys,json;print(json.load(sys.stdin).get('accessToken',''))")
REFRESH_TOKEN=$(printf '%s' "$verify_resp" | python3 -c "import sys,json;print(json.load(sys.stdin).get('refreshToken',''))")

if [ -z "$ACCESS_TOKEN" ]; then
	echo "No access token returned; aborting"
	exit 1
fi
echo "Access token obtained (truncated): ${ACCESS_TOKEN:0:40}..."

# 4) Select country (choose India to hit DigiLocker flow)
echo "\n[4] POST /auth/select-country (country=India)"
select_resp=$(curl -s -X POST "$BASE_URL/auth/select-country" -H "Content-Type: application/json" -H "Authorization: Bearer $ACCESS_TOKEN" -d '{"country":"India"}')
echo "Select country response: $select_resp"

# 5) Create Stripe Identity session (for non-India path) - we call it to exercise endpoint
echo "\n[5] POST /auth/stripe-identity/create-session"
session_resp=$(curl -s -X POST "$BASE_URL/auth/stripe-identity/create-session" -H "Authorization: Bearer $ACCESS_TOKEN")
echo "Stripe session response: $session_resp"

SESSION_ID=$(printf '%s' "$session_resp" | python3 -c "import sys,json;print(json.load(sys.stdin).get('verificationSessionId',''))")
if [ -n "$SESSION_ID" ]; then
	echo "\n[6] POST /auth/stripe-identity/verify with session id $SESSION_ID"
	verify_stripe_resp=$(curl -s -X POST "$BASE_URL/auth/stripe-identity/verify" -H "Content-Type: application/json" -H "Authorization: Bearer $ACCESS_TOKEN" -d '{"verificationSessionId":"'"$SESSION_ID"'"}')
	echo "Stripe verify response: $verify_stripe_resp"
fi

# 7) Get verification status
echo "\n[7] GET /auth/verification/status"
status_resp=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/auth/verification/status")
echo "Verification status: $status_resp"

echo "\nOnboarding test finished."