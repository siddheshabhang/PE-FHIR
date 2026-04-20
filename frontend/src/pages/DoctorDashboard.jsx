import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../components/Sidebar.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { doctorService } from '../services/doctorService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const SIDEBAR_ITEMS = [
  { to: '/doctor/dashboard', label: 'Dashboard', icon: '📊', end: true },
];

const DATA_TYPES = ['OP_CONSULT', 'PRESCRIPTION', 'LAB_RESULT'];

const DoctorDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ── Hospital A: Submit OP Consult ─────────────────────────────────────────
  // Fields match HospitalAOPConsultRecordDTO exactly
  const [submitForm, setSubmitForm] = useState({
    patientId: '',
    patientFirstName: '',
    patientLastName: '',
    doctorName: user?.username || '',
    visitDate: '',
    symptoms: '',
    temperature: '',
    bloodPressure: '',
  });
  const [submitPdf, setSubmitPdf] = useState(null);
  const [submitErrors, setSubmitErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState('');
  const [submitError, setSubmitError] = useState('');

  // ── Consent Initiation ────────────────────────────────────────────────────
  const [consentForm, setConsentForm] = useState({
    patientId: '',
    purpose: '',
    requestedDataTypes: ['OP_CONSULT'],
  });
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentResult, setConsentResult] = useState(null);
  const [consentError, setConsentError] = useState('');

  // ── Hospital B: Receive FHIR ──────────────────────────────────────────────
  const [fhirInput, setFhirInput] = useState('');
  const [fhirLoading, setFhirLoading] = useState(false);
  const [fhirResult, setFhirResult] = useState(null);
  const [fhirError, setFhirError] = useState('');

  // ── Handlers ─────────────────────────────────────────────────────────────

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
    if (Object.keys(errs).length > 0) { setSubmitErrors(errs); return; }
    setSubmitLoading(true);
    setSubmitError('');
    setSubmitResult('');
    try {
      const msg = await doctorService.submitPatientData({
        ...submitForm,
        temperature: parseFloat(submitForm.temperature),
        prescriptionPdfBase64: submitPdf || '',
      });
      setSubmitResult(msg || 'Record submitted and converted to FHIR successfully!');
      setSubmitForm({ patientId: '', patientFirstName: '', patientLastName: '', doctorName: user?.username || '', visitDate: '', symptoms: '', temperature: '', bloodPressure: '' });
      setSubmitPdf(null);
    } catch (err) {
      setSubmitError(err?.response?.data?.message || err.message || 'Submission failed');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleConsentSubmit = async (e) => {
    e.preventDefault();
    if (!consentForm.patientId.trim() || !consentForm.purpose.trim()) {
      setConsentError('Patient ID and Purpose are required');
      return;
    }
    setConsentLoading(true);
    setConsentError('');
    setConsentResult(null);
    try {
      const result = await doctorService.initiateConsent(
        consentForm.patientId,
        consentForm.purpose,
        consentForm.requestedDataTypes,
      );
      setConsentResult(result);
      setConsentForm({ patientId: '', purpose: '', requestedDataTypes: ['OP_CONSULT'] });
    } catch (err) {
      setConsentError(err?.response?.data?.message || err.message || 'Failed to initiate consent');
    } finally {
      setConsentLoading(false);
    }
  };

  const toggleConsentType = (type) => {
    setConsentForm((prev) => {
      const types = prev.requestedDataTypes;
      const updated = types.includes(type) ? types.filter((t) => t !== type) : [...types, type];
      return { ...prev, requestedDataTypes: updated };
    });
  };

  const handleFhirReceive = async (e) => {
    e.preventDefault();
    if (!fhirInput.trim()) return;
    setFhirLoading(true);
    setFhirError('');
    setFhirResult(null);
    try {
      const result = await doctorService.receiveFhirAtHospitalB(fhirInput.trim());
      setFhirResult(result);
    } catch (err) {
      setFhirError(err?.response?.data?.message || err.message || 'Failed to receive FHIR bundle');
    } finally {
      setFhirLoading(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar items={SIDEBAR_ITEMS} />

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <h1 className="page-title">Doctor Dashboard</h1>
            <p className="page-subtitle">Submit patient records and manage consent requests</p>
          </div>
          <div className="topbar-actions">
            <span className="role-badge">👨‍⚕️ {user?.username}</span>
            <button className="btn-outline" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
          </div>
        </header>

        <motion.div
          className="page-content"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="doctor-panels">

            {/* ── Hospital A: Submit OP Consult ─────────────────────────── */}
            <div className="panel card">
              <div className="panel-header panel-header--a">
                <span className="panel-icon">🏥</span>
                <div>
                  <h2 className="panel-title">Hospital A — Submit OP Consult</h2>
                  <p className="panel-subtitle">Record and convert patient visit to FHIR R4</p>
                </div>
              </div>

              {submitResult && <div className="alert-success">✅ {submitResult}</div>}
              {submitError && <div className="alert-error">⚠️ {submitError}</div>}

              <form onSubmit={handleSubmit} className="submit-form" noValidate>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Patient ID</label>
                    <input name="patientId" className={`form-input ${submitErrors.patientId ? 'input-error' : ''}`} placeholder="e.g. P-1001" value={submitForm.patientId} onChange={handleSubmitChange} />
                    {submitErrors.patientId && <span className="field-error">{submitErrors.patientId}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Visit Date</label>
                    <input name="visitDate" type="date" className={`form-input ${submitErrors.visitDate ? 'input-error' : ''}`} value={submitForm.visitDate} onChange={handleSubmitChange} />
                    {submitErrors.visitDate && <span className="field-error">{submitErrors.visitDate}</span>}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input name="patientFirstName" className={`form-input ${submitErrors.patientFirstName ? 'input-error' : ''}`} placeholder="Patient first name" value={submitForm.patientFirstName} onChange={handleSubmitChange} />
                    {submitErrors.patientFirstName && <span className="field-error">{submitErrors.patientFirstName}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input name="patientLastName" className={`form-input ${submitErrors.patientLastName ? 'input-error' : ''}`} placeholder="Patient last name" value={submitForm.patientLastName} onChange={handleSubmitChange} />
                    {submitErrors.patientLastName && <span className="field-error">{submitErrors.patientLastName}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Doctor Name</label>
                  <input name="doctorName" className="form-input" placeholder="Dr. Name" value={submitForm.doctorName} onChange={handleSubmitChange} />
                </div>

                <div className="form-group">
                  <label className="form-label">Symptoms</label>
                  <textarea name="symptoms" className={`form-textarea ${submitErrors.symptoms ? 'input-error' : ''}`} placeholder="Describe symptoms..." value={submitForm.symptoms} onChange={handleSubmitChange} rows={3} />
                  {submitErrors.symptoms && <span className="field-error">{submitErrors.symptoms}</span>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Temperature (°C)</label>
                    <input name="temperature" className={`form-input ${submitErrors.temperature ? 'input-error' : ''}`} placeholder="e.g. 37.5" value={submitForm.temperature} onChange={handleSubmitChange} />
                    {submitErrors.temperature && <span className="field-error">{submitErrors.temperature}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Blood Pressure</label>
                    <input name="bloodPressure" className={`form-input ${submitErrors.bloodPressure ? 'input-error' : ''}`} placeholder="e.g. 120/80" value={submitForm.bloodPressure} onChange={handleSubmitChange} />
                    {submitErrors.bloodPressure && <span className="field-error">{submitErrors.bloodPressure}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Attach Prescription PDF (optional)</label>
                  <div className="file-upload-area">
                    <input type="file" id="pdf-upload" accept=".pdf" className="file-input" onChange={handleFileChange} />
                    <label htmlFor="pdf-upload" className="file-label">
                      <span className="file-icon">📎</span>
                      <span>{submitPdf ? '✅ PDF attached' : 'Click to upload PDF'}</span>
                    </label>
                  </div>
                </div>

                <button type="submit" className="btn-primary btn-full" disabled={submitLoading}>
                  {submitLoading ? <><span className="btn-spinner" /> Submitting...</> : '🚀 Submit & Convert to FHIR'}
                </button>
              </form>
            </div>

            {/* ── Initiate Consent Request ──────────────────────────────── */}
            <div className="panel card">
              <div className="panel-header panel-header--purple">
                <span className="panel-icon">🔒</span>
                <div>
                  <h2 className="panel-title">Initiate Consent Request</h2>
                  <p className="panel-subtitle">Request access to a patient's health records</p>
                </div>
              </div>

              {consentResult && (
                <div className="alert-success">
                  ✅ Consent request sent! Status: <strong>{consentResult.status}</strong> · ID: {consentResult.id}
                </div>
              )}
              {consentError && <div className="alert-error">⚠️ {consentError}</div>}

              <form onSubmit={handleConsentSubmit} className="submit-form">
                <div className="form-group">
                  <label className="form-label">Patient ID</label>
                  <input
                    className="form-input"
                    placeholder="e.g. P-1001"
                    value={consentForm.patientId}
                    onChange={(e) => setConsentForm({ ...consentForm, patientId: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Purpose of Request</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Follow-up Consultation, Emergency Review"
                    value={consentForm.purpose}
                    onChange={(e) => setConsentForm({ ...consentForm, purpose: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Requested Data Types</label>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {DATA_TYPES.map((type) => (
                      <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                        <input
                          type="checkbox"
                          checked={consentForm.requestedDataTypes.includes(type)}
                          onChange={() => toggleConsentType(type)}
                        />
                        {type.replace(/_/g, ' ')}
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={consentLoading}>
                  {consentLoading ? '⏳ Sending...' : '📨 Send Consent Request'}
                </button>
              </form>
            </div>

            {/* ── Hospital B: Receive FHIR Bundle ───────────────────────── */}
            <div className="panel card">
              <div className="panel-header panel-header--b">
                <span className="panel-icon">🏨</span>
                <div>
                  <h2 className="panel-title">Hospital B — Receive FHIR Bundle</h2>
                  <p className="panel-subtitle">Paste a FHIR JSON bundle to receive and parse it</p>
                </div>
              </div>

              {fhirError && <div className="alert-error">⚠️ {fhirError}</div>}

              <form onSubmit={handleFhirReceive} className="submit-form">
                <div className="form-group">
                  <label className="form-label">FHIR JSON Bundle</label>
                  <textarea
                    className="form-textarea"
                    rows={8}
                    placeholder={'Paste FHIR JSON here...\n{"resourceType": "Bundle", ...}'}
                    value={fhirInput}
                    onChange={(e) => setFhirInput(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={fhirLoading || !fhirInput.trim()}>
                  {fhirLoading ? <><span className="btn-spinner" /> Processing...</> : '📥 Receive & Parse'}
                </button>
              </form>

              {/* Parsed result */}
              <AnimatePresence>
                {fhirResult && (
                  <motion.div
                    className="card"
                    style={{ marginTop: '20px', padding: '16px', background: '#f8faff' }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <h4 style={{ marginBottom: '12px', color: '#5b5fc7' }}>✅ Parsed Record (HospitalBOPConsultRecordDTO)</h4>
                    <div className="detail-grid">
                      {[
                        ['UHID', fhirResult.uhid],
                        ['Patient', fhirResult.patientName],
                        ['Consult Date', fhirResult.consultDate],
                        ['Doctor', fhirResult.doctor],
                        ['Clinical Notes', fhirResult.clinicalNotes],
                        ['Blood Pressure', fhirResult.vitals?.bp],
                        ['Temperature', fhirResult.vitals?.temp],
                        ['Consent Verified', fhirResult.consentVerified ? '✅ Yes' : '❌ No'],
                      ].map(([label, val]) => (
                        <div key={label} className="detail-row">
                          <span className="detail-label">{label}</span>
                          <span className="detail-value">{val || 'N/A'}</span>
                        </div>
                      ))}
                    </div>
                    {fhirResult.prescriptionPdfBase64 && (
                      <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#666' }}>
                        📎 Prescription PDF attached
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
