import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { value: 'ADMIN', label: '🏥 Hospital Admin' },
  { value: 'DOCTOR', label: '👨‍⚕️ Doctor' },
  { value: 'PATIENT', label: '🧑 Patient' },
];

const ROLE_ROUTES = {
  ADMIN: '/admin/dashboard',
  DOCTOR: '/doctor/dashboard',
  PATIENT: '/patient/dashboard',
};

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
    else if (form.username.length < 3) errs.username = 'Username must be at least 3 characters';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (!form.role) errs.role = 'Please select a role';
    if (isRegister && form.role === 'PATIENT' && !form.patientId.trim()) {
      errs.patientId = 'Patient ID is required for Patient role';
    }
    return errs;
  };

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
    setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    setApiError('');
    try {
      if (isRegister) {
        await register(form.username, form.password, form.role, form.patientId);
        setSuccessMsg('Account created! Please log in.');
        setIsRegister(false);
        setForm((f) => ({ ...f, password: '' }));
      } else {
        const userObj = await login(form.username, form.password);
        navigate(ROLE_ROUTES[userObj.role] || '/login');
      }
    } catch (err) {
      setApiError(err?.response?.data?.message || err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left panel */}
      <div className="login-left">
        <div className="login-left-content">
          <div className="login-hero-icon">⚕️</div>
          <h1 className="login-hero-title">HealthBridge</h1>
          <p className="login-hero-subtitle">
            FHIR-powered Health Record Interoperability System
          </p>
          <div className="login-features">
            {[
              { icon: '🔒', text: 'HIPAA-compliant data transfer' },
              { icon: '⚡', text: 'Real-time FHIR R4 conversion' },
              { icon: '🏥', text: 'Multi-hospital interoperability' },
              { icon: '✅', text: 'Patient consent management' },
            ].map((f) => (
              <div key={f.text} className="login-feature-item">
                <span>{f.icon}</span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="login-left-deco" />
      </div>

      {/* Right panel – form */}
      <div className="login-right">
        <motion.div
          className="login-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="login-card-header">
            <h2 className="login-card-title">{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
            <p className="login-card-subtitle">
              {isRegister ? 'Register to access the system' : 'Sign in to your healthcare dashboard'}
            </p>
          </div>

          <AnimatePresence>
            {successMsg && (
              <motion.div
                className="alert-success"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                ✅ {successMsg}
              </motion.div>
            )}
            {apiError && (
              <motion.div
                className="alert-error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                ⚠️ {apiError}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                className={`form-input ${errors.username ? 'input-error' : ''}`}
                placeholder="Enter your username"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
              />
              {errors.username && <span className="field-error">{errors.username}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                className={`form-input ${errors.password ? 'input-error' : ''}`}
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="role">Role</label>
              <select
                id="role"
                name="role"
                className={`form-select ${errors.role ? 'input-error' : ''}`}
                value={form.role}
                onChange={handleChange}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {errors.role && <span className="field-error">{errors.role}</span>}
            </div>

            <AnimatePresence>
              {isRegister && form.role === 'PATIENT' && (
                <motion.div
                  className="form-group"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <label className="form-label" htmlFor="patientId">Patient ID</label>
                  <input
                    id="patientId"
                    name="patientId"
                    type="text"
                    className={`form-input ${errors.patientId ? 'input-error' : ''}`}
                    placeholder="e.g. P-1001"
                    value={form.patientId}
                    onChange={handleChange}
                  />
                  {errors.patientId && <span className="field-error">{errors.patientId}</span>}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              id="auth-submit-btn"
              className="btn-primary btn-full"
              disabled={loading}
            >
              {loading ? (
                <span className="btn-loading">
                  <span className="btn-spinner" /> {isRegister ? 'Creating...' : 'Signing in...'}
                </span>
              ) : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="login-toggle">
            <span>{isRegister ? 'Already have an account?' : "Don't have an account?"}</span>
            <button
              type="button"
              className="toggle-btn"
              onClick={() => {
                setIsRegister((v) => !v);
                setErrors({});
                setApiError('');
                setSuccessMsg('');
              }}
            >
              {isRegister ? 'Sign In' : 'Register'}
            </button>
          </div>

        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
