import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar.jsx';
import { doctorService } from '../services/doctorService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { hieService } from '../services/hieService.js';
import StatusBadge from '../components/StatusBadge.jsx';

const SIDEBAR_ITEMS = [
  { to: '/doctor/dashboard', label: 'Dashboard', icon: '📊', end: true },
];

const DATA_TYPES = ['OP_CONSULT', 'PRESCRIPTION', 'LAB_RESULT'];

// ── Small helpers ──────────────────────────────────────────────
const FieldRow = ({ label, name, type = 'text', placeholder, value, onChange, error, readOnly }) => (
  <div className="form-group">
    <label className="form-label">{label}</label>
    <input
      name={name} type={type}
      className={`form-input ${error ? 'input-error' : ''}`}
      placeholder={placeholder} value={value}
      onChange={onChange} readOnly={readOnly}
    />
    {error && <span className="field-error">{error}</span>}
  </div>
);

const TypeCheckbox = ({ type, checked, onChange }) => (
  <label className="consent-type-check">
    <input type="checkbox" checked={checked} onChange={onChange} />
    {type.replace(/_/g, ' ')}
  </label>
);

const PATIENT_DETAIL_FIELDS = [
  ['ABHA-ID', 'abhaId'],
  ['Username', 'username'],
  ['Name', 'fullName', 'name'],
  ['Email', 'email'],
  ['Phone', 'phone'],
  ['Date of Birth', 'dateOfBirth', 'dob'],
  ['Gender', 'gender'],
  ['Blood Group', 'bloodGroup'],
  ['Hospital Base', 'hospitalId'],
  ['Role', 'role'],
];

const patientDetailValue = (details, keys) => {
  const value = keys.map((key) => details?.[key]).find((item) => item !== undefined && item !== null && item !== '');
  return value || 'Not provided';
};

const PatientDetailsGrid = ({ details }) => (
  <div className="detail-grid">
    {PATIENT_DETAIL_FIELDS.map(([label, ...keys]) => (
      <div className="detail-row" key={label}>
        <span className="detail-label">{label}:</span>
        <span className="detail-value">{patientDetailValue(details, keys)}</span>
      </div>
    ))}
  </div>
);

const getApiErrorMessage = (err, fallback) => {
  const status = err?.response?.status;
  const data = err?.response?.data;
  const rawMessage =
    (typeof data === 'string' && data.trim()) ||
    data?.message ||
    data?.error ||
    err?.message ||
    fallback;

  return status ? `${rawMessage} (HTTP ${status})` : rawMessage;
};

const hasPdfAttachment = (record) => !!record?.prescriptionPdfBase64;

// ══════════════════════════════════════════════════════════════
const HospitalADashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activePanel, setActivePanel] = useState('submit');

  // TC-05 Fix: Clear transient HIE/FHIR results when switching panels
  useEffect(() => {
    setHieFhirResult('');
    setHieStatus(null);
    setFhirResult(null);
    setFhirError('');
    setSubmitResult('');
    setSubmitError('');
    setCreatePatientResult(null);
  }, [activePanel]);

  // ── Hospital A: Submit ────────────────────────────────────────
  const [submitForm, setSubmitForm] = useState({
    patientId: '', patientFirstName: '', patientLastName: '',
    doctorName: user?.username || '', visitDate: '',
    symptoms: '', temperature: '', bloodPressure: '',
  });
  const [submitPdf, setSubmitPdf] = useState(null);
  const [submitErrors, setSubmitErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState('');
  const [submitError, setSubmitError] = useState('');

  // ── Consent Initiation ────────────────────────────────────────
  const [consentForm, setConsentForm] = useState({
    patientId: '', purpose: '', requestedDataTypes: ['OP_CONSULT'],
  });
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentResult, setConsentResult] = useState(null);
  const [consentError, setConsentError] = useState('');

  const [hieForm, setHieForm] = useState({
    abhaId: '', scope: ['OP_CONSULT'], purpose: ''
  });
  const [hieLoading, setHieLoading] = useState(false);
  const [hieStatus, setHieStatus] = useState(null);
  const [hiePolling, setHiePolling] = useState(false);
  const [hieFhirResult, setHieFhirResult] = useState('');
  const [hieError, setHieError] = useState('');

  // ── Add Patient / ABHA Link ───────────────────────────────────
  const [fhirInput, setFhirInput] = useState('');
  const [fhirLoading, setFhirLoading] = useState(false);
  const [fhirResult, setFhirResult] = useState(null);
  const [fhirError, setFhirError] = useState('');
  const [abhaIdInput, setAbhaIdInput] = useState('');
  const [patientDetails, setPatientDetails] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [createPatientResult, setCreatePatientResult] = useState(null);
  const [createPatientError, setCreatePatientError] = useState('');

  // ── Handlers ─────────────────────────────────────────────────
  const validateSubmit = () => {
    const e = {};
    if (!submitForm.patientId.trim()) e.patientId = 'Required';
    if (!submitForm.patientFirstName.trim()) e.patientFirstName = 'Required';
    if (!submitForm.patientLastName.trim()) e.patientLastName = 'Required';
    if (!submitForm.visitDate) e.visitDate = 'Required';
    if (!submitForm.symptoms.trim()) e.symptoms = 'Required';
    if (!submitForm.temperature) e.temperature = 'Required';
    else if (isNaN(submitForm.temperature)) e.temperature = 'Must be a number';
    if (!submitForm.bloodPressure.trim()) e.bloodPressure = 'Required';
    return e;
  };

  const handleSubmitChange = (e) => {
    const { name, value } = e.target;
    setSubmitForm((f) => ({ ...f, [name]: value }));
    setSubmitErrors((p) => ({ ...p, [name]: '' }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSubmitPdf(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateSubmit();
    if (Object.keys(errs).length) { setSubmitErrors(errs); return; }
    setSubmitLoading(true);
    setSubmitError(''); setSubmitResult('');
    try {
      const msg = await doctorService.submitPatientData({
        ...submitForm,
        temperature: parseFloat(submitForm.temperature),
        prescriptionPdfBase64: submitPdf || '',
      });
      // TC-02 Fix: msg might be a JSON object (FHIR bundle) returned as string but parsed by Axios
      const displayMsg = (typeof msg === 'object') ? 'Record submitted and converted to FHIR successfully.' : (msg || 'Record submitted successfully.');
      setSubmitResult(displayMsg);
      setSubmitForm({ patientId: '', patientFirstName: '', patientLastName: '', doctorName: user?.username || '', visitDate: '', symptoms: '', temperature: '', bloodPressure: '' });
      setSubmitPdf(null);
    } catch (err) {
      setSubmitError(err?.response?.data?.message || err.message || 'Submission failed.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleConsentSubmit = async (e) => {
    e.preventDefault();
    if (!consentForm.patientId.trim() || !consentForm.purpose.trim()) {
      setConsentError('Patient ID and Purpose are required.');
      return;
    }
    setConsentLoading(true); setConsentError(''); setConsentResult(null);
    try {
      const result = await doctorService.initiateConsent(
        consentForm.patientId, consentForm.purpose, consentForm.requestedDataTypes,
      );
      setConsentResult(result);
      setConsentForm({ patientId: '', purpose: '', requestedDataTypes: ['OP_CONSULT'] });
    } catch (err) {
      setConsentError(err?.response?.data?.message || err.message || 'Failed to initiate consent.');
    } finally {
      setConsentLoading(false);
    }
  };

  const toggleConsentType = (type) =>
    setConsentForm((p) => ({
      ...p,
      requestedDataTypes: p.requestedDataTypes.includes(type)
        ? p.requestedDataTypes.filter((t) => t !== type)
        : [...p.requestedDataTypes, type],
    }));

  const handleFhirReceive = async (e) => {
    e.preventDefault();
    if (!fhirInput.trim()) return;
    setFhirLoading(true);
    setFhirError('');
    setFhirResult(null);
    try {
      const result = await doctorService.receiveFhirAtHospitalA(fhirInput.trim());
      setFhirResult(result);
    } catch (err) {
      setFhirError(getApiErrorMessage(err, 'Failed to receive FHIR bundle.'));
    } finally {
      setFhirLoading(false);
    }
  };

  const handleHieSubmit = async (e) => {
    e.preventDefault();
    if (!hieForm.abhaId.trim()) return;
    setHieLoading(true);
    setHieError('');
    setHieStatus(null);
    setHieFhirResult('');
    try {
      const result = await hieService.requestExchange(
        hieForm.abhaId, hieForm.scope, hieForm.purpose
      );
      setHieStatus(result);
      if (result.status === 'CONSENT_PENDING') {
        startPolling(result.consentRequestId);
      }
      if (result.status === 'SUCCESS') {
        setHieFhirResult(result.fhirBundle);
      }
    } catch (err) {
      setHieError(err?.response?.data?.message || err.message || 'Exchange failed.');
    } finally {
      setHieLoading(false);
    }
  };

  const handleConsentOnly = async (e) => {
    e.preventDefault();
    if (!hieForm.abhaId) return setHieError('ABHA-ID required.');
    setHieLoading(true);
    setHieError(null);
    try {
      const result = await hieService.initiateConsentOnly(hieForm.abhaId, hieForm.scope, hieForm.purpose);
      setHieStatus(result);
      if (result.status === 'CONSENT_PENDING') {
        startPolling(result.consentRequestId);
      }
    } catch (err) {
      setHieError(getApiErrorMessage(err, 'Consent request failed.'));
    } finally {
      setHieLoading(false);
    }
  };

  const handlePullOnly = async (e) => {
    e.preventDefault();
    if (!hieForm.abhaId) return setHieError('ABHA-ID required.');
    setHieLoading(true);
    setHieError(null);
    try {
      const result = await hieService.pullOnly(hieForm.abhaId, hieForm.scope);
      if (result.status === 'SUCCESS') {
        setHieFhirResult(result.fhirBundle);
      } else {
        setHieError(result.message || 'No active consent found.');
      }
    } catch (err) {
      setHieError(getApiErrorMessage(err, 'Pull failed.'));
    } finally {
      setHieLoading(false);
    }
  };

  const startPolling = (consentId) => {
    setHiePolling(true);
    const interval = setInterval(async () => {
      try {
        const result = await hieService.pollStatus(consentId);
        setHieStatus(result);
        if (result.status === 'SUCCESS') {
          setHieFhirResult(result.fhirBundle);
          setHiePolling(false);
          clearInterval(interval);
        }
        if (result.status === 'DENIED' || result.status === 'REVOKED') {
          setHiePolling(false);
          clearInterval(interval);
        }
      } catch (err) {
        setHiePolling(false);
        clearInterval(interval);
        const msg = err?.response?.data?.message || err?.message || 'Try clicking "Pull Data" manually.';
        setHieError(`Polling stopped: ${msg}`);
        console.error('Poll error:', err?.response?.data || err);
      }
    }, 3000);
  };

  const toggleHieScope = (type) =>
    setHieForm(p => ({
      ...p,
      scope: p.scope.includes(type)
        ? p.scope.filter(t => t !== type)
        : [...p.scope, type],
    }));

  const PANELS = [
    { id: 'submit', label: 'Submit Consult', icon: '📝', subtitle: 'Hospital A → FHIR' },
    { id: 'receive', label: 'Receive Bundle', icon: '📥', subtitle: 'Hospital A intake' },
    { id: 'hie', label: 'Request via HIE', icon: '🔗', subtitle: 'Federated exchange' },
    { id: 'create_patient', label: 'Add Patient', icon: '🧑‍⚕️', subtitle: 'Register a new patient' },
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar items={SIDEBAR_ITEMS} />

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <h1 className="page-title">City General Hospital</h1>
            <p className="page-subtitle">Hospital A · Doctor Dashboard</p>
          </div>
          <div className="topbar-actions">
            <span className="role-badge">👨‍⚕️ {user?.username}</span>
            <button className="btn-outline" onClick={() => { logout(); navigate('/login'); }}>Sign Out</button>
          </div>
        </header>

        <motion.div
          className="page-content"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* Panel Selector */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {PANELS.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePanel(p.id)}
                style={{
                  flex: 1, minWidth: '160px',
                  padding: '14px 18px',
                  borderRadius: 'var(--r-lg)',
                  border: `1.5px solid ${activePanel === p.id ? 'var(--c-primary)' : 'var(--c-border)'}`,
                  background: activePanel === p.id ? 'var(--c-primary-bg)' : 'white',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s ease',
                  boxShadow: activePanel === p.id ? 'var(--shadow-teal)' : 'var(--shadow-xs)',
                }}
              >
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>{p.icon}</div>
                <div style={{
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: '700', fontSize: '13.5px',
                  color: activePanel === p.id ? 'var(--c-primary-dark)' : 'var(--c-text-primary)',
                }}>
                  {p.label}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--c-text-muted)', marginTop: '2px' }}>
                  {p.subtitle}
                </div>
              </button>
            ))}
          </div>

          {/* ── Hospital A: Submit OP Consult ──────────────────────────── */}
          <AnimatePresence mode="wait">
            {activePanel === 'submit' && (
              <motion.div
                key="submit"
                className="card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="panel-header" style={{ borderBottom: '1px solid var(--c-divider)' }}>
                  <div className="panel-accent-bar panel-accent-bar--teal" />
                  <div className="panel-icon panel-icon--teal">🏥</div>
                  <div>
                    <div className="panel-title">Hospital A — Submit OP Consult</div>
                    <div className="panel-subtitle">Record and convert patient visit to FHIR R4 Bundle</div>
                  </div>
                </div>

                <div className="submit-form">
                  <AnimatePresence>
                    {submitResult && (
                      <motion.div className="alert-success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        ✅ {submitResult}
                      </motion.div>
                    )}
                    {submitError && (
                      <motion.div className="alert-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        ⚠️ {submitError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handleSubmit} noValidate>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                      <div className="form-row">
                        <FieldRow label="Patient ID / ABHA-ID" name="patientId" placeholder="e.g. P-1001 or ABHA-1234-5678-9012-34" value={submitForm.patientId} onChange={handleSubmitChange} error={submitErrors.patientId} />
                        <FieldRow label="Visit Date" name="visitDate" type="date" value={submitForm.visitDate} onChange={handleSubmitChange} error={submitErrors.visitDate} />
                      </div>
                      <div className="form-row">
                        <FieldRow label="First Name" name="patientFirstName" placeholder="Patient first name" value={submitForm.patientFirstName} onChange={handleSubmitChange} error={submitErrors.patientFirstName} />
                        <FieldRow label="Last Name" name="patientLastName" placeholder="Patient last name" value={submitForm.patientLastName} onChange={handleSubmitChange} error={submitErrors.patientLastName} />
                      </div>
                      <FieldRow label="Doctor Name" name="doctorName" placeholder="Dr. Name" value={submitForm.doctorName} onChange={handleSubmitChange} />

                      <div className="form-group">
                        <label className="form-label">Symptoms / Clinical Notes</label>
                        <textarea
                          name="symptoms"
                          className={`form-textarea ${submitErrors.symptoms ? 'input-error' : ''}`}
                          placeholder="Describe patient symptoms in detail..."
                          value={submitForm.symptoms} onChange={handleSubmitChange} rows={3}
                        />
                        {submitErrors.symptoms && <span className="field-error">{submitErrors.symptoms}</span>}
                      </div>

                      <div className="form-row">
                        <FieldRow label="Temperature (°C)" name="temperature" placeholder="e.g. 37.5" value={submitForm.temperature} onChange={handleSubmitChange} error={submitErrors.temperature} />
                        <FieldRow label="Blood Pressure" name="bloodPressure" placeholder="e.g. 120/80" value={submitForm.bloodPressure} onChange={handleSubmitChange} error={submitErrors.bloodPressure} />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Prescription PDF (Optional)</label>
                        <div className="file-upload-area">
                          <input type="file" id="pdf-upload" accept=".pdf" className="file-input" onChange={handleFileChange} />
                          <label htmlFor="pdf-upload" className="file-label">
                            <span className="file-icon">📎</span>
                            <span>{submitPdf ? '✅ PDF attached — ready to send' : 'Click to upload PDF prescription'}</span>
                          </label>
                        </div>
                      </div>

                      <button type="submit" className="btn-primary btn-full" disabled={submitLoading}>
                        {submitLoading ? <><span className="btn-spinner" /> Converting to FHIR…</> : '🚀 Submit & Convert to FHIR R4'}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}

            {activePanel === 'receive' && (
              <motion.div
                key="receive"
                className="card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="panel-header" style={{ borderBottom: '1px solid var(--c-divider)' }}>
                  <div className="panel-accent-bar panel-accent-bar--teal" />
                  <div className="panel-icon panel-icon--teal">📥</div>
                  <div>
                    <div className="panel-title">Hospital A - Receive FHIR Bundle</div>
                    <div className="panel-subtitle">Parse and store an inbound FHIR bundle from another hospital</div>
                  </div>
                </div>

                <div className="submit-form">
                  {fhirError && <div className="alert-error">⚠️ {fhirError}</div>}
                  <form onSubmit={handleFhirReceive}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                      <div className="form-group">
                        <label className="form-label">FHIR JSON Bundle</label>
                        <textarea
                          className="form-textarea"
                          rows={9}
                          placeholder="Paste FHIR JSON bundle here..."
                          value={fhirInput}
                          onChange={(e) => setFhirInput(e.target.value)}
                          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                        />
                      </div>
                      <button type="submit" className="btn-primary" disabled={fhirLoading || !fhirInput.trim()}>
                        {fhirLoading ? <><span className="btn-spinner" /> Parsing...</> : '📥 Parse FHIR Bundle'}
                      </button>
                    </div>
                  </form>

                  {fhirResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div className="panel-icon panel-icon--teal" style={{ width: '28px', height: '28px', fontSize: '14px' }}>✅</div>
                        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: '700', fontSize: '14px', color: 'var(--c-success-text)' }}>Parsed Successfully</span>
                      </div>
                      <div className="detail-grid">
                        {[
                          ['Patient ID', fhirResult.patientId],
                          ['ABHA-ID', fhirResult.abhaId],
                          ['Patient Name', [fhirResult.patientFirstName, fhirResult.patientLastName].filter(Boolean).join(' ')],
                          ['Visit Date', fhirResult.visitDate],
                          ['Doctor', fhirResult.doctorName],
                          ['Clinical Notes', fhirResult.symptoms],
                          ['Blood Pressure', fhirResult.bloodPressure],
                          ['Temperature', fhirResult.temperature],
                          ['Prescription PDF', hasPdfAttachment(fhirResult) ? 'Attached' : 'Not attached'],
                        ].map(([label, val]) => (
                          <div key={label} className="detail-row">
                            <span className="detail-label">{label}</span>
                            <span className="detail-value">{val || 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Consent Initiation ─────────────────────────────────── */}
            {activePanel === 'consent' && (
              <motion.div
                key="consent"
                className="card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="panel-header" style={{ borderBottom: '1px solid var(--c-divider)' }}>
                  <div className="panel-accent-bar panel-accent-bar--violet" />
                  <div className="panel-icon panel-icon--violet">🔒</div>
                  <div>
                    <div className="panel-title">Initiate Consent Request</div>
                    <div className="panel-subtitle">Request patient authorization to access their health records</div>
                  </div>
                </div>

                <div className="submit-form">
                  <AnimatePresence>
                    {consentResult && (
                      <motion.div className="alert-success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        ✅ Consent request sent — Status: <strong>{consentResult.status}</strong> · ID: #{consentResult.id}
                      </motion.div>
                    )}
                    {consentError && (
                      <motion.div className="alert-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        ⚠️ {consentError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handleConsentSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                      <div className="form-group">
                        <label className="form-label">Patient ID</label>
                        <input className="form-input" placeholder="e.g. P-1001"
                          value={consentForm.patientId}
                          onChange={(e) => setConsentForm({ ...consentForm, patientId: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Purpose of Request</label>
                        <input className="form-input" placeholder="e.g. Follow-up consultation, Emergency review"
                          value={consentForm.purpose}
                          onChange={(e) => setConsentForm({ ...consentForm, purpose: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Requested Data Types</label>
                        <div className="consent-types-row">
                          {DATA_TYPES.map((type) => (
                            <TypeCheckbox
                              key={type} type={type}
                              checked={consentForm.requestedDataTypes.includes(type)}
                              onChange={() => toggleConsentType(type)}
                            />
                          ))}
                        </div>
                      </div>
                      <button type="submit" className="btn-primary" disabled={consentLoading}>
                        {consentLoading ? '⏳ Sending request…' : '📨 Send Consent Request'}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}



            {activePanel === 'hie' && (
              <motion.div
                key="hie"
                className="card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="panel-header" style={{ borderBottom: '1px solid var(--c-divider)' }}>
                  <div className="panel-accent-bar panel-accent-bar--teal" />
                  <div className="panel-icon panel-icon--teal">🔗</div>
                  <div>
                    <div className="panel-title">Request Data via HIE Gateway</div>
                    <div className="panel-subtitle">
                      Federated pull — patient consent obtained before data moves
                    </div>
                  </div>
                </div>

                <div className="submit-form">
                  {hieError && <div className="alert-error">⚠️ {hieError}</div>}

                  {hieStatus && hieStatus.status === 'CONSENT_PENDING' && (
                    <div className="alert-info">
                      ⏳ Consent request #{hieStatus.consentRequestId} sent to patient.
                      {hiePolling ? ' Waiting for approval…' : ' Polling stopped.'}
                    </div>
                  )}

                  {hieStatus && hieStatus.status === 'DENIED' && (
                    <div className="alert-error">❌ Patient denied this consent request.</div>
                  )}

                  <form onSubmit={handleHieSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                      <div className="form-group">
                        <label className="form-label">Patient ABHA-ID</label>
                        <input
                          className="form-input"
                          placeholder="e.g. ABHA-1234-5678-9012-34"
                          value={hieForm.abhaId}
                          onChange={e => setHieForm({ ...hieForm, abhaId: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Purpose</label>
                        <input
                          className="form-input"
                          placeholder="e.g. Follow-up consultation across hospitals"
                          value={hieForm.purpose}
                          onChange={e => setHieForm({ ...hieForm, purpose: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Data scope requested</label>
                        <div className="consent-types-row">
                          {['OP_CONSULT', 'PRESCRIPTION', 'LAB_RESULT'].map(type => (
                            <label key={type} className="consent-type-check">
                              <input
                                type="checkbox"
                                checked={hieForm.scope.includes(type)}
                                onChange={() => toggleHieScope(type)}
                              />
                              {type.replace(/_/g, ' ')}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="form-group" style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ 
                            flex: 1, 
                            background: 'var(--c-accent)', 
                            borderColor: 'var(--c-accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                          onClick={handleConsentOnly}
                          disabled={hieLoading || hiePolling}
                        >
                          {hieLoading ? <span className="btn-spinner" /> : <><span style={{fontSize: '18px'}}>🔒</span> 1. Request Consent</>}
                        </button>

                        <button
                          type="button"
                          className="btn-primary"
                          style={{ 
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                          onClick={handlePullOnly}
                          disabled={hieLoading || hiePolling}
                        >
                          {hieLoading ? <span className="btn-spinner" /> : <><span style={{fontSize: '18px'}}>📥</span> 2. Pull Data</>}
                        </button>
                      </div>
                      
                      <div style={{ textAlign: 'center', opacity: 0.4, fontSize: '11px', margin: '8px 0', letterSpacing: '1px' }}>— OR —</div>

                      <button
                        type="submit"
                        className="btn-primary"
                        style={{ 
                          width: '100%', 
                          background: 'transparent', 
                          border: '1px dashed var(--c-primary)', 
                          color: 'var(--c-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                        disabled={hieLoading || hiePolling}
                      >
                        {hieLoading ? <span className="btn-spinner" /> : <><span style={{fontSize: '18px'}}>🔗</span> Auto Orchestrate (1 + 2)</>}
                      </button>
                    </div>
                  </form>

                  {hieFhirResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ marginTop: '16px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <span style={{
                          fontFamily: "'Syne', sans-serif", fontWeight: '700',
                          fontSize: '14px', color: 'var(--c-success-text)'
                        }}>
                          ✅ Data received from Hospital B
                        </span>
                      </div>
                      <div className="fhir-json-section">
                        <span className="fhir-json-label">FHIR Bundle</span>
                        <pre className="fhir-json">
                          {(() => {
                            try {
                              const parsed = typeof hieFhirResult === 'string' ? JSON.parse(hieFhirResult) : hieFhirResult;
                              return JSON.stringify(parsed, null, 2);
                            } catch (e) {
                              return hieFhirResult;
                            }
                          })()}
                        </pre>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Create Patient Panel ─────────────────────────────── */}
            {activePanel === 'create_patient' && (
              <motion.div
                key="create_patient"
                className="card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="panel-header" style={{ borderBottom: '1px solid var(--c-divider)' }}>
                  <div className="panel-accent-bar" style={{ background: 'var(--c-primary)' }} />
                  <div className="panel-icon" style={{ color: 'var(--c-primary)' }}>🧑‍⚕️</div>
                  <div>
                    <div className="panel-title">Register New Patient</div>
                    <div className="panel-subtitle">Create a patient record and generate login credentials</div>
                  </div>
                </div>

                <div className="submit-form">
                  <AnimatePresence>
                    {createPatientResult && (
                      <motion.div className="alert-success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div style={{ marginBottom: '8px' }}>✅ <strong>{createPatientResult.message}</strong></div>
                        <div className="detail-grid">
                          <div className="detail-row"><span className="detail-label">Patient ID:</span> <span className="detail-value">{createPatientResult.localPatientId || createPatientResult.patientId || createPatientResult.abhaId}</span></div>
                          <div className="detail-row"><span className="detail-label">Username:</span> <span className="detail-value" style={{fontFamily: 'monospace'}}>{createPatientResult.username}</span></div>
                          <div className="detail-row"><span className="detail-label">Password:</span> <span className="detail-value" style={{fontFamily: 'monospace'}}>{createPatientResult.tempPassword}</span></div>
                        </div>
                      </motion.div>
                    )}
                    {createPatientError && (
                      <motion.div className="alert-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        ⚠️ {createPatientError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!abhaIdInput) return;
                    setLinkLoading(true); setCreatePatientError(''); setCreatePatientResult(null); setPatientDetails(null);
                    try {
                      const res = await doctorService.getPatientByAbhaId(abhaIdInput);
                      setPatientDetails(res);
                    } catch (err) {
                      setCreatePatientError(err?.response?.data?.message || err.message || 'Failed to fetch patient details.');
                    } finally {
                      setLinkLoading(false);
                    }
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                      <div className="form-group">
                        <label className="form-label">Patient ABHA-ID</label>
                        <input
                          className="form-input"
                          placeholder="e.g. ABHA-1234-5678-9012-34"
                          value={abhaIdInput}
                          onChange={(e) => setAbhaIdInput(e.target.value)}
                        />
                      </div>
                      <button type="submit" className="btn-primary" disabled={linkLoading || !abhaIdInput}>
                        {linkLoading ? '⏳ Fetching…' : '🔍 Fetch Patient Details'}
                      </button>
                    </div>
                  </form>

                  <AnimatePresence>
                    {patientDetails && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{ marginTop: '16px', background: 'var(--c-bg-alt)', padding: '16px', borderRadius: 'var(--r-md)' }}
                      >
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Patient Details Found:</h4>
                        <PatientDetailsGrid details={patientDetails} />

                        <button
                          className="btn-primary"
                          style={{ marginTop: '16px', width: '100%' }}
                          onClick={async () => {
                            setLinkLoading(true); setCreatePatientError(''); setCreatePatientResult(null);
                            try {
                              const res = await doctorService.linkPatientByAbhaId(abhaIdInput);
                              setCreatePatientResult(res);
                              setPatientDetails(null);
                              setAbhaIdInput('');
                            } catch (err) {
                              setCreatePatientError(err?.response?.data?.message || err.message || 'Failed to link patient.');
                            } finally {
                              setLinkLoading(false);
                            }
                          }}
                          disabled={linkLoading}
                        >
                          {linkLoading ? '⏳ Linking...' : '✅ Register Patient at City General Hospital'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default HospitalADashboard;
