import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import Sidebar from '../components/Sidebar.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { adminService } from '../services/adminService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const SIDEBAR_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/transfers', label: 'Transfers', icon: '🔄' },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: '📋' },
];

const FILTER_OPTIONS = ['ALL', 'SUCCESS', 'PENDING', 'FAILED'];

const AdminDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [transfers, setTransfers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [healthData, setHealthData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('transfers');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [logSearch, setLogSearch] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [t, a, h] = await Promise.all([
          adminService.getAllTransfers(),
          adminService.getAuditLogs(),
          adminService.getSystemHealth(),
        ]);
        setTransfers(t);
        setAuditLogs(a);
        setHealthData(h);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const filteredTransfers =
    statusFilter === 'ALL'
      ? transfers
      : transfers.filter((t) => t.status === statusFilter);

  const filteredLogs = auditLogs.filter((log) => {
    const q = logSearch.toLowerCase();
    return (
      !q ||
      log.user?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q) ||
      log.resource?.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: transfers.length,
    success: transfers.filter((t) => t.status === 'SUCCESS').length,
    pending: transfers.filter((t) => t.status === 'PENDING').length,
    failed: transfers.filter((t) => t.status === 'FAILED').length,
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="dashboard-layout">
      <Sidebar items={SIDEBAR_ITEMS} />

      <div className="dashboard-main">
        {/* Top bar */}
        <header className="dashboard-topbar">
          <div>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-subtitle">System overview & transfer management</p>
          </div>
          <div className="topbar-actions">
            <span className="system-status-indicator">
              <span className="pulse-dot" /> System Operational
            </span>
            <button className="btn-outline" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        {loading ? (
          <div className="page-loading"><LoadingSpinner message="Loading system data..." /></div>
        ) : (
          <motion.div
            className="page-content"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Stats Row */}
            <div className="stats-grid">
              {[
                { label: 'Total Transfers', value: stats.total, icon: '🔄', color: 'purple' },
                { label: 'Successful', value: stats.success, icon: '✅', color: 'green' },
                { label: 'Pending', value: stats.pending, icon: '⏳', color: 'amber' },
                { label: 'Failed', value: stats.failed, icon: '❌', color: 'red' },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  className={`stat-card stat-card--${s.color}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </motion.div>
              ))}
            </div>

            {/* System Health Chart */}
            <div className="card chart-card">
              <div className="card-header">
                <h2 className="card-title">📈 System Health — Weekly Transfer Activity</h2>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={healthData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTransfer" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C6FCD" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#7C6FCD" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="transfers" stroke="#7C6FCD" strokeWidth={2.5} fill="url(#colorTransfer)" name="Transfers" />
                    <Area type="monotone" dataKey="failures" stroke="#ef4444" strokeWidth={2} fill="url(#colorFailed)" name="Failures" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tab nav */}
            <div className="tab-nav">
              <button
                className={`tab-btn ${activeTab === 'transfers' ? 'tab-btn--active' : ''}`}
                onClick={() => setActiveTab('transfers')}
              >
                🔄 Hospital Transfers
              </button>
              <button
                className={`tab-btn ${activeTab === 'audit' ? 'tab-btn--active' : ''}`}
                onClick={() => setActiveTab('audit')}
              >
                📋 Audit Logs
              </button>
            </div>

            {/* Transfers Table */}
            {activeTab === 'transfers' && (
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">🏥 All Hospital Transfers</h2>
                  <div className="filter-pills">
                    {FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        className={`filter-pill ${statusFilter === opt ? 'filter-pill--active' : ''}`}
                        onClick={() => setStatusFilter(opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Patient ID</th>
                        <th>Source</th>
                        <th>Target</th>
                        <th>Resources</th>
                        <th>Status</th>
                        <th>Timestamp</th>
                        <th>Failure Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransfers.length === 0 ? (
                        <tr><td colSpan={8} className="table-empty">No transfers found</td></tr>
                      ) : (
                        filteredTransfers.map((t) => (
                          <tr key={t.id} className="table-row">
                            <td className="table-id">#{t.id}</td>
                            <td><span className="patient-id-tag">{t.patientId}</span></td>
                            <td>{t.sourceHospital}</td>
                            <td>{t.targetHospital}</td>
                            <td>{t.bundleResourceCount}</td>
                            <td><StatusBadge status={t.status} /></td>
                            <td className="timestamp">{new Date(t.timestamp).toLocaleString()}</td>
                            <td className="failure-reason">{t.failureReason || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Audit Logs Table */}
            {activeTab === 'audit' && (
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">📋 System Audit Logs</h2>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search by user, action, resource..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                  />
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Resource</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.length === 0 ? (
                        <tr><td colSpan={5} className="table-empty">No logs match your search</td></tr>
                      ) : (
                        filteredLogs.map((log) => (
                          <tr key={log.id} className="table-row">
                            <td className="timestamp">{new Date(log.timestamp).toLocaleString()}</td>
                            <td><span className="user-tag">@{log.user}</span></td>
                            <td><span className="action-tag">{log.action}</span></td>
                            <td>{log.resource}</td>
                            <td><StatusBadge status={log.status} /></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
