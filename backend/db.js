const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.sqlite');
const db = new DatabaseSync(dbPath);

// Initialize Tables
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS maids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT,
      salary REAL NOT NULL,
      joining_date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maid_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      remarks TEXT,
      FOREIGN KEY (maid_id) REFERENCES maids(id) ON DELETE CASCADE,
      UNIQUE(maid_id, date)
    );
  `);
  
  // Seed initial data if the table is empty
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM maids');
  const result = countStmt.get();
  if (result.count === 0) {
    seedData();
  }
}

function seedData() {
  const insertMaid = db.prepare(`
    INSERT INTO maids (name, phone, role, salary, joining_date)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const insertAttendance = db.prepare(`
    INSERT INTO attendance (maid_id, date, status, remarks)
    VALUES (?, ?, ?, ?)
  `);

  // Insert some sample maids
  const maids = [
    { name: 'Kavitha Sharma', phone: '9876543210', role: 'Cleaning & Dusting', salary: 4500, joining_date: '2025-01-15' },
    { name: 'Lakshmi Devi', phone: '9876543211', role: 'Cooking & Meals', salary: 6000, joining_date: '2025-02-10' },
    { name: 'Rani Kumari', phone: '9876543212', role: 'Laundry & Ironing', salary: 3000, joining_date: '2025-05-01' }
  ];

  const maidIds = [];
  for (const m of maids) {
    const res = insertMaid.run(m.name, m.phone, m.role, m.salary, m.joining_date);
    maidIds.push(res.lastInsertRowid);
  }

  // Seed attendance for the last 35 days (some present, some absent, some leaves)
  const today = new Date();
  for (let i = 0; i < 35; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    // Kavitha (usually present, occasional absent on Sundays)
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0) {
      insertAttendance.run(maidIds[0], dateStr, 'absent', 'Sunday off');
    } else {
      insertAttendance.run(maidIds[0], dateStr, 'present', '');
    }

    // Lakshmi (present, had 2 unpaid leaves and 1 paid leave)
    if (i === 5) {
      insertAttendance.run(maidIds[1], dateStr, 'leave_paid', 'Sick leave');
    } else if (i === 12 || i === 13) {
      insertAttendance.run(maidIds[1], dateStr, 'leave_unpaid', 'Out of town');
    } else {
      insertAttendance.run(maidIds[1], dateStr, 'present', '');
    }

    // Rani (joined recently, or alternate days)
    if (i % 2 === 0) {
      insertAttendance.run(maidIds[2], dateStr, 'present', '');
    } else {
      insertAttendance.run(maidIds[2], dateStr, 'absent', 'No show');
    }
  }
}

// Helpers
function getAllMaids() {
  const stmt = db.prepare(`
    SELECT m.*,
      (SELECT COUNT(*) FROM attendance a WHERE a.maid_id = m.id AND a.status = 'present' AND a.date >= date('now', '-30 days')) as present_days_30_days,
      (SELECT COUNT(*) FROM attendance a WHERE a.maid_id = m.id AND a.date >= date('now', '-30 days')) as logged_days_30_days,
      (SELECT status FROM attendance a WHERE a.maid_id = m.id AND a.date = date('now', 'localtime')) as status_today
    FROM maids m
  `);
  return stmt.all();
}

function getMaidById(id) {
  const stmt = db.prepare('SELECT * FROM maids WHERE id = ?');
  return stmt.get(id);
}

function getMaidAttendance(maidId) {
  const stmt = db.prepare('SELECT * FROM attendance WHERE maid_id = ? ORDER BY date DESC');
  return stmt.all(maidId);
}

function getAttendanceForDate(date) {
  const stmt = db.prepare('SELECT * FROM attendance WHERE date = ?');
  return stmt.all(date);
}

function insertMaid(name, phone, role, salary, joiningDate) {
  const stmt = db.prepare(`
    INSERT INTO maids (name, phone, role, salary, joining_date)
    VALUES (?, ?, ?, ?, ?)
  `);
  const res = stmt.run(name, phone, role, salary, joiningDate);
  return { id: res.lastInsertRowid, name, phone, role, salary, joining_date: joiningDate };
}

function updateMaid(id, name, phone, role, salary, joiningDate) {
  const stmt = db.prepare(`
    UPDATE maids
    SET name = ?, phone = ?, role = ?, salary = ?, joining_date = ?
    WHERE id = ?
  `);
  stmt.run(name, phone, role, salary, joiningDate, id);
  return { id, name, phone, role, salary, joining_date: joiningDate };
}

function deleteMaid(id) {
  const stmt = db.prepare('DELETE FROM maids WHERE id = ?');
  stmt.run(id);
  // Also clean up orphan attendance records
  const cleanStmt = db.prepare('DELETE FROM attendance WHERE maid_id = ?');
  cleanStmt.run(id);
  return { success: true };
}

function saveAttendance(maidId, date, status, remarks) {
  // Check if attendance exists
  const checkStmt = db.prepare('SELECT id FROM attendance WHERE maid_id = ? AND date = ?');
  const existing = checkStmt.get(maidId, date);

  if (existing) {
    const updateStmt = db.prepare(`
      UPDATE attendance
      SET status = ?, remarks = ?
      WHERE id = ?
    `);
    updateStmt.run(status, remarks || '', existing.id);
    return { id: existing.id, maid_id: maidId, date, status, remarks };
  } else {
    const insertStmt = db.prepare(`
      INSERT INTO attendance (maid_id, date, status, remarks)
      VALUES (?, ?, ?, ?)
    `);
    const res = insertStmt.run(maidId, date, status, remarks || '');
    return { id: res.lastInsertRowid, maid_id: maidId, date, status, remarks };
  }
}

module.exports = {
  initDb,
  getAllMaids,
  getMaidById,
  getMaidAttendance,
  getAttendanceForDate,
  insertMaid,
  updateMaid,
  deleteMaid,
  saveAttendance
};
