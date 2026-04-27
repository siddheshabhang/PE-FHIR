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

const DoctorDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activePanel, setActivePanel] = useState('submit');

  useEffect(() => {
    setHieFhirResult('');
    setHieStatus(null);
    setFhirResult(null);
    setCreatePatientResult(null);
    setSubmitResult('');
    setSubmitError('');
  }, [activePanel]);

  const [submitForm, setSubmitForm] = useState({
    patientId: '',
    patientName: '',
    consultDate: '',
    doctor: user?.username || '',
    clinicalNotes: '',
    temperature: '',
    bloodPressure: '',
  });
  const [submitPdf, setSubmitPdf] = useState(null);
  const [submitErrors, setSubmitErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState('');
  const [submitError, setSubmitError] = useState('');

  const [fhirInput, setFhirInput] = useState('');
  const [fhirLoading, setFhirLoading] = useState(false);
  const [fhirResult, setFhirResult] = useState(null);
  const [fhirError, setFhirError] = useState('');
  const [intakeRecords, setIntakeRecords] = useState([]);
  const [intakeLoading, setIntakeLoading] = useState(false);

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

  const [abhaIdInput, setAbhaIdInput] = useState('');
  const [patientDetails, setPatientDetails] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [createPatientResult, setCreatePatientResult] = useState(null);
  const [createPatientError, setCreatePatientError] = useState('');

  const [hieForm, setHieForm] = useState({
    abhaId: '', scope: ['OP_CONSULT'], purpose: ''
  });
  const [hieLoading, setHieLoading] = useState(false);
  const [hieStatus, setHieStatus] = useState(null);
  const [hiePolling, setHiePolling] = useState(false);
  const [hieFhirResult, setHieFhirResult] = useState('');
  const [hieError, setHieError] = useState('');

  const validateSubmit = () => {
    const errors = {};
    if (!submitForm.patientId.trim()) errors.patientId = 'Required';
    if (!submitForm.patientName.trim()) errors.patientName = 'Required';
    if (!submitForm.consultDate) errors.consultDate = 'Required';
    if (!submitForm.clinicalNotes.trim()) errors.clinicalNotes = 'Required';
    if (!submitForm.temperature.trim()) errors.temperature = 'Required';
    if (!submitForm.bloodPressure.trim()) errors.bloodPressure = 'Required';
    return errors;
  };

  const handleSubmitChange = (e) => {
    const { name, value } = e.target;
    setSubmitForm((prev) => ({ ...prev, [name]: value }));
    setSubmitErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSubmitPdf(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  };

  const handleNativeSubmit = async (e) => {
    e.preventDefault();
    const errors = validateSubmit();
    if (Object.keys(errors).length) {
      setSubmitErrors(errors);
      return;
    }
    setSubmitLoading(true);
    setSubmitError('');
    setSubmitResult('');
    try {
      const message = await doctorService.submitHospitalBConsult({
        ...submitForm,
        prescriptionPdfBase64: submitPdf || '',
      });
      setSubmitResult(message || 'Consult stored successfully.');
      setSubmitForm({
        patientId: '',
        patientName: '',
        consultDate: '',
        doctor: user?.username || '',
        clinicalNotes: '',
        temperature: '',
        bloodPressure: '',
      });
      setSubmitPdf(null);
      fetchIntake();
    } catch (err) {
      setSubmitError(err?.response?.data?.message || err.message || 'Failed to store consult.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleFhirReceive = async (e) => {
    e.preventDefault();
    if (!fhirInput.trim()) return;
    setFhirLoading(true); setFhirError('');
    try {
      const result = await doctorService.receiveFhirAtHospitalB(fhirInput.trim());
      setFhirResult(result);
      fetchIntake();
    } catch (err) {
      setFhirError(err?.response?.data?.message || err.message || 'Failed to receive FHIR bundle.');
    } finally {
      setFhirLoading(false);
    }
  };

  const handleHieSubmit = async (e) => {
    e.preventDefault();
    if (!hieForm.abhaId.trim()) return;
    setHieLoading(true); setHieError(''); setHieStatus(null); setHieFhirResult('');
    try {
      const result = await hieService.requestExchange(hieForm.abhaId, hieForm.scope, hieForm.purpose);
      setHieStatus(result);
      if (result.status === 'CONSENT_PENDING') startPolling(result.consentRequestId);
      if (result.status === 'SUCCESS') {
        setHieFhirResult(result.fhirBundle);
        try { await doctorService.receiveFhirAtHospitalB(result.fhirBundle); } catch (e) {}
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
    setHieLoading(true); setHieError(null);
    try {
      const result = await hieService.initiateConsentOnly(hieForm.abhaId, hieForm.scope, hieForm.purpose);
      setHieStatus(result);
      if (result.status === 'CONSENT_PENDING') startPolling(result.consentRequestId);
    } catch (err) {
      setHieError(err?.response?.data?.message || 'Consent request failed.');
    } finally {
      setHieLoading(false);
    }
  };

  const handlePullOnly = async (e) => {
    e.preventDefault();
    if (!hieForm.abhaId) return setHieError('ABHA-ID required.');
    setHieLoading(true); setHieError(null);
    try {
      const result = await hieService.pullOnly(hieForm.abhaId, hieForm.scope);
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
          try { await doctorService.receiveFhirAtHospitalB(result.fhirBundle); } catch (e) {}
        }
        if (result.status === 'DENIED' || result.status === 'REVOKED') {
          setHiePolling(false);
          clearInterval(interval);
        }
      } catch (err) {
        setHiePolling(false);
        clearInterval(interval);
        setHieError(`Polling stopped: ${err?.response?.data?.message || err.message}`);
      }
    }, 3000);
  };

  const toggleHieScope = (type) =>
    setHieForm(p => ({
      ...p,
      scope: p.scope.includes(type) ? p.scope.filter(t => t !== type) : [...p.scope, type],
    }));

  const PANELS = [
    { id: 'submit', label: 'Submit Consult', icon: '📝', subtitle: 'Hospital B native record' },
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
            <h1 className="page-title">Metro Medical Center</h1>
            <p className="page-subtitle">Hospital B · Doctor Dashboard</p>
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
                  boxShadow: activePanel === p.id ? 'var(--shadow-purple)' : 'var(--shadow-xs)',
                }}
              >
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>{p.icon}</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: '700', fontSize: '13.5px', color: activePanel === p.id ? 'var(--c-primary-dark)' : 'var(--c-text-primary)' }}>{p.label}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--c-text-muted)', marginTop: '2px' }}>{p.subtitle}</div>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activePanel === 'submit' && (
              <motion.div key="submit" className="card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div className="panel-header" style={{ borderBottom: '1px solid var(--c-divider)' }}>
                  <div className="panel-accent-bar panel-accent-bar--green" />
                  <div className="panel-icon panel-icon--green">📝</div>
                  <div>
                    <div className="panel-title">Hospital B — Submit OP Consult</div>
                    <div className="panel-subtitle">Create a local consult record that HIE can serve by ABHA-ID</div>
                  </div>
                </div>
                <div className="submit-form">
                  {submitResult && <div className="alert-success">✅ {submitResult}</div>}
                  {submitError && <div className="alert-error">⚠️ {submitError}</div>}
                  <form onSubmit={handleNativeSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                      <div className="form-row">
                        <FieldRow label="Patient ID / ABHA-ID" name="patientId" value={submitForm.patientId} onChange={handleSubmitChange} placeholder="e.g. HB-P-1234 or ABHA-1234-5678-9012-34" error={submitErrors.patientId} />
                        <FieldRow label="Consult Date" name="consultDate" type="date" value={submitForm.consultDate} onChange={handleSubmitChange} error={submitErrors.consultDate} />
                      </div>
                      <div className="form-row">
                        <FieldRow label="Patient Name" name="patientName" value={submitForm.patientName} onChange={handleSubmitChange} placeholder="Full patient name" error={submitErrors.patientName} />
                        <FieldRow label="Doctor" name="doctor" value={submitForm.doctor} onChange={handleSubmitChange} placeholder="Doctor name" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Clinical Notes</label>
                        <textarea name="clinicalNotes" className={`form-textarea ${submitErrors.clinicalNotes ? 'input-error' : ''}`} rows={4} value={submitForm.clinicalNotes} onChange={handleSubmitChange} placeholder="Consult summary, diagnosis, and treatment notes" />
                        {submitErrors.clinicalNotes && <span className="field-error">{submitErrors.clinicalNotes}</span>}
                      </div>
                      <div className="form-row">
                        <FieldRow label="Temperature" name="temperature" value={submitForm.temperature} onChange={handleSubmitChange} placeholder="e.g. 98.6" error={submitErrors.temperature} />
                        <FieldRow label="Blood Pressure" name="bloodPressure" value={submitForm.bloodPressure} onChange={handleSubmitChange} placeholder="e.g. 120/80" error={submitErrors.bloodPressure} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Prescription PDF (Optional)</label>
                        <div className="file-upload-area">
                          <input type="file" id="hospital-b-pdf-upload" accept=".pdf" className="file-input" onChange={handleFileChange} />
                          <label htmlFor="hospital-b-pdf-upload" className="file-label">
                            <span className="file-icon">📎</span>
                            <span>{submitPdf ? '✅ PDF attached — ready to store' : 'Click to upload PDF prescription'}</span>
                          </label>
                        </div>
                      </div>
                      <button type="submit" className="btn-primary" disabled={submitLoading}>
                        {submitLoading ? <><span className="btn-spinner" /> Saving…</> : '💾 Save Hospital B Consult'}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}

            {activePanel === 'receive' && (
              <motion.div key="receive" className="card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
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
                        <textarea className="form-textarea" rows={9} placeholder='Paste FHIR JSON bundle here…' value={fhirInput} onChange={(e) => setFhirInput(e.target.value)} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }} />
                      </div>
                      <button type="submit" className="btn-primary" disabled={fhirLoading || !fhirInput.trim()}>
                        {fhirLoading ? <><span className="btn-spinner" /> Parsing…</> : '📥 Parse FHIR Bundle'}
                      </button>
                    </div>
                  </form>
                  <AnimatePresence>
                    {fhirResult && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginTop: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <div className="panel-icon panel-icon--green" style={{ width: '28px', height: '28px', fontSize: '14px' }}>✅</div>
                          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: '700', fontSize: '14px', color: 'var(--c-success-text)' }}>Parsed Successfully</span>
                        </div>
                        <div className="detail-grid">
                          {[['UHID', fhirResult.uhid], ['Patient Name', fhirResult.patientName], ['Consult Date', fhirResult.consultDate], ['Doctor', fhirResult.doctor], ['Clinical Notes', fhirResult.clinicalNotes], ['Blood Pressure', fhirResult.vitals?.bp], ['Temperature', fhirResult.vitals?.temp]].map(([label, val]) => (
                            <div key={label} className="detail-row">
                              <span className="detail-label">{label}</span>
                              <span className="detail-value">{val || 'N/A'}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div style={{ marginTop: '24px', borderTop: '1px solid var(--c-divider)', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: '15px', fontWeight: '700' }}>📥 Inbound Records</h3>
                      <button className="btn-outline" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={fetchIntake} disabled={intakeLoading}>Refresh</button>
                    </div>
                    {intakeRecords.length === 0 ? <div className="alert-info">No records yet.</div> : (
                      <div className="detail-grid">
                        {intakeRecords.map(rec => (
                          <div key={rec.id} style={{ padding: '10px', borderBottom: '1px solid var(--c-divider)', display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ fontWeight: '600', fontSize: '13px' }}>{rec.patientName}</div>
                              <div style={{ fontSize: '11px' }}>{rec.uhid} · {rec.consultDate}</div>
                            </div>
                            <StatusBadge status={rec.consentVerified ? 'GRANTED' : 'PENDING'} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activePanel === 'hie' && (
              <motion.div key="hie" className="card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div className="panel-header" style={{ borderBottom: '1px solid var(--c-divider)' }}>
                  <div className="panel-accent-bar panel-accent-bar--teal" />
                  <div className="panel-icon panel-icon--teal">🔗</div>
                  <div>
                    <div className="panel-title">HIE Gateway</div>
                    <div className="panel-subtitle">Federated pull</div>
                  </div>
                </div>
                <div className="submit-form">
                  {hieError && <div className="alert-error">⚠️ {hieError}</div>}
                  <form onSubmit={handleHieSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                      <FieldRow label="Patient ABHA-ID" value={hieForm.abhaId} onChange={e => setHieForm({ ...hieForm, abhaId: e.target.value })} placeholder="e.g. ABHA-1234-5678-9012-34" />
                      <FieldRow label="Purpose" value={hieForm.purpose} onChange={e => setHieForm({ ...hieForm, purpose: e.target.value })} placeholder="e.g. Follow-up consultation across hospitals" />
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button type="button" className="btn-primary" onClick={handleConsentOnly} disabled={hieLoading}>Request Consent</button>
                        <button type="button" className="btn-primary" onClick={handlePullOnly} disabled={hieLoading}>Pull Data</button>
                      </div>
                      <button type="submit" className="btn-primary" disabled={hieLoading}>Auto Orchestrate</button>
                    </div>
                  </form>
                  {hieFhirResult && (
                    <div className="fhir-json-section" style={{ marginTop: '16px' }}>
                      <pre className="fhir-json">{hieFhirResult}</pre>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activePanel === 'create_patient' && (
              <motion.div key="create_patient" className="card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div className="panel-header">
                  <div className="panel-title">Add Patient</div>
                </div>
                <div className="submit-form">
                  {createPatientError && <div className="alert-error">{createPatientError}</div>}
                  {createPatientResult && <div className="alert-success">Linked: {createPatientResult.localPatientId || createPatientResult.patientId}</div>}
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setLinkLoading(true);
                    try { const res = await doctorService.getPatientByAbhaId(abhaIdInput); setPatientDetails(res); }
                    catch (err) { setCreatePatientError(err.message); }
                    finally { setLinkLoading(false); }
                  }}>
                    <input className="form-input" value={abhaIdInput} onChange={e => setAbhaIdInput(e.target.value)} placeholder="ABHA-ID" />
                    <button type="submit" className="btn-primary" disabled={linkLoading}>Fetch</button>
                  </form>
                  {patientDetails && (
                    <div style={{ marginTop: '16px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Patient Details Found:</h4>
                      <PatientDetailsGrid details={patientDetails} />
                      <button className="btn-primary" onClick={async () => {
                        setLinkLoading(true);
                        try { const res = await doctorService.linkPatientByAbhaId(abhaIdInput); setCreatePatientResult(res); setPatientDetails(null); }
                        catch (err) { setCreatePatientError(err.message); }
                        finally { setLinkLoading(false); }
                      }}>Link Patient</button>
                    </div>
                  )}
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
