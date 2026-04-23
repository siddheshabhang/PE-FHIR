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

// ══════════════════════════════════════════════════════════════
const DoctorDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activePanel, setActivePanel] = useState('submit');

  // TC-05 Fix: Clear transient HIE/FHIR results when switching panels
  useEffect(() => {
    setHieFhirResult('');
    setHieStatus(null);
    setFhirResult(null);
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

  // ── Hospital B: Receive FHIR ──────────────────────────────────
  const [fhirInput, setFhirInput] = useState('');
  const [fhirLoading, setFhirLoading] = useState(false);
  const [fhirResult, setFhirResult] = useState(null);
  const [fhirError, setFhirError] = useState('');
  const [intakeRecords, setIntakeRecords] = useState([]);
  const [intakeLoading, setIntakeLoading] = useState(false);

  // TC-06: Fetch Hospital B Intake Records
  const fetchIntake = async () => {
    setIntakeLoading(true);
    try {
      const data = await doctorService.getHospitalBConsults();
      setIntakeRecords(data);
    } catch (e) {
      console.error('Failed to fetch intake:', e);
    } finally {
      setIntakeLoading(false);
    }
  };

  useEffect(() => {
    if (activePanel === 'receive') {
      fetchIntake();
    }
  }, [activePanel]);

  // ── Create Patient ──────────────────────────────────────────────
  const [createPatientForm, setCreatePatientForm] = useState({
    firstName: '', lastName: '', dateOfBirth: '', gender: 'Male', phone: '', email: ''
  });
  const [createPatientErrors, setCreatePatientErrors] = useState({});
  const [createPatientLoading, setCreatePatientLoading] = useState(false);
  const [createPatientResult, setCreatePatientResult] = useState(null);
  const [createPatientError, setCreatePatientError] = useState('');

  // ── HIE Exchange ──────────────────────────────────────────────
  const [hieForm, setHieForm] = useState({
    patientId: '', scope: ['OP_CONSULT'], purpose: ''
  });
  const [hieLoading, setHieLoading] = useState(false);
  const [hieStatus, setHieStatus] = useState(null);
  const [hiePolling, setHiePolling] = useState(false);
  const [hieFhirResult, setHieFhirResult] = useState('');
  const [hieError, setHieError] = useState('');

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
    setFhirLoading(true); setFhirError(''); setFhirResult(null);
    try {
      const result = await doctorService.receiveFhirAtHospitalB(fhirInput.trim());
      setFhirResult(result);
      fetchIntake(); // Refresh the list
    } catch (err) {
      setFhirError(err?.response?.data?.message || err.message || 'Failed to receive FHIR bundle.');
    } finally {
      setFhirLoading(false);
    }
  };

  const handleHieSubmit = async (e) => {
    e.preventDefault();
    if (!hieForm.patientId.trim()) return;
    setHieLoading(true);
    setHieError('');
    setHieStatus(null);
    setHieFhirResult('');
    try {
      const result = await hieService.requestExchange(
        hieForm.patientId, hieForm.scope, hieForm.purpose
      );
      setHieStatus(result);
      if (result.status === 'CONSENT_PENDING') {
        startPolling(result.consentRequestId);
      }
      if (result.status === 'SUCCESS') {
        setHieFhirResult(result.fhirBundle);
        // Auto-persist even if success is immediate (consent already exists)
        try {
          await doctorService.receiveFhirAtHospitalB(result.fhirBundle);
        } catch (persistErr) {
          console.error('Auto-persistence failed:', persistErr);
        }
      }
    } catch (err) {
      setHieError(err?.response?.data?.message || err.message || 'Exchange failed.');
    } finally {
      setHieLoading(false);
    }
  };

  const handleConsentOnly = async (e) => {
    e.preventDefault();
    if (!hieForm.patientId) return setHieError('Patient ID required.');
    setHieLoading(true);
    setHieError(null);
    try {
      const result = await hieService.initiateConsentOnly(hieForm.patientId, hieForm.scope, hieForm.purpose);
      setHieStatus(result);
      if (result.status === 'CONSENT_PENDING') {
        startPolling(result.consentRequestId);
      }
    } catch (err) {
      setHieError(err?.response?.data?.message || 'Consent request failed.');
    } finally {
      setHieLoading(false);
    }
  };

  const handlePullOnly = async (e) => {
    e.preventDefault();
    if (!hieForm.patientId) return setHieError('Patient ID required.');
    setHieLoading(true);
    setHieError(null);
    try {
      const result = await hieService.pullOnly(hieForm.patientId, hieForm.scope);
      if (result.status === 'SUCCESS') {
        setHieFhirResult(result.fhirBundle);
        try { await doctorService.receiveFhirAtHospitalB(result.fhirBundle); } catch (e) {}
      } else {
        setHieError(result.message || 'No active consent found.');
      }
    } catch (err) {
      setHieError(err?.response?.data?.message || 'Pull failed.');
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
          
          // Auto-persist to Hospital B internal DB
          try {
            await doctorService.receiveFhirAtHospitalB(result.fhirBundle);
          } catch (persistErr) {
            console.error('Auto-persistence failed:', persistErr);
          }
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
    { id: 'consent', label: 'Request Consent', icon: '🔒', subtitle: 'Initiate access request' },
    { id: 'receive', label: 'Receive Bundle', icon: '📥', subtitle: 'Hospital B intake' },
    { id: 'hie', label: 'Request via HIE', icon: '🔗', subtitle: 'Federated exchange' },
    { id: 'create_patient', label: 'Add Patient', icon: '🧑‍⚕️', subtitle: 'Register a new patient' },
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar items={SIDEBAR_ITEMS} />

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <h1 className="page-title">Doctor Dashboard</h1>
            <p className="page-subtitle">Submit patient records, manage consent, and receive FHIR bundles</p>
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
                        <FieldRow label="Patient ID" name="patientId" placeholder="e.g. P-1001" value={submitForm.patientId} onChange={handleSubmitChange} error={submitErrors.patientId} />
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

            {/* ── Hospital B: Receive FHIR ─────────────────────────── */}
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
                  <div className="panel-accent-bar panel-accent-bar--green" />
                  <div className="panel-icon panel-icon--green">🏨</div>
                  <div>
                    <div className="panel-title">Hospital B — Receive FHIR Bundle</div>
                    <div className="panel-subtitle">Parse and extract data from an inbound FHIR JSON bundle</div>
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
                          placeholder={'Paste FHIR JSON bundle here…\n\n{"resourceType": "Bundle", "type": "collection", ...}'}
                          value={fhirInput}
                          onChange={(e) => setFhirInput(e.target.value)}
                          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                        />
                      </div>
                      <button type="submit" className="btn-primary" disabled={fhirLoading || !fhirInput.trim()}>
                        {fhirLoading ? <><span className="btn-spinner" /> Parsing…</> : '📥 Parse FHIR Bundle'}
                      </button>
                    </div>
                  </form>

                  <AnimatePresence>
                    {fhirResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{ marginTop: '16px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <div className="panel-icon panel-icon--green" style={{ width: '28px', height: '28px', fontSize: '14px' }}>✅</div>
                          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: '700', fontSize: '14px', color: 'var(--c-success-text)' }}>
                            Parsed Successfully
                          </span>
                          {fhirResult.consentVerified && (
                            <span className="badge-success status-badge" style={{ marginLeft: 'auto' }}>
                              <span className="badge-dot" />Consent Verified
                            </span>
                          )}
                        </div>
                        <div className="detail-grid">
                          {[
                            ['UHID', fhirResult.uhid],
                            ['Patient Name', fhirResult.patientName],
                            ['Consult Date', fhirResult.consultDate],
                            ['Doctor', fhirResult.doctor],
                            ['Clinical Notes', fhirResult.clinicalNotes],
                            ['Blood Pressure', fhirResult.vitals?.bp],
                            ['Temperature', fhirResult.vitals?.temp],
                          ].map(([label, val]) => (
                            <div key={label} className="detail-row">
                              <span className="detail-label">{label}</span>
                              <span className="detail-value" style={{ fontFamily: val && label === 'UHID' ? "'JetBrains Mono', monospace" : 'inherit', fontSize: label === 'UHID' ? '12px' : '13px' }}>
                                {val || <span style={{ color: 'var(--c-text-disabled)' }}>N/A</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div style={{ marginTop: '24px', borderTop: '1px solid var(--c-divider)', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: '15px', fontWeight: '700' }}>📥 Inbound Records (Hospital B Intake)</h3>
                      <button className="btn-outline" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={fetchIntake} disabled={intakeLoading}>
                        {intakeLoading ? 'Refreshing...' : '🔄 Refresh List'}
                      </button>
                    </div>

                    {intakeRecords.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', background: 'var(--c-bg-alt)', borderRadius: 'var(--r-md)', fontSize: '13px', color: 'var(--c-text-muted)' }}>
                        No records received yet.
                      </div>
                    ) : (
                      <div className="detail-grid" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {intakeRecords.map((rec) => (
                          <div key={rec.id} style={{ padding: '10px', borderBottom: '1px solid var(--c-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: '600', fontSize: '13px' }}>{rec.patientName}</div>
                              <div style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>UHID: {rec.uhid} · {rec.consultDate}</div>
                            </div>
                            <StatusBadge status={rec.consentVerified ? 'GRANTED' : 'PENDING'} label={rec.consentVerified ? 'Verified' : 'Unverified'} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                        <label className="form-label">Patient ID</label>
                        <input
                          className="form-input"
                          placeholder="e.g. P-1001"
                          value={hieForm.patientId}
                          onChange={e => setHieForm({ ...hieForm, patientId: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Purpose</label>
                        <input
                          className="form-input"
                          placeholder="e.g. Follow-up consultation"
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
                          ✅ Data received from Hospital A
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
                          <div className="detail-row"><span className="detail-label">Patient ID:</span> <span className="detail-value">{createPatientResult.patientId}</span></div>
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
                    setCreatePatientLoading(true); setCreatePatientError(''); setCreatePatientResult(null);
                    try {
                      const res = await doctorService.createPatient(createPatientForm);
                      setCreatePatientResult(res);
                      setCreatePatientForm({ firstName: '', lastName: '', dateOfBirth: '', gender: 'Male', phone: '', email: '' });
                    } catch (err) {
                      setCreatePatientError(err?.response?.data?.message || err.message || 'Failed to create patient.');
                    } finally {
                      setCreatePatientLoading(false);
                    }
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                      <div className="form-row">
                        <FieldRow label="First Name" name="firstName" placeholder="First Name" value={createPatientForm.firstName} onChange={(e) => setCreatePatientForm(f => ({...f, firstName: e.target.value}))} />
                        <FieldRow label="Last Name" name="lastName" placeholder="Last Name" value={createPatientForm.lastName} onChange={(e) => setCreatePatientForm(f => ({...f, lastName: e.target.value}))} />
                      </div>
                      <div className="form-row">
                        <FieldRow label="Date of Birth" name="dateOfBirth" type="date" value={createPatientForm.dateOfBirth} onChange={(e) => setCreatePatientForm(f => ({...f, dateOfBirth: e.target.value}))} />
                        <div className="form-group">
                          <label className="form-label">Gender</label>
                          <select className="form-input" value={createPatientForm.gender} onChange={(e) => setCreatePatientForm(f => ({...f, gender: e.target.value}))}>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-row">
                        <FieldRow label="Phone" name="phone" placeholder="Phone Number" value={createPatientForm.phone} onChange={(e) => setCreatePatientForm(f => ({...f, phone: e.target.value}))} />
                        <FieldRow label="Email" name="email" type="email" placeholder="Email Address" value={createPatientForm.email} onChange={(e) => setCreatePatientForm(f => ({...f, email: e.target.value}))} />
                      </div>
                      
                      <button type="submit" className="btn-primary" disabled={createPatientLoading}>
                        {createPatientLoading ? '⏳ Registering…' : '✅ Add Patient'}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default DoctorDashboard;