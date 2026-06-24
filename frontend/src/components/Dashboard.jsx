import React, { useState, useEffect } from 'react';

export default function Dashboard({ maids, onSelectMaid, onAttendanceChange }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [savingId, setSavingId] = useState(null); // track which maid status is saving
  const [isTriggeringAll, setIsTriggeringAll] = useState(false);

  // Fetch attendance for the selected date
  const fetchAttendance = async (date) => {
    try {
      const res = await fetch(`/api/attendance?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setAttendanceRecords(data);
      }
    } catch (err) {
      console.error('Error fetching attendance for date:', err);
    }
  };

  useEffect(() => {
    fetchAttendance(selectedDate);

    // Setup SSE connection for real-time updates
    const eventSource = new EventSource('/api/attendance/stream');
    eventSource.onmessage = (event) => {
      try {
        const updatedRecord = JSON.parse(event.data);
        if (updatedRecord.date === selectedDate) {
          setAttendanceRecords(prev => {
            const idx = prev.findIndex(r => r.maid_id === updatedRecord.maid_id);
            if (idx > -1) {
              const copy = [...prev];
              copy[idx] = updatedRecord;
              return copy;
            } else {
              return [...prev, updatedRecord];
            }
          });
          if (onAttendanceChange) onAttendanceChange();
        }
      } catch (e) {
        console.error('Error parsing SSE data', e);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [selectedDate, maids]);

  // Aggregate stats for the selected date
  const getDateStats = () => {
    let present = 0;
    let absent = 0;
    let leaves = 0;
    let halfDays = 0;

    attendanceRecords.forEach(r => {
      if (r.status === 'present') present++;
      else if (r.status === 'absent') absent++;
      else if (r.status === 'half_day') halfDays++;
      else if (r.status === 'leave_paid' || r.status === 'leave_unpaid') leaves++;
    });

    return {
      total: maids.length,
      present,
      absent,
      leaves,
      halfDays,
      unmarked: Math.max(0, maids.length - (present + absent + leaves + halfDays))
    };
  };

  const stats = getDateStats();

  // Handle status update (instant save)
  const handleStatusChange = async (maidId, status, existingRemarks = '') => {
    setSavingId(maidId);
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maid_id: maidId,
          date: selectedDate,
          status,
          remarks: existingRemarks
        })
      });

      if (response.ok) {
        const updatedRecord = await response.json();
        // Update local list
        setAttendanceRecords(prev => {
          const idx = prev.findIndex(r => r.maid_id === maidId);
          if (idx > -1) {
            const copy = [...prev];
            copy[idx] = updatedRecord;
            return copy;
          } else {
            return [...prev, updatedRecord];
          }
        });
        // Notify parent to update 30-day stats
        if (onAttendanceChange) onAttendanceChange();
      }
    } catch (err) {
      console.error('Error saving attendance:', err);
    } finally {
      // Simulate quick visual transition
      setTimeout(() => setSavingId(null), 300);
    }
  };

  // Handle remarks change (saves on blur or enter key)
  const handleRemarksSave = async (maidId, remarks, status) => {
    if (!status) return; // don't save remarks if no status is marked yet
    try {
      await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maid_id: maidId,
          date: selectedDate,
          status,
          remarks
        })
      });
    } catch (err) {
      console.error('Error saving remarks:', err);
    }
  };

  const handleTriggerAll = async () => {
    setIsTriggeringAll(true);
    try {
      const res = await fetch('/api/whatsapp/trigger', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Empty body triggers all
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message || 'WhatsApp reminders sent to all owners!');
      } else {
        const err = await res.json();
        alert('Failed: ' + err.error);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to trigger messages');
    }
    setIsTriggeringAll(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* 1. Header Metrics Row */}
      <div className="dashboard-grid">
        <div className="metric-card">
          <div className="metric-details">
            <h3>Total Maids</h3>
            <div className="metric-value">{stats.total}</div>
          </div>
          <div className="metric-icon" style={{ color: 'var(--primary)' }}>👥</div>
        </div>

        <div className="metric-card">
          <div className="metric-details">
            <h3>Present</h3>
            <div className="metric-value" style={{ color: 'var(--color-present)' }}>{stats.present}</div>
          </div>
          <div className="metric-icon" style={{ color: 'var(--color-present)' }}>✓</div>
        </div>

        <div className="metric-card">
          <div className="metric-details">
            <h3>Absent</h3>
            <div className="metric-value" style={{ color: 'var(--color-absent)' }}>{stats.absent}</div>
          </div>
          <div className="metric-icon" style={{ color: 'var(--color-absent)' }}>✗</div>
        </div>

        <div className="metric-card">
          <div className="metric-details">
            <h3>On Leave</h3>
            <div className="metric-value" style={{ color: 'var(--color-leave-paid)' }}>{stats.leaves}</div>
          </div>
          <div className="metric-icon" style={{ color: 'var(--color-leave-paid)' }}>✈</div>
        </div>

        <div className="metric-card">
          <div className="metric-details">
            <h3>Half Day</h3>
            <div className="metric-value" style={{ color: 'var(--color-half-day)' }}>{stats.halfDays}</div>
          </div>
          <div className="metric-icon" style={{ color: 'var(--color-half-day)' }}>½</div>
        </div>
      </div>

      {/* 2. Main Daily Log Layout */}
      <div className="main-layout">
        
        {/* Left Side: Daily Attendance List */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem' }}>Daily Attendance Sheet</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Select a date and click to record presence or leaves instantly.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button 
                className="btn btn-primary" 
                style={{ background: 'var(--success)' }}
                onClick={handleTriggerAll}
                disabled={isTriggeringAll}
              >
                {isTriggeringAll ? 'Sending...' : 'Send WhatsApp to All Owners'}
              </button>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
                <label className="form-label" style={{ margin: 0 }}>Date:</label>
                <input 
                  type="date" 
                  className="form-input" 
                  style={{ padding: '0.5rem' }} 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {maids.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No maids registered. Go to the "Maids" tab to register.
            </div>
          ) : (
            <div className="attendance-list">
              {maids.map((maid) => {
                const record = attendanceRecords.find(r => r.maid_id === maid.id);
                const currentStatus = record ? record.status : null;
                const currentRemarks = record ? record.remarks : '';
                const isSaving = savingId === maid.id;

                return (
                  <div key={maid.id} className="attendance-item">
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span 
                        style={{ fontWeight: 600, fontSize: '1.05rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        onClick={() => onSelectMaid(maid.id)}
                      >
                        {maid.name} 
                        {isSaving && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>(saving...)</span>}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{maid.role || 'Helper'}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <div className="attendance-options">
                        <button 
                          className={`status-btn ${currentStatus === 'present' ? 'selected present' : ''}`}
                          onClick={() => handleStatusChange(maid.id, 'present', currentRemarks)}
                        >
                          Present
                        </button>
                        <button 
                          className={`status-btn ${currentStatus === 'half_day' ? 'selected half_day' : ''}`}
                          onClick={() => handleStatusChange(maid.id, 'half_day', currentRemarks)}
                        >
                          Half Day
                        </button>
                        <button 
                          className={`status-btn ${currentStatus === 'absent' ? 'selected absent' : ''}`}
                          onClick={() => handleStatusChange(maid.id, 'absent', currentRemarks)}
                        >
                          Absent
                        </button>
                        <button 
                          className={`status-btn ${currentStatus === 'leave_paid' ? 'selected leave_paid' : ''}`}
                          onClick={() => handleStatusChange(maid.id, 'leave_paid', currentRemarks)}
                        >
                          Paid Leave
                        </button>
                        <button 
                          className={`status-btn ${currentStatus === 'leave_unpaid' ? 'selected leave_unpaid' : ''}`}
                          onClick={() => handleStatusChange(maid.id, 'leave_unpaid', currentRemarks)}
                        >
                          Unpaid Leave
                        </button>
                      </div>

                      <input 
                        type="text" 
                        placeholder="Add note..." 
                        className="form-input" 
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '160px', opacity: currentStatus ? 1 : 0.5 }}
                        disabled={!currentStatus}
                        defaultValue={currentRemarks}
                        onBlur={(e) => handleRemarksSave(maid.id, e.target.value, currentStatus)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRemarksSave(maid.id, e.target.value, currentStatus);
                            e.target.blur();
                          }
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Legend & Quick Guideline Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Legend & Quick Help</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span className="status-indicator present" style={{ marginTop: '5px' }}></span>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Present</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Helper came for work. Standard full day pay.</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span className="status-indicator absent" style={{ marginTop: '5px' }}></span>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Absent</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No show without advance permission. Deducts salary.</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span className="status-indicator leave_paid" style={{ marginTop: '5px' }}></span>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Paid Leave</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Approved holiday. No deduction from monthly salary.</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span className="status-indicator leave_unpaid" style={{ marginTop: '5px' }}></span>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Unpaid Leave</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Informed leave. Deducts daily rate from monthly salary.</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span className="status-indicator half_day" style={{ marginTop: '5px' }}></span>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Half Day</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Worked partial day. Deducts half the daily rate from salary.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Instant Calculations</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
              Salary deductions are computed instantly based on calendar days for the current month.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
              Click on a helper's name to see their full interactive month calendar, log notes, and export breakdown details.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
