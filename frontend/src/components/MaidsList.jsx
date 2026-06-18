import React from 'react';

export default function MaidsList({ maids, onSelectMaid, onEditMaid, onDeleteMaid, onRegisterClick }) {
  
  const getStatusLabel = (status) => {
    switch (status) {
      case 'present': return 'Present Today';
      case 'absent': return 'Absent Today';
      case 'leave_paid': return 'Paid Leave Today';
      case 'leave_unpaid': return 'Unpaid Leave Today';
      default: return 'No Status Today';
    }
  };

  const getAttendancePercentage = (present, logged) => {
    if (!logged || logged === 0) return 0;
    return Math.round((present / logged) * 100);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Active Maids ({maids.length})</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Manage profiles and review recent attendance summary.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onRegisterClick}>
          <span>+</span> Register New Maid
        </button>
      </div>

      {maids.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <h3>No Maids Registered Yet</h3>
          <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            Add your first helper to start tracking their attendance and calculating monthly salary.
          </p>
          <button className="btn btn-primary" onClick={onRegisterClick}>Register First Maid</button>
        </div>
      ) : (
        <div className="maids-grid">
          {maids.map((maid) => {
            const initial = maid.name.charAt(0).toUpperCase();
            const statusClass = maid.status_today || 'unknown';
            
            return (
              <div key={maid.id} className="maid-card">
                <div className="maid-card-header">
                  <div className="maid-avatar">{initial}</div>
                  <div className="maid-meta">
                    <h3 className="maid-name">{maid.name}</h3>
                    <div className="maid-role">{maid.role || 'General Helper'}</div>
                  </div>
                  <span 
                    className={`status-indicator ${statusClass}`} 
                    title={getStatusLabel(statusClass)}
                  />
                </div>

                <div className="info-list" style={{ fontSize: '0.9rem' }}>
                  <div className="info-row">
                    <span className="info-label">Phone:</span>
                    <span className="info-value">{maid.phone || 'N/A'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Monthly Salary:</span>
                    <span className="info-value" style={{ color: '#fff', fontWeight: 600 }}>
                      ₹{maid.salary.toLocaleString()}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Joined:</span>
                    <span className="info-value">{maid.joining_date}</span>
                  </div>
                </div>

                <div className="maid-card-stats">
                  <div className="stat-box">
                    <span className="stat-label">Last 30 Days</span>
                    <span className="stat-value" style={{ color: 'var(--color-present)' }}>
                      {maid.present_days_30_days || 0} / 30 Days
                    </span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Recent Rate</span>
                    <span className="stat-value" style={{ color: 'var(--primary)' }}>
                      {getAttendancePercentage(maid.present_days_30_days, maid.logged_days_30_days)}%
                    </span>
                  </div>
                </div>

                <div className="maid-card-footer">
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectMaid(maid.id);
                    }}
                  >
                    View History
                  </button>
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onEditMaid(maid);
                    }}
                  >
                    Edit
                  </button>
                  <button 
                    type="button"
                    className="btn btn-danger" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDeleteMaid(maid.id, maid.name);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
