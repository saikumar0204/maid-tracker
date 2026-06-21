import React, { useState } from 'react';

export default function MaidsList({ maids, onSelectMaid, onEditMaid, onDeleteMaid, onRegisterClick, onAttendanceChange }) {
  const [expandedMaidId, setExpandedMaidId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [remarks, setRemarks] = useState({});

  const todayStr = new Date().toISOString().split('T')[0];

  const getStatusLabel = (status) => {
    switch (status) {
      case 'present': return 'Present Today';
      case 'half_day': return 'Half Day Today';
      case 'absent': return 'Absent Today';
      case 'leave_paid': return 'Paid Leave Today';
      case 'leave_unpaid': return 'Unpaid Leave Today';
      default: return 'Not Marked';
    }
  };

  const getStatusEmoji = (status) => {
    switch (status) {
      case 'present': return '✓';
      case 'half_day': return '½';
      case 'absent': return '✗';
      case 'leave_paid': return '✈';
      case 'leave_unpaid': return '⏸';
      default: return '—';
    }
  };

  const getAttendancePercentage = (present, logged) => {
    if (!logged || logged === 0) return 0;
    return Math.round((present / logged) * 100);
  };

  const toggleAttendancePanel = (maidId) => {
    setExpandedMaidId(prev => prev === maidId ? null : maidId);
  };

  const handleMarkAttendance = async (maidId, status) => {
    setSavingId(maidId);
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maid_id: maidId,
          date: todayStr,
          status,
          remarks: remarks[maidId] || ''
        })
      });

      if (response.ok) {
        if (onAttendanceChange) onAttendanceChange();
      }
    } catch (err) {
      console.error('Error marking attendance:', err);
    } finally {
      setTimeout(() => setSavingId(null), 300);
    }
  };

  const handleRemarksSave = async (maidId, value, currentStatus) => {
    setRemarks(prev => ({ ...prev, [maidId]: value }));
    if (!currentStatus) return;
    try {
      await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maid_id: maidId,
          date: todayStr,
          status: currentStatus,
          remarks: value
        })
      });
    } catch (err) {
      console.error('Error saving remarks:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Active Maids ({maids.length})</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Manage profiles, mark attendance, and review recent summary.
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
            const isExpanded = expandedMaidId === maid.id;
            const isSaving = savingId === maid.id;
            
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
                    <span className="info-label">Base Salary:</span>
                    <span className="info-value">
                      ₹{maid.salary.toLocaleString()}/mo
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">This Month's Pay:</span>
                    <span className="info-value" style={{ color: 'var(--color-present)', fontWeight: 600 }}>
                      ₹{maid.this_month_payable?.toLocaleString()}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Joined:</span>
                    <span className="info-value">{maid.joining_date}</span>
                  </div>
                </div>

                {/* Today's Status Banner */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 0.85rem',
                  borderRadius: 'var(--border-radius-sm)',
                  background: statusClass !== 'unknown' 
                    ? `var(--color-${statusClass === 'leave_paid' ? 'leave-paid' : statusClass === 'leave_unpaid' ? 'leave-unpaid' : statusClass === 'half_day' ? 'half-day' : statusClass}-glow, rgba(255,255,255,0.02))`
                    : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${statusClass !== 'unknown' 
                    ? `var(--color-${statusClass === 'leave_paid' ? 'leave-paid' : statusClass === 'leave_unpaid' ? 'leave-unpaid' : statusClass === 'half_day' ? 'half-day' : statusClass}-border, var(--border-card))`
                    : 'var(--border-card)'}`,
                  fontSize: '0.85rem',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '1rem' }}>{getStatusEmoji(maid.status_today)}</span>
                    <span style={{ 
                      fontWeight: 600, 
                      color: statusClass !== 'unknown' 
                        ? `var(--color-${statusClass === 'leave_paid' ? 'leave-paid' : statusClass === 'leave_unpaid' ? 'leave-unpaid' : statusClass === 'half_day' ? 'half-day' : statusClass}, var(--text-secondary))`
                        : 'var(--text-secondary)'
                    }}>
                      {getStatusLabel(maid.status_today)}
                    </span>
                    {isSaving && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>(saving...)</span>}
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

                {/* Expandable Attendance Panel */}
                {isExpanded && (
                  <div style={{
                    padding: '1rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-card)',
                    borderRadius: 'var(--border-radius-sm)',
                    animation: 'fadeIn 0.2s ease-out',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Mark for Today ({todayStr})
                      </h4>
                    </div>
                    
                    <div className="attendance-options" style={{ flexWrap: 'wrap' }}>
                      <button 
                        className={`status-btn ${maid.status_today === 'present' ? 'selected present' : ''}`}
                        onClick={() => handleMarkAttendance(maid.id, 'present')}
                      >
                        Present
                      </button>
                      <button 
                        className={`status-btn ${maid.status_today === 'half_day' ? 'selected half_day' : ''}`}
                        onClick={() => handleMarkAttendance(maid.id, 'half_day')}
                      >
                        Half Day
                      </button>
                      <button 
                        className={`status-btn ${maid.status_today === 'absent' ? 'selected absent' : ''}`}
                        onClick={() => handleMarkAttendance(maid.id, 'absent')}
                      >
                        Absent
                      </button>
                      <button 
                        className={`status-btn ${maid.status_today === 'leave_paid' ? 'selected leave_paid' : ''}`}
                        onClick={() => handleMarkAttendance(maid.id, 'leave_paid')}
                      >
                        Paid Leave
                      </button>
                      <button 
                        className={`status-btn ${maid.status_today === 'leave_unpaid' ? 'selected leave_unpaid' : ''}`}
                        onClick={() => handleMarkAttendance(maid.id, 'leave_unpaid')}
                      >
                        Unpaid Leave
                      </button>
                    </div>

                    <input 
                      type="text" 
                      placeholder="Add a note (optional)..." 
                      className="form-input" 
                      style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                      defaultValue={remarks[maid.id] || ''}
                      onBlur={(e) => handleRemarksSave(maid.id, e.target.value, maid.status_today)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRemarksSave(maid.id, e.target.value, maid.status_today);
                          e.target.blur();
                        }
                      }}
                    />
                  </div>
                )}

                <div className="maid-card-footer">
                  <button 
                    type="button"
                    className={`btn ${isExpanded ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleAttendancePanel(maid.id);
                    }}
                  >
                    {isExpanded ? '✓ Marking' : '📋 Mark Attendance'}
                  </button>
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
