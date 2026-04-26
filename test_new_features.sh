#!/bin/bash

# Configuration
BASE_URL="http://localhost:8085"
HOSPITAL_A="HOSP-A"
HOSPITAL_B="HOSP-B"

echo "=========================================================="
echo " PE@FHIR - Feature Test Script"
echo "=========================================================="
echo "Testing Backend Endpoints for Phase 3 Features"
echo ""

# 1. Test Patient Registration with Extended Fields
echo "1. Testing Patient Registration (Extended Fields)..."
PATIENT_USERNAME="test_patient_$(date +%s)"
REGISTER_PAYLOAD=$(cat <<EOF
{
  "username": "$PATIENT_USERNAME",
  "password": "password123",
  "role": "PATIENT",
  "patientId": "ABHA-${RANDOM}",
  "fullName": "Test Patient",
  "email": "test@example.com",
  "phone": "1234567890",
  "gender": "Male",
  "dateOfBirth": "1990-01-01",
  "bloodGroup": "O+"
}
EOF
)

REG_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "$REGISTER_PAYLOAD")

echo "Response:"
echo $REG_RESPONSE | grep -q "User registered successfully"
if [ $? -eq 0 ]; then
    echo "✅ Patient registration successful."
else
    echo "❌ Patient registration failed: $REG_RESPONSE"
fi
echo "----------------------------------------------------------"

# 2. Test Doctor Registration for Hospital A
echo "2. Testing Doctor Registration (Hospital A)..."
DOCTOR_A="dr_test_a_$(date +%s)"
DOC_A_PAYLOAD=$(cat <<EOF
{
  "username": "$DOCTOR_A",
  "password": "password123",
  "role": "DOCTOR",
  "hospitalId": "$HOSPITAL_A",
  "fullName": "Dr. Test A",
  "specialization": "Cardiologist"
}
EOF
)

curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "$DOC_A_PAYLOAD" > /dev/null
echo "✅ Doctor A registered."
echo "----------------------------------------------------------"

# 3. Test Doctor Registration for Hospital B
echo "3. Testing Doctor Registration (Hospital B)..."
DOCTOR_B="dr_test_b_$(date +%s)"
DOC_B_PAYLOAD=$(cat <<EOF
{
  "username": "$DOCTOR_B",
  "password": "password123",
  "role": "DOCTOR",
  "hospitalId": "$HOSPITAL_B",
  "fullName": "Dr. Test B",
  "specialization": "Neurologist"
}
EOF
)

curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "$DOC_B_PAYLOAD" > /dev/null
echo "✅ Doctor B registered."
echo "----------------------------------------------------------"

# 4. Test GET /auth/doctors Endpoint for Hospital A
echo "4. Testing GET /auth/doctors for $HOSPITAL_A..."
DOCS_A=$(curl -s "$BASE_URL/auth/doctors?hospitalId=$HOSPITAL_A")
echo "Response:"
echo $DOCS_A
echo $DOCS_A | grep -q "$DOCTOR_A"
if [ $? -eq 0 ]; then
    echo "✅ Found $DOCTOR_A in $HOSPITAL_A doctors list."
else
    echo "❌ Failed to find $DOCTOR_A in $HOSPITAL_A."
fi
echo "----------------------------------------------------------"

# 5. Test GET /auth/doctors Endpoint for Hospital B
echo "5. Testing GET /auth/doctors for $HOSPITAL_B..."
DOCS_B=$(curl -s "$BASE_URL/auth/doctors?hospitalId=$HOSPITAL_B")
echo "Response:"
echo $DOCS_B
echo $DOCS_B | grep -q "$DOCTOR_B"
if [ $? -eq 0 ]; then
    echo "✅ Found $DOCTOR_B in $HOSPITAL_B doctors list."
else
    echo "❌ Failed to find $DOCTOR_B in $HOSPITAL_B."
fi
echo "=========================================================="
echo "Backend endpoint tests complete."
echo "To test the frontend, please refer to the UI Manual Test Guide."
