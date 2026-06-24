import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import MaidsList from './components/MaidsList';
import MaidDetails from './components/MaidDetails';
import MaidModal from './components/MaidModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('maids'); // 'dashboard' | 'maids' | 'profile-detail'
  const [maids, setMaids] = useState([]);
  const [selectedMaidId, setSelectedMaidId] = useState(null);
  
  // Modals status
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [maidToEdit, setMaidToEdit] = useState(null);
  
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [maidToDelete, setMaidToDelete] = useState(null);

  // Fetch all maids
  const fetchMaids = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/maids?date=${todayStr}`);
      if (res.ok) {
        const data = await res.json();
        setMaids(data);
      }
    } catch (err) {
      console.error('Failed to fetch maids list:', err);
    }
  };

  useEffect(() => {
    fetchMaids();
  }, [activeTab]); // Refetch when changing tabs to keep stats updated

  // Navigation handlers
  const handleSelectMaid = (id) => {
    setSelectedMaidId(id);
    setActiveTab('profile-detail');
  };

  const handleBackToMaids = () => {
    setSelectedMaidId(null);
    setActiveTab('maids');
    fetchMaids(); // refresh list stats
  };

  // Add Maid
  const handleAddMaid = async (maidData) => {
    try {
      const res = await fetch('/api/maids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maidData)
      });
      if (res.ok) {
        setIsAddOpen(false);
        fetchMaids();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add maid profile');
      }
    } catch (err) {
      console.error('Error adding maid:', err);
    }
  };

  // Edit Maid
  const handleEditClick = (maid) => {
    setMaidToEdit(maid);
    setIsEditOpen(true);
  };

  const handleUpdateMaid = async (updatedData) => {
    try {
      const res = await fetch(`/api/maids/${maidToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      if (res.ok) {
        setIsEditOpen(false);
        setMaidToEdit(null);
        fetchMaids();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update maid profile');
      }
    } catch (err) {
      console.error('Error updating maid:', err);
    }
  };

  // Delete Maid
  const handleDeleteClick = (id, name) => {
    setMaidToDelete({ id, name });
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!maidToDelete) return;
    try {
      const res = await fetch(`/api/maids/${maidToDelete.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setIsDeleteOpen(false);
        setMaidToDelete(null);
        fetchMaids();
      } else {
        alert('Failed to delete maid');
      }
    } catch (err) {
      console.error('Error deleting maid:', err);
    }
  };

  const handleTabClick = (tab) => {
    if (tab === 'maids' && activeTab === 'profile-detail') {
      handleBackToMaids();
    } else {
      setActiveTab(tab);
    }
  };

  return (
    <div className="app-container">
      {/* App Navigation Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">H</div>
          <h1 className="brand-title">HelperFlow</h1>
        </div>

        <nav className="nav-tabs">
          <button 
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleTabClick('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`nav-tab ${activeTab === 'maids' || activeTab === 'profile-detail' ? 'active' : ''}`}
            onClick={() => handleTabClick('maids')}
          >
            Maids List
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main>
        {activeTab === 'dashboard' && (
          <Dashboard 
            maids={maids} 
            onSelectMaid={handleSelectMaid} 
            onAttendanceChange={fetchMaids}
          />
        )}

        {activeTab === 'maids' && (
          <MaidsList 
            maids={maids} 
            onSelectMaid={handleSelectMaid}
            onEditMaid={handleEditClick}
            onDeleteMaid={handleDeleteClick}
            onRegisterClick={() => setIsAddOpen(true)}
            onAttendanceChange={fetchMaids}
          />
        )}

        {activeTab === 'profile-detail' && (
          <MaidDetails 
            maidId={selectedMaidId} 
            onBack={handleBackToMaids} 
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav">
        <button 
          className={`bottom-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleTabClick('dashboard')}
        >
          <span className="nav-icon">📊</span>
          <span>Dashboard</span>
        </button>
        <button 
          className={`bottom-nav-item ${activeTab === 'maids' || activeTab === 'profile-detail' ? 'active' : ''}`}
          onClick={() => handleTabClick('maids')}
        >
          <span className="nav-icon">👥</span>
          <span>Maids</span>
        </button>
        <button 
          className="bottom-nav-item"
          onClick={() => setIsAddOpen(true)}
        >
          <span className="nav-icon">➕</span>
          <span>Add</span>
        </button>
      </nav>

      {/* Add Maid Dialog */}
      <MaidModal 
        isOpen={isAddOpen} 
        onClose={() => setIsAddOpen(false)} 
        onSubmit={handleAddMaid} 
      />

      {/* Edit Maid Dialog */}
      <MaidModal 
        isOpen={isEditOpen} 
        onClose={() => {
          setIsEditOpen(false);
          setMaidToEdit(null);
        }} 
        onSubmit={handleUpdateMaid} 
        maid={maidToEdit} 
      />

      {/* Custom Delete Confirmation Modal */}
      {isDeleteOpen && (
        <div className="modal-overlay" onClick={() => setIsDeleteOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ padding: '1.5rem 0 0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--color-absent-glow)',
                border: '1px solid var(--color-absent-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem'
              }}>
                🗑️
              </div>
              <h2 style={{ color: 'var(--color-absent)', fontSize: '1.2rem' }}>Remove Helper?</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
              Are you sure you want to remove <strong style={{ color: 'var(--text-primary)' }}>{maidToDelete?.name}</strong>? All attendance history will be permanently deleted.
            </p>
            <div className="form-actions" style={{ justifyContent: 'center', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setIsDeleteOpen(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleConfirmDelete}>Yes, Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
