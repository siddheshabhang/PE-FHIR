import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleLinks = () => {
    if (!user) return [];
    switch (user.role) {
      case 'ADMIN':
        return [{ label: 'Dashboard', to: '/admin/dashboard' }];
      case 'DOCTOR':
        return [{ label: 'Dashboard', to: '/doctor/dashboard' }];
      case 'PATIENT':
        return [{ label: 'Dashboard', to: '/patient/dashboard' }];
      default:
        return [];
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">⚕️</span>
        <span className="brand-text">HealthBridge</span>
        <span className="brand-subtitle">FHIR Interoperability</span>
      </div>
      <div className="navbar-links">
        {isAuthenticated &&
          getRoleLinks().map((link) => (
            <Link key={link.to} to={link.to} className="nav-link">
              {link.label}
            </Link>
          ))}
      </div>
      <div className="navbar-right">
        {isAuthenticated && user ? (
          <>
            <div className="user-pill">
              <span className="user-avatar">{user.username?.[0]?.toUpperCase()}</span>
              <div className="user-info">
                <span className="user-name">{user.username}</span>
                <span className="user-role">{user.role}</span>
              </div>
            </div>
            <button className="btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <Link to="/login" className="btn-login-link">
            Login
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
