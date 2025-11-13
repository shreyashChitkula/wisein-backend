#!/bin/bash

# DigiLocker Verification - Automated Testing Script
# This script tests the complete flow from signup to verification

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
MOBILE="9876543210"
OTP="123456"
COUNTRY="India"

# Variables to store responses
USER_ID=""
ACCESS_TOKEN=""
REFRESH_TOKEN=""
VERIFICATION_ID=""

# Helper functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Step 1: Send OTP
step_send_otp() {
    print_header "STEP 1: Send OTP"
    
    print_info "Sending OTP to $MOBILE..."
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/auth/send-otp" \
        -H "Content-Type: application/json" \
        -d "{
            \"mobileNumber\": \"$MOBILE\",
            \"country\": \"$COUNTRY\"
        }")
    
    echo "Response: $RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "OTP sent successfully"
        print_info "Check backend console for OTP value (usually: $OTP)"
        return 0
    else
        print_error "Failed to send OTP"
        return 1
    fi
}

# Step 2: Verify OTP
step_verify_otp() {
    print_header "STEP 2: Verify OTP"
    
    print_info "Verifying OTP: $OTP..."
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/auth/verify-otp" \
        -H "Content-Type: application/json" \
        -d "{
            \"mobileNumber\": \"$MOBILE\",
            \"otp\": \"$OTP\",
            \"country\": \"$COUNTRY\"
        }")
    
    echo "Response: $RESPONSE"
    
    # Extract tokens
    USER_ID=$(echo "$RESPONSE" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)
    ACCESS_TOKEN=$(echo "$RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    REFRESH_TOKEN=$(echo "$RESPONSE" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$ACCESS_TOKEN" ]; then
        print_success "OTP verified successfully"
        print_info "User ID: $USER_ID"
        print_info "Access Token: ${ACCESS_TOKEN:0:20}..."
        return 0
    else
        print_error "Failed to verify OTP"
        print_info "Make sure you're using the correct OTP from backend console"
        return 1
    fi
}

# Step 3: Select Country (Optional)
step_select_country() {
    print_header "STEP 3: Select Country (Optional)"
    
    print_info "Setting country to: $COUNTRY..."
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/auth/select-country" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -d "{
            \"country\": \"$COUNTRY\"
        }")
    
    echo "Response: $RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Country selected"
        return 0
    else
        print_info "Country selection not critical, continuing..."
        return 0
    fi
}

# Step 4: Initiate DigiLocker
step_initiate_digilocker() {
    print_header "STEP 4: Initiate DigiLocker Verification"
    
    print_info "Initiating DigiLocker verification..."
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/digilocker/initiate" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -d "{
            \"mobileNumber\": \"$MOBILE\"
        }")
    
    echo "Response: $RESPONSE"
    
    # Extract verification ID
    VERIFICATION_ID=$(echo "$RESPONSE" | grep -o '"verificationId":"[^"]*"' | cut -d'"' -f4)
    CONSENT_URL=$(echo "$RESPONSE" | grep -o '"consentUrl":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$VERIFICATION_ID" ]; then
        print_success "DigiLocker verification initiated"
        print_info "Verification ID: $VERIFICATION_ID"
        print_info "Consent URL: $CONSENT_URL"
        print_info "⚠️  Next: Open the Consent URL in your browser to complete DigiLocker authentication"
        return 0
    else
        print_error "Failed to initiate DigiLocker verification"
        return 1
    fi
}

# Step 5: User Manual DigiLocker Authentication
step_manual_digilocker_auth() {
    print_header "STEP 5: Complete DigiLocker Authentication (Manual)"
    
    print_info "Opening browser (if possible)..."
    
    # Try to open in browser (macOS)
    if command -v open &> /dev/null; then
        open "$CONSENT_URL"
    # Try to open in browser (Linux)
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$CONSENT_URL"
    # Try to open in browser (Windows - in WSL)
    elif command -v powershell.exe &> /dev/null; then
        powershell.exe -Command "start \"$CONSENT_URL\""
    else
        print_info "Please open this URL in your browser: $CONSENT_URL"
    fi
    
    print_info "Complete these steps in the browser:"
    echo "  1. Login with your Aadhaar-linked mobile number"
    echo "  2. Approve the data sharing consent"
    echo "  3. Wait for redirect"
    
    read -p "Press ENTER after completing DigiLocker authentication in your browser..."
    
    print_success "DigiLocker authentication completed"
}

# Step 6: Process Callback
step_callback() {
    print_header "STEP 6: Process DigiLocker Callback"
    
    print_info "Processing callback for verification ID: $VERIFICATION_ID..."
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/digilocker/callback" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -d "{
            \"verificationId\": \"$VERIFICATION_ID\"
        }")
    
    echo "Response: $RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Callback processed successfully"
        return 0
    else
        print_error "Failed to process callback"
        return 1
    fi
}

# Step 7: Complete Verification
step_complete_verification() {
    print_header "STEP 7: Complete Verification with Data"
    
    print_info "Submitting user data for comparison..."
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/digilocker/complete" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -d "{
            \"verificationId\": \"$VERIFICATION_ID\",
            \"userProvidedData\": {
                \"nameAsPerAadhaar\": \"JOHN DOE\",
                \"dateOfBirth\": \"1990-05-15\",
                \"gender\": \"Male\",
                \"country\": \"India\",
                \"state\": \"Maharashtra\",
                \"district\": \"Mumbai\",
                \"pincode\": \"400001\",
                \"phoneNumber\": \"$MOBILE\",
                \"addressLine1\": \"123 Main Street\",
                \"addressLine2\": \"Apartment 4B\"
            }
        }")
    
    echo "Response: $RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        print_success "Verification completed successfully!"
        if echo "$RESPONSE" | grep -q '"verified":true'; then
            print_success "User is now verified! ✓"
        fi
        return 0
    else
        print_error "Verification failed"
        print_info "This could be due to data mismatch. Ensure user data matches their Aadhaar."
        return 1
    fi
}

# Step 8: Check User Status
step_check_user_status() {
    print_header "STEP 8: Check User Verification Status"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/digilocker/user-status" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    echo "Response: $RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"verified":true'; then
        print_success "User is verified!"
        return 0
    else
        print_info "User verification status: $(echo "$RESPONSE" | grep -o '"verified":[^,}]*')"
        return 0
    fi
}

# Step 9: Health Check
step_health_check() {
    print_header "STEP 9: Health Check"
    
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/digilocker/health")
    
    echo "Response: $RESPONSE"
    
    if echo "$RESPONSE" | grep -q '"status":"operational"'; then
        print_success "DigiLocker service is operational!"
        return 0
    else
        print_error "Service health check failed"
        return 1
    fi
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════╗"
    echo "║  DigiLocker Verification - Automated Test Script  ║"
    echo "║                 v1.0                              ║"
    echo "╚════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    print_info "Base URL: $BASE_URL"
    print_info "Mobile: $MOBILE"
    
    # Execute steps
    step_send_otp || exit 1
    sleep 1
    
    step_verify_otp || exit 1
    sleep 1
    
    step_select_country || exit 1
    sleep 1
    
    step_initiate_digilocker || exit 1
    sleep 1
    
    step_manual_digilocker_auth
    sleep 2
    
    step_callback || exit 1
    sleep 1
    
    step_complete_verification
    sleep 1
    
    step_check_user_status
    sleep 1
    
    step_health_check
    
    print_header "✓ All tests completed!"
    echo -e "${GREEN}Complete DigiLocker verification flow tested successfully!${NC}\n"
}

# Run main function
main "$@"
