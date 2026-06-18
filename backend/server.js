const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5001;

// Request Logging Middleware
app.use((req, res, next) => {
  console.log(`[SERVER LOG] ${req.method} ${req.url}`);
  next();
});

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Initialize Database
db.initDb();

// --- API ROUTES ---

// 1. Get all maids with basic stats
app.get('/api/maids', (req, res) => {
  try {
    const maids = db.getAllMaids();
    res.json(maids);
  } catch (err) {
    console.error('Error fetching maids:', err);
    res.status(500).json({ error: 'Failed to fetch maids' });
  }
});

// 2. Get specific maid with full details and attendance history
app.get('/api/maids/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const maid = db.getMaidById(id);
    if (!maid) {
      return res.status(404).json({ error: 'Maid not found' });
    }
    const attendance = db.getMaidAttendance(id);
    res.json({
      ...maid,
      attendance
    });
  } catch (err) {
    console.error('Error fetching maid details:', err);
    res.status(500).json({ error: 'Failed to fetch maid details' });
  }
});

// 3. Add a new maid profile
app.post('/api/maids', (req, res) => {
  try {
    const { name, phone, role, salary, joining_date } = req.body;
    if (!name || salary === undefined || !joining_date) {
      return res.status(400).json({ error: 'Name, salary, and joining date are required' });
    }
    const newMaid = db.insertMaid(name, phone || '', role || '', parseFloat(salary), joining_date);
    res.status(201).json(newMaid);
  } catch (err) {
    console.error('Error creating maid:', err);
    res.status(500).json({ error: 'Failed to create maid profile' });
  }
});

// 4. Update an existing maid profile
app.put('/api/maids/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, role, salary, joining_date } = req.body;
    if (!name || salary === undefined || !joining_date) {
      return res.status(400).json({ error: 'Name, salary, and joining date are required' });
    }
    const updated = db.updateMaid(id, name, phone || '', role || '', parseFloat(salary), joining_date);
    res.json(updated);
  } catch (err) {
    console.error('Error updating maid:', err);
    res.status(500).json({ error: 'Failed to update maid profile' });
  }
});

// 5. Delete a maid and their attendance history
app.delete('/api/maids/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.deleteMaid(id);
    res.json({ success: true, message: `Maid with id ${id} deleted successfully` });
  } catch (err) {
    console.error('Error deleting maid:', err);
    res.status(500).json({ error: 'Failed to delete maid' });
  }
});

// 6. Get attendance for all maids on a specific date (defaults to today)
app.get('/api/attendance', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const records = db.getAttendanceForDate(date);
    res.json(records);
  } catch (err) {
    console.error('Error fetching attendance:', err);
    res.status(500).json({ error: 'Failed to fetch attendance logs' });
  }
});

// 7. Record/Update attendance for a single maid on a specific date
app.post('/api/attendance', (req, res) => {
  try {
    const { maid_id, date, status, remarks } = req.body;
    if (!maid_id || !date || !status) {
      return res.status(400).json({ error: 'maid_id, date, and status are required' });
    }
    const record = db.saveAttendance(parseInt(maid_id), date, status, remarks);
    res.json(record);
  } catch (err) {
    console.error('Error saving attendance:', err);
    res.status(500).json({ error: 'Failed to save attendance record' });
  }
});

// 8. Record attendance for multiple maids in bulk (e.g. daily checkout)
app.post('/api/attendance/bulk', (req, res) => {
  try {
    const { date, records } = req.body; // records: [{ maid_id, status, remarks }]
    if (!date || !Array.isArray(records)) {
      return res.status(400).json({ error: 'date and records array are required' });
    }
    
    const saved = [];
    for (const rec of records) {
      if (rec.maid_id && rec.status) {
        const savedRec = db.saveAttendance(parseInt(rec.maid_id), date, rec.status, rec.remarks);
        saved.push(savedRec);
      }
    }
    res.json({ success: true, saved_count: saved.length, records: saved });
  } catch (err) {
    console.error('Error saving bulk attendance:', err);
    res.status(500).json({ error: 'Failed to save bulk attendance records' });
  }
});

// --- SERVE STATIC FRONTEND IN PRODUCTION ---
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
