#!/usr/bin/env bash
# HTTPie quick-run test script for WiseIn backend
# Replace TOKEN, USER_ID, ORDER_ID, VERIFICATION_ID with actual values before running

API_URL=${API_URL:-http://localhost:3000}
TOKEN=${TOKEN:-"YOUR_JWT_TOKEN_HERE"}
USER_ID=${USER_ID:-"your_user_id_here"}
ORDER_ID=${ORDER_ID:-"order-id-here"}
VERIFICATION_ID=${VERIFICATION_ID:-"VER_1234567890"}

echo "Using API_URL=$API_URL"

echo "1) Health check"
http GET $API_URL/

echo "\n2) Create payment order (protected)"
http POST $API_URL/api/payment/order Authorization:"Bearer $TOKEN" amount:=9999 currency=="INR" phone=="9876543210" content-type:application/json

echo "\n3) Check payment status (public)"
http GET $API_URL/api/payment/status/$ORDER_ID

echo "\n4) Create subscription"
http POST $API_URL/api/payment/subscription Authorization:"Bearer $TOKEN" planId=="individual_monthly" phone=="9876543210" currency=="INR" content-type:application/json

echo "\n5) Check user subscription"
http GET $API_URL/api/payment/subscription/$USER_ID Authorization:"Bearer $TOKEN"

echo "\n6) Get payment history"
http GET $API_URL/api/payment/history/$USER_ID Authorization:"Bearer $TOKEN"

echo "\n7) DigiLocker: Initiate"
http POST $API_URL/digilocker/initiate Authorization:"Bearer $TOKEN" content-type:application/json userId==$USER_ID

echo "\n8) DigiLocker: Status"
http GET $API_URL/digilocker/status/$VERIFICATION_ID Authorization:"Bearer $TOKEN"

# Webhook test: POST raw JSON from file
# http POST $API_URL/api/payment/webhook < webhook-sample.json

echo "\nDone. Replace placeholders and run specific commands individually as needed."
