import React, { useState, useEffect } from 'react';

export default function MaidModal({ isOpen, onClose, onSubmit, maid }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [salary, setSalary] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (maid) {
      setName(maid.name || '');
      setPhone(maid.phone || '');
      setRole(maid.role || '');
      setSalary(maid.salary || '');
      setJoiningDate(maid.joining_date || '');
    } else {
      setName('');
      setPhone('');
      setRole('');
      setSalary('');
      // Default to today
      setJoiningDate(new Date().toISOString().split('T')[0]);
    }
    setError('');
  }, [maid, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!salary || parseFloat(salary) <= 0) {
      setError('Please enter a valid monthly salary');
      return;
    }
    if (!joiningDate) {
      setError('Please enter a joining date');
      return;
    }

    onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      role: role.trim(),
      salary: parseFloat(salary),
      joining_date: joiningDate
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{maid ? 'Edit Maid Details' : 'Register New Maid'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div style={{ color: 'var(--color-absent)', fontSize: '0.9rem', padding: '0.5rem', background: 'var(--color-absent-glow)', border: '1px solid var(--color-absent-border)', borderRadius: 'var(--border-radius-sm)' }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Name *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Kavitha Sharma" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input 
              type="tel" 
              className="form-input" 
              placeholder="e.g. 9876543210" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Role / Type of Work</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Cleaning, Cooking, All-rounder" 
              value={role} 
              onChange={(e) => setRole(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Monthly Salary (INR) *</label>
            <input 
              type="number" 
              className="form-input" 
              placeholder="e.g. 5000" 
              value={salary} 
              onChange={(e) => setSalary(e.target.value)} 
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Joining Date *</label>
            <input 
              type="date" 
              className="form-input" 
              value={joiningDate} 
              onChange={(e) => setJoiningDate(e.target.value)} 
              required
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{maid ? 'Update Details' : 'Register Maid'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
