import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { patientService } from '../services/patientService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const NAV_TABS = [
  { id: 'consent',  label: 'Consent Requests', icon: '🔒' },
  { id: 'transfer', label: 'Push Data',         icon: '📤' },
  { id: 'history',  label: 'Activity Log',      icon: '🕐' },
];

// Maps backend ConsentStatus enum values to display info
const STATUS_CONFIG = {
  PENDING:  { label: 'Pending',  color: 'consent-pending',  icon: '🟡' },
  GRANTED:  { label: 'Granted',  color: 'consent-granted',  icon: '🟢' },
  DENIED:   { label: 'Denied',   color: 'consent-denied',   icon: '🔴' },
  REVOKED:  { label: 'Revoked',  color: 'consent-denied',   icon: '🔴' },
};

const DATA_TYPES = ['OP_CONSULT', 'PRESCRIPTION', 'LAB_RESULT'];

const PatientDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Pull patientId from JWT-decoded user object (set in AuthContext on login)
  const patientId = user?.patientId;

  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('consent');

  // Per-consent: which data types are selected for granting
  const [grantedTypes, setGrantedTypes] = useState({});
  const [consentLoading, setConsentLoading] = useState({});
  const [consentMsg, setConsentMsg] = useState({ id: null, text: '', ok: true });

  // Local timeline — built from user interactions (no backend history endpoint)
  const [timeline, setTimeline] = useState([]);

  // Push flow state
  const [pushForm, setPushForm] = useState({ targetRequesterId: '', dataTypes: ['OP_CONSULT'] });
  const [pushLoading, setPushLoading] = useState(false);
  const [pushResult, setPushResult] = useState('');

  useEffect(() => {
    if (!patientId) return;
    patientService.getConsents(patientId)
      .then((data) => {
        setConsents(data);
        // Pre-fill grantedTypes with what backend already has
        const init = {};
        data.forEach((c) => {
          init[c.id] = c.grantedDataTypes?.length ? c.grantedDataTypes : ['OP_CONSULT'];
        });
        setGrantedTypes(init);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  const addTimeline = (action, requesterId) => {
    setTimeline((prev) => [
      { timestamp: new Date().toISOString(), action, target: requesterId },
      ...prev,
    ]);
  };

  const handleRespond = async (consent, grant) => {
    setConsentLoading((p) => ({ ...p, [consent.id]: true }));
    setConsentMsg({ id: null, text: '', ok: true });
    try {
      const types = grantedTypes[consent.id] || ['OP_CONSULT'];
      const updated = await patientService.respondToConsent(consent.id, grant, types);
      setConsents((prev) =>
        prev.map((c) => (c.id === consent.id ? { ...c, ...updated } : c))
      );
      addTimeline(grant ? 'GRANTED' : 'DENIED', consent.requesterId);
      setConsentMsg({ id: consent.id, text: `Consent ${grant ? 'granted ✅' : 'denied ❌'} for ${consent.requesterId}`, ok: grant });
    } catch (err) {
      setConsentMsg({ id: consent.id, text: err?.response?.data?.message || 'Failed to respond', ok: false });
    } finally {
      setConsentLoading((p) => ({ ...p, [consent.id]: false }));
    }
  };

  const handleRevoke = async (consent) => {
    setConsentLoading((p) => ({ ...p, [consent.id]: true }));
    setConsentMsg({ id: null, text: '', ok: true });
    try {
      await patientService.revokeConsent(consent.id);
      setConsents((prev) =>
        prev.map((c) => (c.id === consent.id ? { ...c, status: 'REVOKED' } : c))
      );
      addTimeline('REVOKED', consent.requesterId);
      setConsentMsg({ id: consent.id, text: `Consent revoked for ${consent.requesterId}`, ok: false });
    } catch (err) {
      setConsentMsg({ id: consent.id, text: err?.response?.data?.message || 'Failed to revoke', ok: false });
    } finally {
      setConsentLoading((p) => ({ ...p, [consent.id]: false }));
    }
  };

  const toggleGrantedType = (consentId, type) => {
    setGrantedTypes((prev) => {
      const cur = prev[consentId] || ['OP_CONSULT'];
      const updated = cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type];
      return { ...prev, [consentId]: updated };
    });
  };

  const handlePushSubmit = async (e) => {
    e.preventDefault();
    if (!pushForm.targetRequesterId.trim() || pushForm.dataTypes.length === 0) return;
    setPushLoading(true);
    setPushResult('');
    try {
      const msg = await patientService.pushRecords(pushForm.targetRequesterId, pushForm.dataTypes);
      setPushResult(`✅ ${msg || 'Records pushed successfully!'}`);
      setPushForm({ targetRequesterId: '', dataTypes: ['OP_CONSULT'] });
    } catch (err) {
      setPushResult(`⚠️ ${err?.response?.data?.message || err.message || 'Push failed'}`);
    } finally {
      setPushLoading(false);
    }
  };

  const togglePushType = (type) => {
    setPushForm((prev) => {
      const types = prev.dataTypes;
      const updated = types.includes(type) ? types.filter((t) => t !== type) : [...types, type];
      return { ...prev, dataTypes: updated };
    });
  };

  // Stats
  const pendingCount = consents.filter((c) => c.status === 'PENDING').length;
  const grantedCount = consents.filter((c) => c.status === 'GRANTED').length;

  return (
    <div className="dashboard-layout">
      {/* Inline tab-based sidebar (no sub-routes needed) */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">⚕️</span>
          <span className="sidebar-logo-text">HealthBridge</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`sidebar-link ${activeTab === tab.id ? 'sidebar-link--active' : ''}`}
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="sidebar-icon">{tab.icon}</span>
              <span className="sidebar-label">{tab.label}</span>
              {tab.id === 'consent' && pendingCount > 0 && (
                <span className="tab-badge" style={{ marginLeft: 'auto' }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-footer-text">FHIR HL7 R4</span>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <h1 className="page-title">Patient Dashboard</h1>
            <p className="page-subtitle">
              {patientId
                ? `Logged in as ${user?.username} · Patient ID: ${patientId}`
                : 'Manage your health data sharing preferences'}
            </p>
          </div>
          <div className="topbar-actions">
            <span className="role-badge">🧑 {user?.username}</span>
            <button className="btn-outline" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
          </div>
        </header>

        {loading ? (
          <div className="page-loading"><LoadingSpinner message="Loading consent data..." /></div>
        ) : (
          <motion.div
            className="page-content"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Summary Cards */}
            <div className="stats-grid stats-grid--3">
              <div className="stat-card stat-card--amber">
                <div className="stat-icon">⏳</div>
                <div className="stat-value">{pendingCount}</div>
                <div className="stat-label">Pending Requests</div>
              </div>
              <div className="stat-card stat-card--green">
                <div className="stat-icon">✅</div>
                <div className="stat-value">{grantedCount}</div>
                <div className="stat-label">Active Grants</div>
              </div>
              <div className="stat-card stat-card--purple">
                <div className="stat-icon">🔒</div>
                <div className="stat-value">{consents.length}</div>
                <div className="stat-label">Total Requests</div>
              </div>
            </div>

            {!patientId && (
              <div className="alert-error" style={{ marginBottom: '16px' }}>
                ⚠️ No Patient ID detected in your session. Please log out and log in again with your Patient account.
              </div>
            )}


            {/* Consent Tab */}
            {activeTab === 'consent' && (
              <div className="consent-section">
                {consents.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📭</span>
                    <p>No consent requests yet. Doctors will send requests to access your records.</p>
                  </div>
                ) : (
                  <div className="consent-list">
                    {consents.map((c) => {
                      const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.PENDING;
                      const isLoading = consentLoading[c.id];
                      const msg = consentMsg.id === c.id;
                      return (
                        <motion.div key={c.id} className="consent-card" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          {/* Top row: info + status */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                            <div className="consent-card-left">
                              <div className="consent-hospital">
                                <strong>Requester:</strong> {c.requesterId}
                              </div>
                              <div className="consent-doctor">
                                <strong>Purpose:</strong> {c.purpose}
                              </div>
                              <div className="consent-updated">
                                Requested: {new Date(c.createdAt).toLocaleString()}
                              </div>
                              <div style={{ marginTop: '6px', fontSize: '0.82rem', color: '#666' }}>
                                Requested data: {(c.requestedDataTypes || []).join(', ')}
                              </div>
                            </div>
                            <div className="consent-card-right">
                              <span className={`consent-status-text ${cfg.color}`}>
                                {cfg.icon} {cfg.label}
                              </span>
                            </div>
                          </div>

                          {/* Granular type selector – only shown for PENDING */}
                          {c.status === 'PENDING' && (
                            <div className="granular-consent-options" style={{ marginTop: '12px' }}>
                              <strong style={{ fontSize: '0.85rem' }}>Select data types to grant:</strong>
                              <div style={{ display: 'flex', gap: '14px', marginTop: '6px', flexWrap: 'wrap' }}>
                                {DATA_TYPES.map((type) => (
                                  <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={(grantedTypes[c.id] || ['OP_CONSULT']).includes(type)}
                                      onChange={() => toggleGrantedType(c.id, type)}
                                    />
                                    {type.replace(/_/g, ' ')}
                                  </label>
                                ))}
                              </div>
                              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                                <button
                                  className="btn-primary"
                                  style={{ flex: 1 }}
                                  disabled={isLoading}
                                  onClick={() => handleRespond(c, true)}
                                >
                                  {isLoading ? 'Processing...' : '✅ Grant Access'}
                                </button>
                                <button
                                  className="btn-outline"
                                  style={{ flex: 1 }}
                                  disabled={isLoading}
                                  onClick={() => handleRespond(c, false)}
                                >
                                  {isLoading ? 'Processing...' : '❌ Deny'}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Revoke button for GRANTED consents */}
                          {c.status === 'GRANTED' && (
                            <div style={{ marginTop: '12px' }}>
                              <div style={{ fontSize: '0.82rem', color: '#555', marginBottom: '8px' }}>
                                Granted types: {(c.grantedDataTypes || []).join(', ') || 'N/A'}
                              </div>
                              <button
                                className="btn-outline"
                                disabled={isLoading}
                                onClick={() => handleRevoke(c)}
                              >
                                {isLoading ? 'Revoking...' : '🔒 Revoke Consent'}
                              </button>
                            </div>
                          )}

                          {/* Inline feedback */}
                          <AnimatePresence>
                            {msg && (
                              <motion.div
                                className={consentMsg.ok ? 'alert-success' : 'alert-error'}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{ marginTop: '10px' }}
                              >
                                {consentMsg.text}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Push Data Tab */}
            {activeTab === 'transfer' && (
              <div className="card" style={{ padding: '28px' }}>
                <h3 className="section-title">📤 Manually Push Records to a Doctor</h3>
                <p style={{ marginBottom: '20px', color: '#666', fontSize: '0.9rem' }}>
                  Instruct Hospital A to push your FHIR-converted records directly to a specific doctor or system.
                  The backend reads your identity securely from your login token.
                </p>
                {pushResult && (
                  <div className={pushResult.startsWith('✅') ? 'alert-success' : 'alert-error'} style={{ marginBottom: '16px' }}>
                    {pushResult}
                  </div>
                )}
                <form onSubmit={handlePushSubmit} className="submit-form">
                  <div className="form-group">
                    <label className="form-label">Target Requester ID (doctor username)</label>
                    <input
                      className="form-input"
                      placeholder="e.g. dr_chen"
                      value={pushForm.targetRequesterId}
                      onChange={(e) => setPushForm({ ...pushForm, targetRequesterId: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Data Types to Push</label>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {['OP_CONSULT', 'PRESCRIPTION', 'LAB_RESULT', 'INPATIENT'].map((type) => (
                        <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                          <input
                            type="checkbox"
                            checked={pushForm.dataTypes.includes(type)}
                            onChange={() => togglePushType(type)}
                          />
                          {type.replace(/_/g, ' ')}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button type="submit" className="btn-primary" disabled={pushLoading}>
                    {pushLoading ? '⏳ Pushing...' : '🚀 Push Records Now'}
                  </button>
                </form>
              </div>
            )}

            {/* Activity Log Tab */}
            {activeTab === 'history' && (
              <div className="card consent-history-card" style={{ padding: '28px' }}>
                <h3 className="section-title">🕐 Activity Log</h3>
                <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '16px' }}>
                  Actions you took during this session. Refreshing the page resets this log.
                </p>
                {timeline.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📋</span>
                    <p>No actions taken yet this session.</p>
                  </div>
                ) : (
                  <div className="timeline">
                    {timeline.map((item, i) => (
                      <div key={i} className="timeline-item">
                        <div className={`timeline-dot ${item.action === 'GRANTED' ? 'timeline-dot--green' : 'timeline-dot--red'}`} />
                        <div className="timeline-content">
                          <span className={`timeline-action ${item.action === 'GRANTED' ? 'action-grant' : 'action-revoke'}`}>
                            {item.action}
                          </span>
                          <span className="timeline-target">{item.target}</span>
                          <span className="timeline-time">{new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PatientDashboard;
