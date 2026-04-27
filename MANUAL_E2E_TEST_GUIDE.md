# PE@FHIR Manual End-to-End Test Guide

This guide walks through the full product manually from login to cross-hospital exchange.

Use this when you want to verify the project end to end through the UI, with the backend doing the real work.

## 1. What You Need Running

Open 4 terminals from the repo root.

### Backend

```bash
cd /Users/siddheshabhang/Desktop/PE@FHIR/backend
mvn spring-boot:run
```

Expected backend URL:

- `http://localhost:8085`

Important:

- The backend expects PostgreSQL databases configured in [application.properties](/Users/siddheshabhang/Desktop/PE@FHIR/backend/src/main/resources/application.properties:1)
- On first clean run, the app seeds default hospitals, admin, doctors, and one sample patient

### Main frontend

```bash
cd /Users/siddheshabhang/Desktop/PE@FHIR/frontend
npm install
npm run dev
```

Open:

- `http://localhost:5173`

### Optional doctor-only frontends

These are not required for the full manual test, but useful if you want to inspect the hospital-specific UIs directly.

```bash
cd /Users/siddheshabhang/Desktop/PE@FHIR/frontend-hospital-a
npm install
npm run dev
```

- `http://localhost:5174`

```bash
cd /Users/siddheshabhang/Desktop/PE@FHIR/frontend-hospital-b
npm install
npm run dev
```

- `http://localhost:5175`

## 2. Default Seeded Accounts

Use these first:

- Admin
  - Username: `admin1`
  - Password: `adminpassword`
- Doctor at Hospital A
  - Username: `dr_sharma`
  - Password: `doctorpassword`
- Doctor at Hospital B
  - Username: `dr_gupta`
  - Password: `doctorpassword`
- Seeded patient
  - Username: `rahul_verma`
  - Password: `patientpassword`
  - ABHA-ID: `ABHA-2233-4455-6677-88`

## 3. Recommended Test Order

Follow this order so each later feature has the right data already in place.

1. Verify backend seed and login flows
2. Verify admin dashboard and protected routes
3. Create a brand-new patient from the public registration form
4. Link that patient into Hospital A
5. Create a Hospital A consult
6. Verify patient timeline
7. Test patient push flow from Hospital A to Hospital B
8. Test consent-driven HIE flow from Hospital B to Hospital A
9. Verify audit trail and revocation behavior

## 4. Full Manual Walkthrough

### Test A: Public Login and Role Routing

Open `http://localhost:5173/login`.

Check:

- Login page loads
- Role selector shows `Hospital Admin`, `Doctor / Clinician`, `Patient`
- No console-breaking error appears in browser

Now log in as each seeded user one by one.

Admin:

- Username `admin1`
- Password `adminpassword`

Expected:

- Redirect to `/admin/dashboard`
- Admin page loads without unauthorized error

Doctor A:

- Username `dr_sharma`
- Password `doctorpassword`

Expected:

- Redirect to `/doctor/dashboard`
- Header shows `City General Hospital`

Doctor B:

- Username `dr_gupta`
- Password `doctorpassword`

Expected:

- Redirect to `/doctor/dashboard`
- Header shows `Metro Medical Center`

Patient:

- Username `rahul_verma`
- Password `patientpassword`

Expected:

- Redirect to `/patient/dashboard`
- Patient dashboard shows ABHA-ID badge

### Test B: Admin Dashboard

Log in as `admin1`.

Verify:

- Stats cards render
- Transfers tab loads
- Audit Logs tab loads
- Users tab loads
- Sign out works

In `Users`, confirm these exist:

- `admin1`
- `dr_sharma`
- `dr_gupta`
- `rahul_verma`

Pass condition:

- Protected admin APIs are working and the UI is not empty due to auth failure

### Test C: Public Patient Registration

From `/login`, switch to register mode.

Create a new patient with unique values:

- Username: `patient_manual_01`
- Password: `patient123`
- Role: `PATIENT`
- Full name: `Manual Test Patient`
- Email: `patient_manual_01@example.com`
- Phone: `9876543210`
- Gender: `Female`
- Date of birth: `1995-01-15`
- Blood group: `O+`

Expected:

- Success message appears
- Success message includes generated ABHA-ID

Write down:

- New patient username
- New patient password
- New ABHA-ID from the success banner

You will use them in the next tests.

### Test D: New Patient Login

Log in with the new patient account.

Expected:

- Patient dashboard opens
- ABHA-ID shows in the header
- `My Consultations` is initially empty
- `Consent Requests` is initially empty
- `Activity Log` is initially empty or near empty

Pass condition:

- New patient login works and JWT carries ABHA-ID correctly

### Test E: Link Patient into Hospital A

Log out and sign in as Doctor A: `dr_sharma`

Open `Add Patient`.

In `Patient ABHA-ID`, paste the new patient ABHA-ID from Test C.

Click `Fetch Patient Details`.

Expected:

- Patient details card appears
- Name, email, phone, role, and ABHA-ID are visible

Then click:

- `Register Patient at City General Hospital`

Expected:

- Success message appears
- Local patient ID is generated

Write down:

- Hospital A local patient ID

Pass condition:

- Cross-registry lookup and hospital linking both work

### Test F: Submit a Hospital A Consult

Stay logged in as Doctor A.

Open `Submit Consult`.

Enter:

- Patient ID / ABHA-ID: the Hospital A local patient ID from Test E
- First Name: `Manual`
- Last Name: `Patient`
- Doctor Name: keep default or `dr_sharma`
- Visit Date: today
- Symptoms / Clinical Notes: `Fever, body pain, fatigue`
- Temperature: `38.2`
- Blood Pressure: `120/80`
- Optional PDF: attach one if you want to test prescription upload

Click:

- `Submit & Convert to FHIR R4`

Expected:

- Success banner appears
- No validation or server error appears

Pass condition:

- Hospital A consult storage and FHIR conversion are both working

### Test G: Patient Timeline After Hospital A Consult

Log out and sign in as the new patient.

Open `My Consultations`.

Expected:

- One consultation appears
- Hospital name shows `City General Hospital`
- Doctor name is visible
- Clinical notes and vitals are visible

Pass condition:

- Patient timeline aggregates Hospital A data correctly

### Test H: Patient Push Flow to Hospital B

You need a doctor target at Hospital B.

Use either:

- Seeded doctor `dr_gupta`

In the patient dashboard, open `Push Records`.

Choose:

- Target hospital: `HOSP-B`
- Target doctor: `dr_gupta`
- Data types: keep `OP_CONSULT`, optionally also `PRESCRIPTION`

Click submit.

Expected:

- Success message appears for push

Now log out and sign in as Doctor B: `dr_gupta`

Open `Receive Bundle`.

Look at `Inbound Records`.

Expected:

- A new inbound record appears for the patient
- Consent status badge is shown

Pass condition:

- Patient-initiated push transfers Hospital A data into Hospital B flow

### Test I: Hospital B Native Consult

Still as Doctor B, open `Submit Consult`.

Use the patient’s ABHA-ID directly in `Patient ID / ABHA-ID`.

Fill:

- Patient Name: `Manual Test Patient`
- Consult Date: today
- Doctor: `dr_gupta`
- Clinical Notes: `Second opinion completed at Hospital B`
- Temperature: `99.1`
- Blood Pressure: `118/78`

Click:

- `Save Hospital B Consult`

Expected:

- Success message appears

Then open `Receive Bundle` and check `Inbound Records`.

Expected:

- Record list updates or remains accessible without errors

Pass condition:

- Hospital B can store native consults that are later available for HIE

### Test J: Consent-Driven HIE Flow

This is the key cross-hospital end-to-end test.

Step 1:

- Stay logged in as Doctor B
- Open `Request via HIE`
- Enter the patient ABHA-ID
- Purpose: `Need prior consult from Hospital A`
- Keep scope as `OP_CONSULT`
- Click `Request Consent`

Expected:

- Message says consent request is pending
- Consent request ID appears

Step 2:

- Log out and sign in as the same patient
- Open `Consent Requests`

Expected:

- A request from `dr_gupta` appears
- Requested purpose is visible

Grant it:

- Keep `OP_CONSULT` selected
- Click grant

Expected:

- Request status changes to granted

Step 3:

- Log out and sign back in as Doctor B
- Open `Request via HIE`
- Use the same patient ABHA-ID
- Click `Pull Data`

Expected:

- FHIR bundle appears in the response area
- Data is received from Hospital A

Pass condition:

- Doctor request, patient consent, and post-consent pull all work end to end

### Test K: Auto Orchestrate Flow

Still in Doctor B HIE panel, try the one-click route with another patient that has Hospital A data, or reuse the seeded patient:

- ABHA-ID: `ABHA-2233-4455-6677-88`
- Click `Auto Orchestrate (1 + 2)`

Expected:

- If consent already exists, it may directly return data
- If no consent exists, it should create a pending request and start polling

Pass condition:

- Combined orchestration path works without manual API steps

### Test L: Consent Revocation

Log in as the patient whose consent was granted in Test J.

Open `Consent Requests`.

Find the granted consent.

Click revoke.

Expected:

- Status becomes `REVOKED`

Now log back in as Doctor B and try `Pull Data` again for the same patient.

Expected:

- Pull should fail or return a no-consent message

Pass condition:

- Revoked consent blocks future pull-only exchange

### Test M: Patient Activity Log

Log in as the patient and open `Activity Log`.

Expected entries should reflect actions such as:

- Push record transfer
- Consent grant
- Consent revoke
- Successful or pending exchange status

Pass condition:

- Audit trail is visible from patient side

## 5. Optional Regression Checks

These are worth checking before calling the app good.

- Try invalid login and verify friendly error
- Try doctor route with patient login and verify redirect protection
- Try admin route with doctor login and verify redirect protection
- Try submitting a consult with missing required fields and verify inline validation
- Try HIE pull before consent and verify a no-consent message
- Try registering the same username twice and verify backend rejection

## 6. Fast Pass/Fail Checklist

Mark each as pass or fail:

- Backend starts on `8085`
- Main frontend starts on `5173`
- Admin login works
- Doctor A login works
- Doctor B login works
- Patient registration works
- New patient login works
- Hospital A patient link works
- Hospital A consult submission works
- Patient consultation timeline updates
- Patient push to Hospital B works
- Hospital B native consult works
- Consent request appears for patient
- Patient grant works
- Doctor HIE pull works
- Consent revoke works
- Pull-after-revoke is blocked
- Patient activity log is visible

## 7. Best Manual Test Data Pattern

For repeated runs, use unique usernames each time:

- `patient_manual_02`
- `patient_manual_03`
- `patient_manual_04`

This avoids collisions with the auth table.

## 8. If Something Fails

Check these first:

- Backend terminal for 401, 403, 404, or DB connection errors
- Browser console for frontend runtime errors
- Network tab for failing API calls
- PostgreSQL databases are reachable on localhost
- Backend seed only runs when user table is empty, so a reused DB may already contain old test data

