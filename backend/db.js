const { createClient } = require('@libsql/client');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.sqlite');

// For local file, libsql requires 'file:' prefix. If it's a URL (Turso), use as is.
const url = dbPath.includes('://') || dbPath.startsWith('file:') 
  ? dbPath 
  : `file:${dbPath}`;

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
const hasTurso = !!(process.env.TURSO_DATABASE_URL || process.env.STORAGE_URL);

let db;

if (isVercel && !hasTurso) {
  console.warn("WARNING: Running on Vercel but TURSO_DATABASE_URL / STORAGE_URL is not configured. Direct SQLite writes will be disabled. Connect Turso in the Vercel Storage tab.");
  db = {
    execute: async () => {
      throw new Error("Database not initialized. Please go to your Vercel Project -> Storage tab and connect Turso SQLite to configure your production database.");
    },
    batch: async () => {
      throw new Error("Database not initialized. Please go to your Vercel Project -> Storage tab and connect Turso SQLite to configure your production database.");
    }
  };
} else {
  db = createClient({
    url: process.env.TURSO_DATABASE_URL || process.env.STORAGE_URL || url,
    authToken: process.env.TURSO_AUTH_TOKEN || process.env.STORAGE_AUTH_TOKEN || ''
  });
}

// Initialize Tables
async function initDb() {
  await db.execute(`
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

  await db.execute(`
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
  
  const result = await db.execute('SELECT COUNT(*) as count FROM maids');
  const count = result.rows[0]?.count || 0;
  if (count === 0) {
    await seedData();
  }
}

async function seedData() {
  // Insert some sample maids
  const maids = [
    { name: 'Kavitha Sharma', phone: '9876543210', role: 'Cleaning & Dusting', salary: 4500, joining_date: '2025-01-15' },
    { name: 'Lakshmi Devi', phone: '9876543211', role: 'Cooking & Meals', salary: 6000, joining_date: '2025-02-10' },
    { name: 'Rani Kumari', phone: '9876543212', role: 'Laundry & Ironing', salary: 3000, joining_date: '2025-05-01' }
  ];

  const maidIds = [];
  for (const m of maids) {
    const res = await db.execute({
      sql: `INSERT INTO maids (name, phone, role, salary, joining_date) VALUES (?, ?, ?, ?, ?)`,
      args: [m.name, m.phone, m.role, m.salary, m.joining_date]
    });
    maidIds.push(Number(res.lastInsertRowid));
  }

  // Seed attendance for the last 35 days
  const today = new Date();
  const attendanceStatements = [];
  for (let i = 0; i < 35; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    // Kavitha (usually present, occasional absent on Sundays)
    const dayOfWeek = d.getDay();
    attendanceStatements.push({
      sql: `INSERT INTO attendance (maid_id, date, status, remarks) VALUES (?, ?, ?, ?)`,
      args: [maidIds[0], dateStr, dayOfWeek === 0 ? 'absent' : 'present', dayOfWeek === 0 ? 'Sunday off' : '']
    });

    // Lakshmi (present, had 2 unpaid leaves and 1 paid leave)
    let status = 'present';
    let remark = '';
    if (i === 5) {
      status = 'leave_paid';
      remark = 'Sick leave';
    } else if (i === 12 || i === 13) {
      status = 'leave_unpaid';
      remark = 'Out of town';
    }
    attendanceStatements.push({
      sql: `INSERT INTO attendance (maid_id, date, status, remarks) VALUES (?, ?, ?, ?)`,
      args: [maidIds[1], dateStr, status, remark]
    });

    // Rani (alternate days)
    attendanceStatements.push({
      sql: `INSERT INTO attendance (maid_id, date, status, remarks) VALUES (?, ?, ?, ?)`,
      args: [maidIds[2], dateStr, i % 2 === 0 ? 'present' : 'absent', i % 2 === 0 ? '' : 'No show']
    });
  }
  
  // Batch run in transaction
  await db.batch(attendanceStatements, "write");
}

async function getAllMaids(clientDate) {
  const dateStr = clientDate || new Date().toISOString().split('T')[0];
  const dateObj = new Date(dateStr);
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth(); // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const result = await db.execute({
    sql: `
      SELECT m.*,
        (SELECT COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1.0 WHEN a.status = 'half_day' THEN 0.5 ELSE 0 END), 0) FROM attendance a WHERE a.maid_id = m.id AND a.date >= date(?, '-30 days') AND a.date <= ?) as present_days_30_days,
        (SELECT COUNT(*) FROM attendance a WHERE a.maid_id = m.id AND a.date >= date(?, '-30 days') AND a.date <= ?) as logged_days_30_days,
        (SELECT status FROM attendance a WHERE a.maid_id = m.id AND a.date = ?) as status_today,
        (SELECT COALESCE(SUM(CASE WHEN a.status = 'absent' THEN 1.0 WHEN a.status = 'leave_unpaid' THEN 1.0 WHEN a.status = 'half_day' THEN 0.5 ELSE 0 END), 0) FROM attendance a WHERE a.maid_id = m.id AND a.date >= ? AND a.date <= ?) as current_month_unpaid_days
      FROM maids m
    `,
    args: [dateStr, dateStr, dateStr, dateStr, dateStr, startOfMonth, endOfMonth]
  });

  return result.rows.map(r => {
    const row = { ...r };
    const unpaidDays = Number(row.current_month_unpaid_days || 0);
    const dailyRate = row.salary / daysInMonth;
    const deductions = unpaidDays * dailyRate;
    row.this_month_payable = Math.max(0, Math.round(row.salary - deductions));
    return row;
  });
}

async function getMaidById(id) {
  const result = await db.execute({
    sql: 'SELECT * FROM maids WHERE id = ?',
    args: [id]
  });
  return result.rows[0] ? { ...result.rows[0] } : null;
}

async function getMaidAttendance(maidId) {
  const result = await db.execute({
    sql: 'SELECT * FROM attendance WHERE maid_id = ? ORDER BY date DESC',
    args: [maidId]
  });
  return result.rows.map(r => ({ ...r }));
}

async function getAttendanceForDate(date) {
  const result = await db.execute({
    sql: 'SELECT * FROM attendance WHERE date = ?',
    args: [date]
  });
  return result.rows.map(r => ({ ...r }));
}

async function insertMaid(name, phone, role, salary, joiningDate) {
  const result = await db.execute({
    sql: `INSERT INTO maids (name, phone, role, salary, joining_date) VALUES (?, ?, ?, ?, ?)`,
    args: [name, phone, role, salary, joiningDate]
  });
  return { id: Number(result.lastInsertRowid), name, phone, role, salary, joining_date: joiningDate };
}

async function updateMaid(id, name, phone, role, salary, joiningDate) {
  await db.execute({
    sql: `UPDATE maids SET name = ?, phone = ?, role = ?, salary = ?, joining_date = ? WHERE id = ?`,
    args: [name, phone, role, salary, joiningDate, id]
  });
  return { id, name, phone, role, salary, joining_date: joiningDate };
}

async function deleteMaid(id) {
  await db.execute({
    sql: 'DELETE FROM maids WHERE id = ?',
    args: [id]
  });
  await db.execute({
    sql: 'DELETE FROM attendance WHERE maid_id = ?',
    args: [id]
  });
  return { success: true };
}

async function saveAttendance(maidId, date, status, remarks) {
  const existingRes = await db.execute({
    sql: 'SELECT id FROM attendance WHERE maid_id = ? AND date = ?',
    args: [maidId, date]
  });
  const existing = existingRes.rows[0];

  if (existing) {
    await db.execute({
      sql: `UPDATE attendance SET status = ?, remarks = ? WHERE id = ?`,
      args: [status, remarks || '', existing.id]
    });
    return { id: Number(existing.id), maid_id: maidId, date, status, remarks };
  } else {
    const insertRes = await db.execute({
      sql: `INSERT INTO attendance (maid_id, date, status, remarks) VALUES (?, ?, ?, ?)`,
      args: [maidId, date, status, remarks || '']
    });
    return { id: Number(insertRes.lastInsertRowid), maid_id: maidId, date, status, remarks };
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
