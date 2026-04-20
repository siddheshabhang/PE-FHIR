import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { patientService } from '../services/patientService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const NAV_TABS = [
  { id: 'consent', label: 'Consent Requests', icon: '🔒' },
  { id: 'transfer', label: 'Push Records', icon: '📤' },
  { id: 'history', label: 'Activity Log', icon: '🕐' },
];

const DATA_TYPES = ['OP_CONSULT', 'PRESCRIPTION', 'LAB_RESULT'];
const PUSH_TYPES = ['OP_CONSULT', 'PRESCRIPTION', 'LAB_RESULT', 'INPATIENT'];

const STATUS_MAP = {
  PENDING: { label: 'Pending', cls: 'consent-status-pill--pending', icon: '🟡' },
  GRANTED: { label: 'Granted', cls: 'consent-status-pill--granted', icon: '🟢' },
  DENIED: { label: 'Denied', cls: 'consent-status-pill--denied', icon: '🔴' },
  REVOKED: { label: 'Revoked', cls: 'consent-status-pill--revoked', icon: '🔴' },
};

const TypeCheckbox = ({ type, checked, onChange }) => (
  <label className="consent-type-check">
    <input type="checkbox" checked={checked} onChange={onChange} />
    {type.replace(/_/g, ' ')}
  </label>
);

// ══════════════════════════════════════════════════════════════
const PatientDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const patientId = user?.patientId;

  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('consent');
  const [grantedTypes, setGrantedTypes] = useState({});
  const [consentLoading, setConsentLoading] = useState({});
  const [consentMsg, setConsentMsg] = useState({ id: null, text: '', ok: true });
  const [timeline, setTimeline] = useState([]);
  const [pushForm, setPushForm] = useState({ targetRequesterId: '', dataTypes: ['OP_CONSULT'] });
  const [pushLoading, setPushLoading] = useState(false);
  const [pushResult, setPushResult] = useState('');

  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    patientService.getConsents(patientId)
      .then((data) => {
        setConsents(data);
        const init = {};
        data.forEach((c) => {
          init[c.id] = c.grantedDataTypes?.length ? c.grantedDataTypes : ['OP_CONSULT'];
        });
        setGrantedTypes(init);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [patientId]);

  const addTimeline = (action, requesterId) =>
    setTimeline((p) => [{ timestamp: new Date().toISOString(), action, target: requesterId }, ...p]);

  const handleRespond = async (consent, grant) => {
    setConsentLoading((p) => ({ ...p, [consent.id]: true }));
    setConsentMsg({ id: null, text: '', ok: true });
    try {
      const types = grantedTypes[consent.id] || ['OP_CONSULT'];
      const updated = await patientService.respondToConsent(consent.id, grant, types);
      setConsents((p) => p.map((c) => (c.id === consent.id ? { ...c, ...updated } : c)));
      addTimeline(grant ? 'GRANTED' : 'DENIED', consent.requesterId);
      setConsentMsg({
        id: consent.id,
        text: `Consent ${grant ? 'granted' : 'denied'} for ${consent.requesterId}`,
        ok: grant,
      });
    } catch (err) {
      setConsentMsg({ id: consent.id, text: err?.response?.data?.message || 'Failed to respond.', ok: false });
    } finally {
      setConsentLoading((p) => ({ ...p, [consent.id]: false }));
    }
  };

  const handleRevoke = async (consent) => {
    setConsentLoading((p) => ({ ...p, [consent.id]: true }));
    try {
      await patientService.revokeConsent(consent.id);
      setConsents((p) => p.map((c) => (c.id === consent.id ? { ...c, status: 'REVOKED' } : c)));
      addTimeline('REVOKED', consent.requesterId);
      setConsentMsg({ id: consent.id, text: `Consent revoked for ${consent.requesterId}`, ok: false });
    } catch (err) {
      setConsentMsg({ id: consent.id, text: err?.response?.data?.message || 'Failed to revoke.', ok: false });
    } finally {
      setConsentLoading((p) => ({ ...p, [consent.id]: false }));
    }
  };

  const toggleGrantedType = (cId, type) =>
    setGrantedTypes((p) => {
      const cur = p[cId] || ['OP_CONSULT'];
      return { ...p, [cId]: cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type] };
    });

  const handlePushSubmit = async (e) => {
    e.preventDefault();
    if (!pushForm.targetRequesterId.trim() || !pushForm.dataTypes.length) return;
    setPushLoading(true); setPushResult('');
    try {
      const msg = await patientService.pushRecords(pushForm.targetRequesterId, pushForm.dataTypes);
      setPushResult(`✅ ${msg || 'Records pushed successfully!'}`);
      setPushForm({ targetRequesterId: '', dataTypes: ['OP_CONSULT'] });
    } catch (err) {
      setPushResult(`⚠️ ${err?.response?.data?.message || err.message || 'Push failed.'}`);
    } finally {
      setPushLoading(false);
    }
  };

  const togglePushType = (type) =>
    setPushForm((p) => ({
      ...p,
      dataTypes: p.dataTypes.includes(type)
        ? p.dataTypes.filter((t) => t !== type)
        : [...p.dataTypes, type],
    }));

  const pendingCount = consents.filter((c) => c.status === 'PENDING').length;
  const grantedCount = consents.filter((c) => c.status === 'GRANTED').length;

  return (
    <div className="dashboard-layout">
      {/* Inline sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⚕️</div>
          <div>
            <div className="sidebar-logo-text">HealthBridge</div>
            <div className="sidebar-logo-sub">Patient Portal</div>
          </div>
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
                <span className="sidebar-badge">{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-footer-dot" />
          <span className="sidebar-footer-text">FHIR R4</span>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <h1 className="page-title">Patient Dashboard</h1>
            <p className="page-subtitle">
              {patientId
                ? `${user?.username} · Patient ID: ${patientId}`
                : 'Manage your health data sharing preferences'}
            </p>
          </div>
          <div className="topbar-actions">
            <span className="role-badge">🧑 {user?.username}</span>
            <button className="btn-outline" onClick={() => { logout(); navigate('/login'); }}>Sign Out</button>
          </div>
        </header>

        {loading ? (
          <div className="page-loading"><LoadingSpinner message="Loading your data..." /></div>
        ) : (
          <motion.div
            className="page-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            {/* Summary */}
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
              <div className="stat-card stat-card--teal">
                <div className="stat-icon">🔒</div>
                <div className="stat-value">{consents.length}</div>
                <div className="stat-label">Total Requests</div>
              </div>
            </div>

            {!patientId && (
              <div className="alert-error">
                ⚠️ No Patient ID detected. Please log out and sign in again with your Patient account.
              </div>
            )}

            {/* ── Consent Tab ─────────────────────────────────────────── */}
            {activeTab === 'consent' && (
              <AnimatePresence mode="wait">
                <motion.div key="consent" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {consents.length === 0 ? (
                    <div className="card">
                      <div className="empty-state">
                        <div className="empty-icon">📭</div>
                        <div className="empty-title">No consent requests yet</div>
                        <div className="empty-desc">
                          When doctors request access to your health records, they will appear here for your review.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="consent-list">
                      {consents.map((c) => {
                        const cfg = STATUS_MAP[c.status] || STATUS_MAP.PENDING;
                        const isLoading = consentLoading[c.id];
                        const hasMsg = consentMsg.id === c.id;
                        return (
                          <motion.div
                            key={c.id} className="consent-card"
                            layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          >
                            <div className="consent-card-top">
                              <div style={{ flex: 1 }}>
                                <div className="consent-hospital">
                                  Dr. / System: <strong>{c.requesterId}</strong>
                                </div>
                                <div className="consent-doctor">
                                  Purpose: {c.purpose}
                                </div>
                                <div className="consent-meta">
                                  Requested {new Date(c.createdAt).toLocaleString()}
                                  {' · '}
                                  Data: {(c.requestedDataTypes || []).join(', ') || 'N/A'}
                                </div>
                              </div>
                              <span className={`consent-status-pill ${cfg.cls}`}>
                                {cfg.icon} {cfg.label}
                              </span>
                            </div>

                            {/* Actions for PENDING */}
                            {c.status === 'PENDING' && (
                              <div className="consent-action-area">
                                <span className="consent-type-label">Select data types to grant access:</span>
                                <div className="consent-types-row">
                                  {DATA_TYPES.map((type) => (
                                    <TypeCheckbox
                                      key={type} type={type}
                                      checked={(grantedTypes[c.id] || ['OP_CONSULT']).includes(type)}
                                      onChange={() => toggleGrantedType(c.id, type)}
                                    />
                                  ))}
                                </div>
                                <div className="consent-action-btns">
                                  <button
                                    className="btn-primary"
                                    style={{ flex: 1 }}
                                    disabled={isLoading}
                                    onClick={() => handleRespond(c, true)}
                                  >
                                    {isLoading ? '⏳ Processing…' : '✅ Grant Access'}
                                  </button>
                                  <button
                                    className="btn-outline"
                                    style={{ flex: 1 }}
                                    disabled={isLoading}
                                    onClick={() => handleRespond(c, false)}
                                  >
                                    {isLoading ? '…' : '❌ Deny'}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Actions for GRANTED */}
                            {c.status === 'GRANTED' && (
                              <div className="consent-action-area">
                                <div style={{ fontSize: '12px', color: 'var(--c-text-muted)', marginBottom: '10px' }}>
                                  Granted access to: <strong style={{ color: 'var(--c-success-text)' }}>
                                    {(c.grantedDataTypes || []).join(', ') || 'N/A'}
                                  </strong>
                                </div>
                                <button className="btn-danger" disabled={isLoading} onClick={() => handleRevoke(c)}>
                                  {isLoading ? '⏳ Revoking…' : '🔒 Revoke Consent'}
                                </button>
                              </div>
                            )}

                            {/* Inline feedback */}
                            <AnimatePresence>
                              {hasMsg && (
                                <motion.div
                                  className={consentMsg.ok ? 'alert-success' : 'alert-error'}
                                  style={{ margin: '0 20px 16px' }}
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
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
                </motion.div>
              </AnimatePresence>
            )}

            {/* ── Push Data Tab ───────────────────────────────────────── */}
            {activeTab === 'transfer' && (
              <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="card-header">
                  <div>
                    <div className="card-title">📤 Push Records to a Doctor</div>
                    <div className="card-subtitle">
                      Your identity is read securely from your session token
                    </div>
                  </div>
                </div>

                <div className="submit-form">
                  {pushResult && (
                    <div className={pushResult.startsWith('✅') ? 'alert-success' : 'alert-error'}>
                      {pushResult}
                    </div>
                  )}
                  <form onSubmit={handlePushSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                      <div className="form-group">
                        <label className="form-label">Target Requester / Doctor Username</label>
                        <input
                          className="form-input"
                          placeholder="e.g. dr_chen"
                          value={pushForm.targetRequesterId}
                          onChange={(e) => setPushForm({ ...pushForm, targetRequesterId: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Data Types to Push</label>
                        <div className="consent-types-row">
                          {PUSH_TYPES.map((type) => (
                            <TypeCheckbox
                              key={type} type={type}
                              checked={pushForm.dataTypes.includes(type)}
                              onChange={() => togglePushType(type)}
                            />
                          ))}
                        </div>
                      </div>
                      <button type="submit" className="btn-primary" disabled={pushLoading}>
                        {pushLoading ? <><span className="btn-spinner" /> Pushing…</> : '🚀 Push Records Now'}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}

            {/* ── Activity Log Tab ────────────────────────────────────── */}
            {activeTab === 'history' && (
              <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="card-header">
                  <div>
                    <div className="card-title">🕐 Session Activity Log</div>
                    <div className="card-subtitle">Actions taken during this session (resets on page refresh)</div>
                  </div>
                </div>
                <div style={{ padding: '20px 22px' }}>
                  {timeline.length === 0 ? (
                    <div className="empty-state" style={{ padding: '32px' }}>
                      <div className="empty-icon">📋</div>
                      <div className="empty-title">No activity yet</div>
                      <div className="empty-desc">Grant, deny, or revoke consent requests to see activity here.</div>
                    </div>
                  ) : (
                    <div className="timeline">
                      {timeline.map((item, i) => (
                        <div key={i} className="timeline-item">
                          <div className={`timeline-dot ${item.action === 'GRANTED' ? 'timeline-dot--green'
                            : item.action === 'DENIED' ? 'timeline-dot--amber'
                              : 'timeline-dot--red'
                            }`} />
                          <div className="timeline-content">
                            <span className={`timeline-action ${item.action === 'GRANTED' ? 'action-grant'
                              : item.action === 'DENIED' ? 'action-deny'
                                : 'action-revoke'
                              }`}>
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
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PatientDashboard;