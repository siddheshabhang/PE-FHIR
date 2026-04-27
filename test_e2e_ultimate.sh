#!/usr/bin/env bash

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${BASE_URL:-http://localhost:8085}"

RUN_BUILD_CHECKS="${RUN_BUILD_CHECKS:-1}"
CHECK_FRONTENDS_LIVE="${CHECK_FRONTENDS_LIVE:-auto}"

ADMIN_USERNAME="${ADMIN_USERNAME:-admin1}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-adminpassword}"

DOCTOR_A_USERNAME="${DOCTOR_A_USERNAME:-dr_sharma}"
DOCTOR_A_PASSWORD="${DOCTOR_A_PASSWORD:-doctorpassword}"
DOCTOR_B_USERNAME="${DOCTOR_B_USERNAME:-dr_gupta}"
DOCTOR_B_PASSWORD="${DOCTOR_B_PASSWORD:-doctorpassword}"

FRONTEND_MAIN_URL="${FRONTEND_MAIN_URL:-http://localhost:5173}"
FRONTEND_HOSPITAL_A_URL="${FRONTEND_HOSPITAL_A_URL:-http://localhost:5174}"
FRONTEND_HOSPITAL_B_URL="${FRONTEND_HOSPITAL_B_URL:-http://localhost:5175}"

RUN_ID="$(date +%Y%m%d%H%M%S)"
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
STEP_COUNT=0

declare -a FAILURES=()
declare -a WARNINGS=()
declare -a TEMP_FILES=()

HTTP_BODY=""
HTTP_STATUS=""
HTTP_ERROR=""
LOGIN_ACCESS=""
LOGIN_REFRESH=""
LOGIN_ROLE=""

make_temp() {
  local file
  file="$(mktemp "/tmp/pe_fhir_test_${RUN_ID}_XXXXXX")"
  TEMP_FILES+=("$file")
  printf '%s\n' "$file"
}

cleanup() {
  local file
  for file in "${TEMP_FILES[@]}"; do
    [[ -f "$file" ]] && rm -f "$file"
  done
}
trap cleanup EXIT

step() {
  STEP_COUNT=$((STEP_COUNT + 1))
  printf '\n[%02d] %s\n' "$STEP_COUNT" "$1"
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '  [PASS] %s\n' "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILURES+=("$1")
  printf '  [FAIL] %s\n' "$1"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  WARNINGS+=("$1")
  printf '  [WARN] %s\n' "$1"
}

info() {
  printf '  [INFO] %s\n' "$1"
}

need_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    pass "Required command available: $1"
  else
    fail "Missing required command: $1"
  fi
}

run_command_check() {
  local label="$1"
  shift

  local output_file
  output_file="$(make_temp)"

  if "$@" >"$output_file" 2>&1; then
    pass "$label"
  else
    fail "$label"
    sed 's/^/    /' "$output_file"
  fi
}

json_get() {
  local json="$1"
  local path="$2"

  JSON_INPUT="$json" JSON_PATH="$path" node -e '
    const input = process.env.JSON_INPUT;
    const path = process.env.JSON_PATH;
    const data = JSON.parse(input);
    const parts = path.split(".").filter(Boolean);
    let value = data;
    for (const part of parts) {
      if (value === null || value === undefined) process.exit(2);
      if (/^\d+$/.test(part)) value = value[Number(part)];
      else value = value[part];
    }
    if (value === undefined || value === null) process.exit(3);
    if (typeof value === "object") console.log(JSON.stringify(value));
    else console.log(String(value));
  ' 2>/dev/null
}

json_contains() {
  local json="$1"
  local key="$2"
  local expected="$3"

  JSON_INPUT="$json" JSON_KEY="$key" JSON_EXPECTED="$expected" node -e '
    const data = JSON.parse(process.env.JSON_INPUT);
    const key = process.env.JSON_KEY;
    const expected = process.env.JSON_EXPECTED;

    const found = Array.isArray(data) && data.some((item) => {
      if (!item || typeof item !== "object") return false;
      const value = item[key];
      return String(value) === expected;
    });

    process.exit(found ? 0 : 1);
  ' >/dev/null 2>&1
}

http_request() {
  local method="$1"
  local url="$2"
  local token="${3:-}"
  local data="${4:-}"
  local content_type="${5:-application/json}"

  local body_file stderr_file curl_exit
  body_file="$(make_temp)"
  stderr_file="$(make_temp)"

  local -a curl_cmd=(
    curl
    -sS
    -X "$method"
    "$url"
    -o "$body_file"
    -w "%{http_code}"
    -H "Accept: application/json"
  )

  if [[ -n "$token" ]]; then
    curl_cmd+=(-H "Authorization: Bearer $token")
  fi

  if [[ -n "$data" ]]; then
    curl_cmd+=(-H "Content-Type: $content_type" --data "$data")
  fi

  HTTP_STATUS="$("${curl_cmd[@]}" 2>"$stderr_file")"
  curl_exit=$?
  HTTP_BODY="$(cat "$body_file")"
  HTTP_ERROR="$(cat "$stderr_file")"

  if [[ $curl_exit -ne 0 ]]; then
    HTTP_STATUS="000"
    return $curl_exit
  fi

  return 0
}

assert_status() {
  local expected="$1"
  local label="$2"

  if [[ "$HTTP_STATUS" == "$expected" ]]; then
    pass "$label (HTTP $HTTP_STATUS)"
    return 0
  fi

  fail "$label (expected HTTP $expected, got $HTTP_STATUS)"
  if [[ -n "$HTTP_ERROR" ]]; then
    printf '    curl: %s\n' "$HTTP_ERROR"
  fi
  if [[ -n "$HTTP_BODY" ]]; then
    printf '    body: %s\n' "$HTTP_BODY"
  fi
  return 1
}

assert_body_contains() {
  local needle="$1"
  local label="$2"

  if grep -Fq "$needle" <<<"$HTTP_BODY"; then
    pass "$label"
  else
    fail "$label"
    if [[ -n "$HTTP_BODY" ]]; then
      printf '    body: %s\n' "$HTTP_BODY"
    fi
  fi
}

assert_nonempty() {
  local value="$1"
  local label="$2"

  if [[ -n "$value" ]]; then
    pass "$label"
  else
    fail "$label"
  fi
}

login_and_capture() {
  local username="$1"
  local password="$2"
  local label="$3"

  local payload
  payload=$(cat <<EOF
{"username":"$username","password":"$password"}
EOF
)

  http_request POST "$BASE_URL/auth/login" "" "$payload"
  assert_status "200" "$label login"

  LOGIN_ACCESS="$(json_get "$HTTP_BODY" "accessToken" 2>/dev/null || true)"
  LOGIN_REFRESH="$(json_get "$HTTP_BODY" "refreshToken" 2>/dev/null || true)"
  LOGIN_ROLE="$(json_get "$HTTP_BODY" "role" 2>/dev/null || true)"
}

smoke_frontend() {
  local label="$1"
  local url="$2"
  local probe="${3:-/login}"

  if ! http_request GET "${url}${probe}"; then
    warn "$label is not reachable at ${url}${probe}"
    return 0
  fi

  if [[ "$HTTP_STATUS" != "200" && "$HTTP_STATUS" != "304" ]]; then
    warn "$label responded with HTTP $HTTP_STATUS at ${url}${probe}"
    return 0
  fi

  if grep -Eq '<div id="root"|<!doctype html>' <<<"$HTTP_BODY"; then
    pass "$label live smoke check"
  else
    warn "$label responded, but HTML shell markers were not found"
  fi
}

printf '============================================================\n'
printf ' PE@FHIR Ultimate End-to-End Test Script\n'
printf '============================================================\n'
printf 'Run ID: %s\n' "$RUN_ID"
printf 'Base URL: %s\n' "$BASE_URL"
printf 'Workspace: %s\n' "$ROOT_DIR"
printf '============================================================\n'

step "Preflight checks"
need_cmd curl
need_cmd node
need_cmd npm
need_cmd mvn

step "Project build and test checks"
if [[ "$RUN_BUILD_CHECKS" == "1" ]]; then
  run_command_check "Backend Maven tests" mvn -q -f "$ROOT_DIR/backend/pom.xml" test
  run_command_check "Frontend build: main app" npm --prefix "$ROOT_DIR/frontend" run build
  run_command_check "Frontend build: hospital A" npm --prefix "$ROOT_DIR/frontend-hospital-a" run build
  run_command_check "Frontend build: hospital B" npm --prefix "$ROOT_DIR/frontend-hospital-b" run build
else
  warn "Skipping build checks because RUN_BUILD_CHECKS=$RUN_BUILD_CHECKS"
fi

step "Public backend smoke checks"
if http_request GET "$BASE_URL/hospitals"; then
  assert_status "200" "Public hospitals endpoint"
  assert_body_contains "HOSP-A" "Hospital A present in hospital registry"
  assert_body_contains "HOSP-B" "Hospital B present in hospital registry"
else
  fail "Backend is not reachable at $BASE_URL"
fi

if http_request GET "$BASE_URL/auth/doctors?hospitalId=HOSP-A"; then
  assert_status "200" "Public doctors endpoint for Hospital A"
  assert_body_contains "dr_sharma" "Seeded Hospital A doctor listed"
else
  fail "Could not query doctors for Hospital A"
fi

if http_request GET "$BASE_URL/auth/doctors?hospitalId=HOSP-B"; then
  assert_status "200" "Public doctors endpoint for Hospital B"
  assert_body_contains "dr_gupta" "Seeded Hospital B doctor listed"
else
  fail "Could not query doctors for Hospital B"
fi

step "Authenticate seeded users"
login_and_capture "$ADMIN_USERNAME" "$ADMIN_PASSWORD" "Admin"
ADMIN_ACCESS="$LOGIN_ACCESS"
ADMIN_REFRESH="$LOGIN_REFRESH"
ADMIN_ROLE="$LOGIN_ROLE"

login_and_capture "$DOCTOR_A_USERNAME" "$DOCTOR_A_PASSWORD" "Doctor A"
DOCTOR_A_ACCESS="$LOGIN_ACCESS"
DOCTOR_A_REFRESH="$LOGIN_REFRESH"
DOCTOR_A_ROLE="$LOGIN_ROLE"

login_and_capture "$DOCTOR_B_USERNAME" "$DOCTOR_B_PASSWORD" "Doctor B"
DOCTOR_B_ACCESS="$LOGIN_ACCESS"
DOCTOR_B_REFRESH="$LOGIN_REFRESH"
DOCTOR_B_ROLE="$LOGIN_ROLE"

assert_nonempty "$ADMIN_ACCESS" "Admin access token captured"
assert_nonempty "$DOCTOR_A_ACCESS" "Doctor A access token captured"
assert_nonempty "$DOCTOR_B_ACCESS" "Doctor B access token captured"

if [[ "$ADMIN_ROLE" == "ADMIN" ]]; then pass "Admin role is ADMIN"; else fail "Admin role is not ADMIN"; fi
if [[ "$DOCTOR_A_ROLE" == "DOCTOR" ]]; then pass "Doctor A role is DOCTOR"; else fail "Doctor A role is not DOCTOR"; fi
if [[ "$DOCTOR_B_ROLE" == "DOCTOR" ]]; then pass "Doctor B role is DOCTOR"; else fail "Doctor B role is not DOCTOR"; fi

step "Refresh token flow"
if [[ -n "$ADMIN_REFRESH" ]]; then
  REFRESH_PAYLOAD=$(cat <<EOF
{"refreshToken":"$ADMIN_REFRESH"}
EOF
)
  http_request POST "$BASE_URL/auth/refresh" "" "$REFRESH_PAYLOAD"
  assert_status "200" "Admin refresh token endpoint"
  REFRESHED_ACCESS="$(json_get "$HTTP_BODY" "accessToken" 2>/dev/null || true)"
  assert_nonempty "$REFRESHED_ACCESS" "Refreshed admin access token captured"
else
  fail "Admin refresh token missing, cannot test refresh endpoint"
fi

step "Admin-only API coverage"
http_request GET "$BASE_URL/admin/users" "$ADMIN_ACCESS"
assert_status "200" "Admin users endpoint"
assert_body_contains "\"username\":\"$ADMIN_USERNAME\"" "Admin user list contains seeded admin"

http_request GET "$BASE_URL/admin/system-health" "$ADMIN_ACCESS"
assert_status "200" "Admin system health endpoint"

http_request GET "$BASE_URL/admin/transfers" "$ADMIN_ACCESS"
assert_status "200" "Admin transfers endpoint"

http_request GET "$BASE_URL/admin/audit-logs" "$ADMIN_ACCESS"
assert_status "200" "Admin audit logs endpoint"

step "Create temporary doctor via admin API"
TEMP_DOCTOR_USERNAME="qa_doc_b_${RUN_ID}"
TEMP_DOCTOR_PASSWORD="Doctor123!"
TEMP_DOCTOR_PAYLOAD=$(cat <<EOF
{"username":"$TEMP_DOCTOR_USERNAME","password":"$TEMP_DOCTOR_PASSWORD","role":"DOCTOR","hospitalId":"HOSP-B","fullName":"QA Doctor B $RUN_ID","specialization":"Integration Testing"}
EOF
)
http_request POST "$BASE_URL/admin/users" "$ADMIN_ACCESS" "$TEMP_DOCTOR_PAYLOAD"
assert_status "200" "Admin can create disposable doctor"
TEMP_DOCTOR_ID="$(json_get "$HTTP_BODY" "id" 2>/dev/null || true)"
assert_nonempty "$TEMP_DOCTOR_ID" "Disposable doctor ID captured"
assert_body_contains "\"username\":\"$TEMP_DOCTOR_USERNAME\"" "Disposable doctor created with expected username"

if http_request GET "$BASE_URL/auth/doctors?hospitalId=HOSP-B"; then
  assert_status "200" "Hospital B doctors list after admin-created doctor"
  assert_body_contains "$TEMP_DOCTOR_USERNAME" "Disposable doctor visible in public Hospital B doctor list"
fi

step "Login disposable doctor"
login_and_capture "$TEMP_DOCTOR_USERNAME" "$TEMP_DOCTOR_PASSWORD" "Disposable Doctor B"
TEMP_DOCTOR_ACCESS="$LOGIN_ACCESS"
TEMP_DOCTOR_REFRESH="$LOGIN_REFRESH"
TEMP_DOCTOR_ROLE="$LOGIN_ROLE"
assert_nonempty "$TEMP_DOCTOR_ACCESS" "Disposable doctor access token captured"
if [[ "$TEMP_DOCTOR_ROLE" == "DOCTOR" ]]; then pass "Disposable doctor role is DOCTOR"; else fail "Disposable doctor role is not DOCTOR"; fi

step "Public patient self-registration"
PATIENT_USERNAME="qa_patient_${RUN_ID}"
PATIENT_PASSWORD="Patient123!"
PATIENT_FULL_NAME="QA Patient ${RUN_ID}"
PATIENT_EMAIL="${PATIENT_USERNAME}@example.com"
PATIENT_PHONE="90000${RUN_ID: -5}"
PATIENT_REGISTER_PAYLOAD=$(cat <<EOF
{"username":"$PATIENT_USERNAME","password":"$PATIENT_PASSWORD","fullName":"$PATIENT_FULL_NAME","email":"$PATIENT_EMAIL","phone":"$PATIENT_PHONE","gender":"Female","dateOfBirth":"1994-01-15","bloodGroup":"O+"}
EOF
)
http_request POST "$BASE_URL/auth/register/patient" "" "$PATIENT_REGISTER_PAYLOAD"
assert_status "200" "Public patient registration endpoint"
PATIENT_ABHA_ID="$(json_get "$HTTP_BODY" "abhaId" 2>/dev/null || true)"
assert_nonempty "$PATIENT_ABHA_ID" "Generated ABHA ID captured for patient"
assert_body_contains "\"username\":\"$PATIENT_USERNAME\"" "Patient registration echoes username"

step "Patient authentication and empty-state checks"
login_and_capture "$PATIENT_USERNAME" "$PATIENT_PASSWORD" "Patient"
PATIENT_ACCESS="$LOGIN_ACCESS"
PATIENT_REFRESH="$LOGIN_REFRESH"
PATIENT_ROLE="$LOGIN_ROLE"
assert_nonempty "$PATIENT_ACCESS" "Patient access token captured"
if [[ "$PATIENT_ROLE" == "PATIENT" ]]; then pass "Patient role is PATIENT"; else fail "Patient role is not PATIENT"; fi

http_request GET "$BASE_URL/consent/pending/$PATIENT_ABHA_ID" "$PATIENT_ACCESS"
assert_status "200" "Patient can view pending consents"

step "Identity registration for HIE"
IDENTITY_PAYLOAD=$(cat <<EOF
{"hospitalAId":"$PATIENT_ABHA_ID","hospitalBId":"","name":"$PATIENT_FULL_NAME"}
EOF
)
http_request POST "$BASE_URL/identity/register" "$ADMIN_ACCESS" "$IDENTITY_PAYLOAD"
assert_status "201" "Admin can register patient in identity service"
assert_body_contains "$PATIENT_FULL_NAME" "Identity service stores patient name"

step "Doctor A links patient and records consult in Hospital A"
http_request GET "$BASE_URL/auth/register/patient/$PATIENT_ABHA_ID" "$DOCTOR_A_ACCESS"
assert_status "200" "Doctor A can fetch patient by ABHA ID"
assert_body_contains "$PATIENT_FULL_NAME" "Doctor A lookup returns patient details"

http_request POST "$BASE_URL/doctor/patients/link/$PATIENT_ABHA_ID" "$DOCTOR_A_ACCESS"
assert_status "200" "Doctor A can link existing patient by ABHA ID"
HOSPITAL_A_LOCAL_ID="$(json_get "$HTTP_BODY" "localPatientId" 2>/dev/null || true)"
assert_nonempty "$HOSPITAL_A_LOCAL_ID" "Hospital A local patient ID captured"

HOSPITAL_A_CONSULT_PAYLOAD=$(cat <<EOF
{"patientId":"$HOSPITAL_A_LOCAL_ID","abhaId":"$PATIENT_ABHA_ID","patientFirstName":"QA","patientLastName":"Patient","doctorName":"Dr. Rahul Sharma","visitDate":"2026-04-27","symptoms":"Fever, headache, dehydration","temperature":101.2,"bloodPressure":"118/79","prescriptionPdfBase64":""}
EOF
)
http_request POST "$BASE_URL/hospitalA/op-consult" "$DOCTOR_A_ACCESS" "$HOSPITAL_A_CONSULT_PAYLOAD"
assert_status "200" "Doctor A can submit OP consult to Hospital A"
assert_body_contains "Hospital A database" "Hospital A consult submission returns success message"

http_request GET "$BASE_URL/hospitalA/op-consult" "$DOCTOR_A_ACCESS"
assert_status "200" "Doctor A can list Hospital A consults"
assert_body_contains "$PATIENT_ABHA_ID" "Hospital A consult list contains the patient"

step "Patient clinical timeline before transfer"
http_request GET "$BASE_URL/patient/consultations/$PATIENT_ABHA_ID" "$PATIENT_ACCESS"
assert_status "200" "Patient can view consultation timeline"
assert_body_contains "City General Hospital" "Patient timeline includes Hospital A entry"

step "Patient-initiated push from Hospital A to Hospital B"
PATIENT_PUSH_PAYLOAD=$(cat <<EOF
{"targetRequesterId":"$TEMP_DOCTOR_USERNAME","dataTypes":["OP_CONSULT","PRESCRIPTION"]}
EOF
)
http_request POST "$BASE_URL/hospitalA/op-consult/push" "$PATIENT_ACCESS" "$PATIENT_PUSH_PAYLOAD"
assert_status "200" "Patient can initiate a Hospital A push flow"
assert_body_contains "\"resourceType\": \"Bundle\"" "Push flow returns a FHIR bundle"
PATIENT_PUSH_BUNDLE="$HTTP_BODY"

http_request POST "$BASE_URL/hospitalB/op-consult" "$TEMP_DOCTOR_ACCESS" "$PATIENT_PUSH_BUNDLE" "text/plain"
assert_status "200" "Hospital B can ingest pushed FHIR bundle"
assert_body_contains "$PATIENT_ABHA_ID" "Hospital B mapped bundle retains patient ABHA ID"

http_request GET "$BASE_URL/hospitalB/op-consult" "$TEMP_DOCTOR_ACCESS"
assert_status "200" "Doctor can list Hospital B consults"
assert_body_contains "$PATIENT_ABHA_ID" "Hospital B consult list contains the transferred patient"

step "Patient audit trail after push"
http_request GET "$BASE_URL/patient/audit/$PATIENT_ABHA_ID" "$PATIENT_ACCESS"
assert_status "200" "Patient can view transfer audit log"
assert_body_contains "SUCCESS" "Audit trail records a successful transfer"

step "Explicit consent-driven HIE exchange"
HIE_CONSENT_PAYLOAD=$(cat <<EOF
{"patientId":"$PATIENT_ABHA_ID","hip":"HospitalA","hiu":"HospitalB","scope":["OP_CONSULT"],"purpose":"Need historical consult for cross-hospital review"}
EOF
)
http_request POST "$BASE_URL/hie/consent-only" "$DOCTOR_B_ACCESS" "$HIE_CONSENT_PAYLOAD"
assert_status "200" "Doctor B can initiate HIE consent request"
assert_body_contains "CONSENT_PENDING" "HIE consent-only flow returns pending status"
HIE_REQUEST_ID="$(json_get "$HTTP_BODY" "consentRequestId" 2>/dev/null || true)"
assert_nonempty "$HIE_REQUEST_ID" "HIE consent request ID captured"

http_request GET "$BASE_URL/consent/pending/$PATIENT_ABHA_ID" "$PATIENT_ACCESS"
assert_status "200" "Patient can see newly created HIE consent request"
assert_body_contains "\"id\":$HIE_REQUEST_ID" "Pending consent list contains HIE request"

HIE_GRANT_PAYLOAD=$(cat <<EOF
{"decision":"GRANTED","grantedDataTypes":["OP_CONSULT"]}
EOF
)
http_request POST "$BASE_URL/consent/respond/$HIE_REQUEST_ID" "$PATIENT_ACCESS" "$HIE_GRANT_PAYLOAD"
assert_status "200" "Patient can grant HIE consent request"
assert_body_contains "GRANTED" "Consent response persisted as GRANTED"

http_request GET "$BASE_URL/hie/exchange/status/$HIE_REQUEST_ID" "$DOCTOR_B_ACCESS"
assert_status "200" "Doctor B can poll HIE exchange status"
assert_body_contains "SUCCESS" "HIE status polling returns SUCCESS after approval"
assert_body_contains "\"resourceType\": \"Bundle\"" "HIE status response includes FHIR bundle"
HIE_PULL_BUNDLE="$(json_get "$HTTP_BODY" "fhirBundle" 2>/dev/null || true)"
assert_nonempty "$HIE_PULL_BUNDLE" "FHIR bundle captured from HIE exchange"

http_request POST "$BASE_URL/hospitalB/op-consult" "$DOCTOR_B_ACCESS" "$HIE_PULL_BUNDLE" "text/plain"
assert_status "200" "Doctor B can ingest HIE-pulled bundle into Hospital B"

step "Consent revocation and post-revocation HIE pull check"
http_request POST "$BASE_URL/consent/revoke/$HIE_REQUEST_ID" "$PATIENT_ACCESS"
assert_status "200" "Patient can revoke granted consent"
assert_body_contains "REVOKED" "Consent revoke endpoint returns revoked message"

HIE_PULL_ONLY_PAYLOAD=$(cat <<EOF
{"patientId":"$PATIENT_ABHA_ID","hip":"HospitalA","hiu":"HospitalB","scope":["OP_CONSULT"]}
EOF
)
http_request POST "$BASE_URL/hie/pull-only" "$DOCTOR_B_ACCESS" "$HIE_PULL_ONLY_PAYLOAD"
assert_status "200" "Doctor B can call HIE pull-only endpoint"
assert_body_contains "NO_CONSENT" "HIE pull-only is blocked after revocation"

step "Patient consultation timeline after transfer"
http_request GET "$BASE_URL/patient/consultations/$PATIENT_ABHA_ID" "$PATIENT_ACCESS"
assert_status "200" "Patient timeline still accessible after transfers"
assert_body_contains "Metro Medical Center" "Patient timeline includes Hospital B entry"

step "Clean up disposable doctor"
if [[ -n "${TEMP_DOCTOR_ID:-}" ]]; then
  http_request DELETE "$BASE_URL/admin/users/$TEMP_DOCTOR_ID" "$ADMIN_ACCESS"
  assert_status "200" "Admin can delete disposable doctor"

  if http_request GET "$BASE_URL/auth/doctors?hospitalId=HOSP-B"; then
    assert_status "200" "Hospital B doctors list after cleanup"
    if json_contains "$HTTP_BODY" "username" "$TEMP_DOCTOR_USERNAME"; then
      fail "Disposable doctor still present after deletion"
    else
      pass "Disposable doctor removed from Hospital B doctor list"
    fi
  fi
else
  warn "Skipping disposable doctor cleanup because no temporary doctor ID was captured"
fi

step "Optional live frontend smoke checks"
if [[ "$CHECK_FRONTENDS_LIVE" == "1" || "$CHECK_FRONTENDS_LIVE" == "true" || "$CHECK_FRONTENDS_LIVE" == "auto" ]]; then
  smoke_frontend "Main frontend" "$FRONTEND_MAIN_URL" "/login"
  smoke_frontend "Hospital A frontend" "$FRONTEND_HOSPITAL_A_URL" "/login"
  smoke_frontend "Hospital B frontend" "$FRONTEND_HOSPITAL_B_URL" "/login"
else
  warn "Skipping live frontend smoke checks because CHECK_FRONTENDS_LIVE=$CHECK_FRONTENDS_LIVE"
fi

printf '\n============================================================\n'
printf ' Test Summary\n'
printf '============================================================\n'
printf 'Passed : %d\n' "$PASS_COUNT"
printf 'Failed : %d\n' "$FAIL_COUNT"
printf 'Warnings: %d\n' "$WARN_COUNT"

if (( FAIL_COUNT > 0 )); then
  printf '\nFailures:\n'
  for item in "${FAILURES[@]}"; do
    printf ' - %s\n' "$item"
  done
fi

if (( WARN_COUNT > 0 )); then
  printf '\nWarnings:\n'
  for item in "${WARNINGS[@]}"; do
    printf ' - %s\n' "$item"
  done
fi

printf '\n'
if (( FAIL_COUNT > 0 )); then
  printf 'Result: FAIL\n'
  exit 1
fi

printf 'Result: PASS\n'
exit 0
