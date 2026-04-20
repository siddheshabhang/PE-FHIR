import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { value: 'ADMIN', label: 'Hospital Admin', icon: '🏥' },
  { value: 'DOCTOR', label: 'Doctor / Clinician', icon: '👨‍⚕️' },
  { value: 'PATIENT', label: 'Patient', icon: '🧑' },
];

const ROLE_ROUTES = {
  ADMIN: '/admin/dashboard',
  DOCTOR: '/doctor/dashboard',
  PATIENT: '/patient/dashboard',
};

const FEATURES = [
  { icon: '🔒', label: 'HIPAA-compliant data transfer' },
  { icon: '⚡', label: 'Real-time FHIR R4 conversion' },
  { icon: '🏥', label: 'Multi-hospital interoperability' },
  { icon: '✅', label: 'Patient consent management' },
];

const LoginPage = () => {
  const { isAuthenticated, user, login, register } = useAuth();
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'DOCTOR', patientId: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (isAuthenticated && user) {
    return <Navigate to={ROLE_ROUTES[user.role] || '/login'} replace />;
  }

  const validate = () => {
    const errs = {};
    if (!form.username.trim()) errs.username = 'Username is required';
    else if (form.username.length < 3) errs.username = 'At least 3 characters required';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 6) errs.password = 'At least 6 characters required';
    if (!form.role) errs.role = 'Please select a role';
    return errs;
  };

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((p) => ({ ...p, [e.target.name]: '' }));
    setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    setApiError('');
    try {
      if (isRegister) {
        const generatedPatientId = form.role === 'PATIENT' ? `P-${Math.floor(1000 + Math.random() * 9000)}` : '';
        await register(form.username, form.password, form.role, generatedPatientId);
        setSuccessMsg(`Account created successfully.`);
        setIsRegister(false);
        setForm((f) => ({ ...f, password: '' }));
      } else {
        const userObj = await login(form.username, form.password);
        navigate(ROLE_ROUTES[userObj.role] || '/login');
      }
    } catch (err) {
      setApiError(err?.response?.data?.message || err.message || 'Authentication failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister((v) => !v);
    setErrors({});
    setApiError('');
    setSuccessMsg('');
  };

  return (
    <div className="login-page">
      {/* Left panel */}
      <div className="login-left">
        <div className="login-left-bg" />
        <div className="login-left-grid" />
        <div className="login-left-content">
          <div className="login-hero-badge">
            <span className="login-hero-badge-dot" />
            FHIR R4 Certified
          </div>

          <span className="login-hero-icon">⚕️</span>
          <h1 className="login-hero-title">
            Health<span>Bridge</span>
          </h1>
          <p className="login-hero-subtitle">
            Secure, standards-based health record interoperability between hospitals — powered by HAPI FHIR R4.
          </p>

          <div className="login-features">
            {FEATURES.map((f) => (
              <div key={f.label} className="login-feature-item">
                <span className="login-feature-icon">{f.icon}</span>
                <span>{f.label}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '40px', paddingTop: '28px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', gap: '20px' }}>
              {[
                { value: 'DEPA', label: 'Compliant' },
                { value: 'ABDM', label: 'Ready' },
                { value: 'HL7', label: 'FHIR R4' },
              ].map((tag) => (
                <div key={tag.value} style={{ textAlign: 'center' }}>
                  <div style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: '16px', fontWeight: '700',
                    color: 'rgba(255,255,255,0.9)'
                  }}>{tag.value}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>{tag.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <motion.div
          className="login-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <div className="login-card-eyebrow">
              {isRegister ? 'New Account' : 'Secure Access'}
            </div>
            <h2 className="login-card-title">
              {isRegister ? 'Create your account' : 'Sign in to HealthBridge'}
            </h2>
            <p className="login-card-subtitle" style={{ marginTop: '4px' }}>
              {isRegister
                ? 'Register to access the interoperability platform'
                : 'Enter your credentials to continue'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {successMsg && (
              <motion.div
                className="alert-success"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                ✅ {successMsg}
              </motion.div>
            )}
            {apiError && (
              <motion.div
                className="alert-error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                ⚠️ {apiError}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input
                id="username" name="username" type="text"
                className={`form-input ${errors.username ? 'input-error' : ''}`}
                placeholder="Enter your username"
                value={form.username} onChange={handleChange}
                autoComplete="username"
              />
              {errors.username && <span className="field-error">{errors.username}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password" name="password" type="password"
                className={`form-input ${errors.password ? 'input-error' : ''}`}
                placeholder="Enter your password"
                value={form.password} onChange={handleChange}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="role">Role</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {ROLES.map((r) => (
                  <label key={r.value} style={{
                    flex: '1', minWidth: '100px',
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '9px 12px',
                    border: `1.5px solid ${form.role === r.value ? 'var(--c-primary)' : 'var(--c-border)'}`,
                    borderRadius: 'var(--r-md)',
                    background: form.role === r.value ? 'var(--c-primary-bg)' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                    fontSize: '12.5px',
                    fontWeight: '500',
                    color: form.role === r.value ? 'var(--c-primary-dark)' : 'var(--c-text-secondary)',
                  }}>
                    <input
                      type="radio" name="role" value={r.value}
                      checked={form.role === r.value}
                      onChange={handleChange}
                      style={{ width: '13px', height: '13px', accentColor: 'var(--c-primary)' }}
                    />
                    {r.icon} {r.label}
                  </label>
                ))}
              </div>
              {errors.role && <span className="field-error">{errors.role}</span>}
            </div>



            <button type="submit" className="btn-primary btn-full" disabled={loading} style={{ marginTop: '4px' }}>
              {loading ? (
                <>
                  <span className="btn-spinner" />
                  {isRegister ? 'Creating account...' : 'Signing in...'}
                </>
              ) : (
                isRegister ? 'Create Account' : 'Sign In →'
              )}
            </button>
          </form>

          <div className="divider" />

          <div className="login-toggle">
            <span>{isRegister ? 'Already have an account?' : "Don't have an account?"}</span>
            <button type="button" className="toggle-btn" onClick={switchMode}>
              {isRegister ? 'Sign In' : 'Register'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;