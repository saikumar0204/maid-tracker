const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const cron = require('node-cron');

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
app.use(express.urlencoded({ extended: true }));

// SSE Clients
let sseClients = [];
function notifySseClients(data) {
  sseClients.forEach(client => client.write(`data: ${JSON.stringify(data)}\n\n`));
}

// Session Store for WhatsApp Conversational Flow
const whatsappSessions = {}; // { [phone]: { step: 1|2, maidId: null } }

// WhatsApp Cloud API Configuration
const WA_TOKEN = process.env.WA_ACCESS_TOKEN || 'EAASvcVJMZBWgBRZBv9iM2tl1vSuMo0WMicww56zRXlEgjHBaH0k1ZA9bOYjQCrPnX6vji27EJgoexyA8WV0znGU8XObXcl6u99f303isPFJbyO3StrJn1ZC6HzwsNJMJ2Wcf2sjMJTuTBi03HVOS5TiRc2FdP4xd7E07L0G1kVNimHaZCXzkcUOZB9iR4uWrSQ0F3BdnNxVTlAGBQ7ZAyhZBvHMkdqgOIhZCxw9WXw2dnrSB4fcjGJ4hHTIk7uHCvlqn3rJ5UpvD3WUqqjLBCHDYhbZBdc';
const WA_PHONE_ID = process.env.WA_PHONE_ID || '1222753480912642';

async function sendWhatsAppTemplate(to) {
  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "template",
    template: {
      name: "jaspers_market_order_confirmation_v1",
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "Owner" },
            { type: "text", text: "Update Attendance" },
            { type: "text", text: new Date().toISOString().split('T')[0] }
          ]
        }
      ]
    }
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v25.0/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log("WhatsApp Send Result:", data);
  } catch (err) {
    console.error("WhatsApp Send Error:", err);
  }
}

async function sendWhatsAppText(to, textBody) {
  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "text",
    text: { body: textBody }
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v25.0/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log("WhatsApp Send Text Result:", data);
  } catch (err) {
    console.error("WhatsApp Send Text Error:", err);
  }
}

// Scheduler: 10 PM IST
cron.schedule('0 22 * * *', async () => {
  console.log('Running daily WhatsApp attendance reminder...');
  try {
    const maids = await db.getAllMaids();
    if (maids.length === 0) return;

    // Group maids by owner_phone
    const maidsByOwner = {};
    maids.forEach(m => {
      if (m.owner_phone) {
        if (!maidsByOwner[m.owner_phone]) maidsByOwner[m.owner_phone] = [];
        maidsByOwner[m.owner_phone].push(m);
      }
    });

    for (const [ownerPhone, ownerMaids] of Object.entries(maidsByOwner)) {
      await sendWhatsAppTemplate(ownerPhone);
      whatsappSessions[ownerPhone] = { step: 1, maidId: null };
    }
  } catch (err) {
    console.error('Error in cron job:', err);
  }
}, {
  timezone: "Asia/Kolkata"
});

// Initialize Database
db.initDb()
  .then(() => console.log('SQLite database initialized successfully'))
  .catch(err => console.error('Database initialization error:', err));

// --- API ROUTES ---

// Welcome API check route
app.get('/api', (req, res) => {
  res.json({ message: 'HelperFlow API is online and running successfully!' });
});

// Health check route
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection by making a quick lightweight query
    const maids = await db.getAllMaids();
    res.json({
      status: 'healthy',
      database: 'connected',
      active_maids: maids.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 1. Get all maids with basic stats
app.get('/api/maids', async (req, res) => {
  try {
    const clientDate = req.query.date;
    const maids = await db.getAllMaids(clientDate);
    res.json(maids);
  } catch (err) {
    console.error('Error fetching maids:', err);
    res.status(500).json({ error: 'Failed to fetch maids' });
  }
});

// 2. Get specific maid with full details and attendance history
app.get('/api/maids/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const maid = await db.getMaidById(id);
    if (!maid) {
      return res.status(404).json({ error: 'Maid not found' });
    }
    const attendance = await db.getMaidAttendance(id);
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
app.post('/api/maids', async (req, res) => {
  try {
    const { name, phone, role, salary, joining_date, owner_phone } = req.body;
    if (!name || salary === undefined || !joining_date) {
      return res.status(400).json({ error: 'Name, salary, and joining date are required' });
    }
    const newMaid = await db.insertMaid(name, phone || '', role || '', parseFloat(salary), joining_date, owner_phone || '');
    res.status(201).json(newMaid);
  } catch (err) {
    console.error('Error creating maid:', err);
    res.status(500).json({ error: 'Failed to create maid profile' });
  }
});

// 4. Update an existing maid profile
app.put('/api/maids/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, role, salary, joining_date, owner_phone } = req.body;
    if (!name || salary === undefined || !joining_date) {
      return res.status(400).json({ error: 'Name, salary, and joining date are required' });
    }
    const updated = await db.updateMaid(id, name, phone || '', role || '', parseFloat(salary), joining_date, owner_phone || '');
    res.json(updated);
  } catch (err) {
    console.error('Error updating maid:', err);
    res.status(500).json({ error: 'Failed to update maid profile' });
  }
});

// 5. Delete a maid and their attendance history
app.delete('/api/maids/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.deleteMaid(id);
    res.json({ success: true, message: `Maid with id ${id} deleted successfully` });
  } catch (err) {
    console.error('Error deleting maid:', err);
    res.status(500).json({ error: 'Failed to delete maid' });
  }
});

// 6. Get attendance for all maids on a specific date (defaults to today)
app.get('/api/attendance', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const records = await db.getAttendanceForDate(date);
    res.json(records);
  } catch (err) {
    console.error('Error fetching attendance:', err);
    res.status(500).json({ error: 'Failed to fetch attendance logs' });
  }
});

// 7. Record/Update attendance for a single maid on a specific date
app.post('/api/attendance', async (req, res) => {
  try {
    const { maid_id, date, status, remarks } = req.body;
    if (!maid_id || !date || !status) {
      return res.status(400).json({ error: 'maid_id, date, and status are required' });
    }
    const record = await db.saveAttendance(parseInt(maid_id), date, status, remarks);
    notifySseClients(record);
    res.json(record);
  } catch (err) {
    console.error('Error saving attendance:', err);
    res.status(500).json({ error: 'Failed to save attendance record' });
  }
});

// 8. Record attendance for multiple maids in bulk (e.g. daily checkout)
app.post('/api/attendance/bulk', async (req, res) => {
  try {
    const { date, records } = req.body; // records: [{ maid_id, status, remarks }]
    if (!date || !Array.isArray(records)) {
      return res.status(400).json({ error: 'date and records array are required' });
    }
    
    const saved = [];
    for (const rec of records) {
      if (rec.maid_id && rec.status) {
        const savedRec = await db.saveAttendance(parseInt(rec.maid_id), date, rec.status, rec.remarks);
        notifySseClients(savedRec);
        saved.push(savedRec);
      }
    }
    res.json({ success: true, saved_count: saved.length, records: saved });
  } catch (err) {
    console.error('Error saving bulk attendance:', err);
    res.status(500).json({ error: 'Failed to save bulk attendance records' });
  }
});

// 9. SSE Endpoint for Real-time updates
app.get('/api/attendance/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  sseClients.push(res);
  
  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
  });
});

// 10. Settings API
app.get('/api/settings', async (req, res) => {
  try {
    const owner_phone = await db.getSetting('owner_phone');
    res.json({ owner_phone: owner_phone || '' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { owner_phone } = req.body;
    await db.saveSetting('owner_phone', owner_phone);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// 11. Manual Trigger API
app.post('/api/whatsapp/trigger', async (req, res) => {
  try {
    const { owner_phone } = req.body;
    if (owner_phone) {
      await sendWhatsAppTemplate(owner_phone);
      whatsappSessions[owner_phone] = { step: 1, maidId: null };
      return res.json({ success: true, message: 'Message triggered' });
    } else {
      // Trigger all owners
      const maids = await db.getAllMaids();
      if (maids.length === 0) return res.status(400).json({ error: 'No maids found.' });

      const maidsByOwner = {};
      maids.forEach(m => {
        if (m.owner_phone) {
          if (!maidsByOwner[m.owner_phone]) maidsByOwner[m.owner_phone] = [];
          maidsByOwner[m.owner_phone].push(m);
        }
      });

      const ownerPhones = Object.keys(maidsByOwner);
      if (ownerPhones.length === 0) return res.status(400).json({ error: 'No owner phones configured.' });

      for (const phone of ownerPhones) {
        await sendWhatsAppTemplate(phone);
        whatsappSessions[phone] = { step: 1, maidId: null };
      }
      return res.json({ success: true, message: `Messages triggered to ${ownerPhones.length} owners.` });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger message' });
  }
});

// 12. WhatsApp Webhook Verification
app.get('/api/whatsapp/webhook', (req, res) => {
  const verify_token = process.env.WA_VERIFY_TOKEN || 'my_secure_token';
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === verify_token) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// 13. WhatsApp Webhook Message Receiver
app.post('/api/whatsapp/webhook', async (req, res) => {
  let body = req.body;

  if (body.object) {
    if (
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0] &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      let msg = body.entry[0].changes[0].value.messages[0];
      let phone = msg.from; // Sender's phone
      let text = '';
      
      if (msg.type === 'text') {
        text = msg.text.body.trim().toLowerCase();
      }

      // Handle "hi" / "menu"
      if (text === 'hi' || text === 'menu' || text === 'hello') {
        const maids = await db.getAllMaids();
        const ownerMaids = maids.filter(m => m.owner_phone && m.owner_phone.includes(phone));
        if (ownerMaids.length === 0) {
           await sendWhatsAppText(phone, "We couldn't find any maids associated with your phone number.");
           return res.sendStatus(200);
        }
        let bodyText = `Please reply with the ID of the maid you want to update:\n\n`;
        ownerMaids.forEach(m => {
          bodyText += `ID ${m.id}: ${m.name}\n`;
        });
        whatsappSessions[phone] = { step: 1, maidId: null };
        await sendWhatsAppText(phone, bodyText);
        return res.sendStatus(200);
      }

      if (!whatsappSessions[phone]) {
        whatsappSessions[phone] = { step: 1, maidId: null };
      }
      const session = whatsappSessions[phone];

      if (session.step === 1) {
        const maidId = parseInt(text);
        if (isNaN(maidId)) {
          await sendWhatsAppText(phone, 'Invalid ID. Please reply with a valid number, or type "menu" to see the list.');
          return res.sendStatus(200);
        }

        const maid = await db.getMaidById(maidId);
        if (!maid) {
          await sendWhatsAppText(phone, `We could not find a maid with ID ${maidId}. Please try again.`);
          return res.sendStatus(200);
        }

        if (!maid.owner_phone || !maid.owner_phone.includes(phone)) {
          await sendWhatsAppText(phone, `You are not authorized to update attendance for ${maid.name}.`);
          return res.sendStatus(200);
        }

        session.step = 2;
        session.maidId = maid.id;
        await sendWhatsAppText(phone, `You selected ${maid.name}.\nPlease reply with attendance status:\n1: Present\n2: Absent\n3: Half-Day\n4: Paid Leave`);
        
      } else if (session.step === 2) {
        let status = null;
        if (text === '1') status = 'present';
        else if (text === '2') status = 'absent';
        else if (text === '3') status = 'half_day';
        else if (text === '4') status = 'leave_paid';
        
        if (!status) {
          await sendWhatsAppText(phone, 'Invalid status code. Use 1, 2, 3, or 4. Or type "menu" to restart.');
          return res.sendStatus(200);
        }

        const maid = await db.getMaidById(session.maidId);
        const today = new Date().toISOString().split('T')[0];
        
        try {
          const record = await db.saveAttendance(session.maidId, today, status, 'Updated via WhatsApp');
          notifySseClients(record); // Notify frontend instantly
          await sendWhatsAppText(phone, `✅ Attendance updated to ${status} for ${maid.name} (${today}).\n\nTo update another maid, reply with their ID. Or type "menu" to see the list again.`);
          session.step = 1;
          session.maidId = null;
        } catch (err) {
          console.error('Webhook save error', err);
          await sendWhatsAppText(phone, 'Sorry, there was an error updating your status. Please try again.');
          session.step = 1;
          session.maidId = null;
        }
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// --- SERVE STATIC FRONTEND IN PRODUCTION ---
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Export app for Vercel Serverless Function wrapping
module.exports = app;

// Start the listener ONLY if running the script directly (non-serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
