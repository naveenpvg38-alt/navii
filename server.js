const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'queue-state.json');

// Initial default state
let state = {
  tokenCounter: 1,
  tokenPrefix: 'A',
  activeQueue: [],       // Patients currently waiting
  currentPatient: null,  // Patient currently with doctor
  completedPatients: [], // Successfully served patients
  skippedPatients: [],   // No-show / skipped patients
  settings: {
    avgConsultationTime: 7, // in minutes
    clinicName: 'HealthFirst Medical Centre',
    doctorName: 'Dr. Naveen Pn',
    roomNumber: 'Consultation Room 1'
  },
  lastAnnouncement: null
};

// Load saved state if exists
function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const loaded = JSON.parse(raw);
      state = { ...state, ...loaded };
      console.log(`[Storage] Loaded state from ${DATA_FILE}. Total waiting: ${state.activeQueue.length}`);
    }
  } catch (err) {
    console.error('[Storage] Error reading saved state:', err.message);
  }
}

function saveState() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('[Storage] Error saving state:', err.message);
  }
}

loadState();

// Helper to format token number, e.g. A-001, A-014
function formatToken(prefix, num) {
  return `${prefix}-${String(num).padStart(3, '0')}`;
}

// Compute wait times & queue position for all waiting patients
function getPublicState() {
  const avg = state.settings.avgConsultationTime || 7;
  
  const enrichedQueue = state.activeQueue.map((patient, index) => {
    // index is people ahead (0 means they are next in line)
    // If someone is currently being served, add that current consultation factor
    const peopleAhead = index;
    const estimatedMinutes = (index + (state.currentPatient ? 1 : 0)) * avg;
    return {
      ...patient,
      peopleAhead,
      position: index + 1,
      estimatedWaitTime: estimatedMinutes
    };
  });

  return {
    settings: state.settings,
    currentPatient: state.currentPatient,
    activeQueue: enrichedQueue,
    completedPatients: state.completedPatients.slice(-20), // return last 20 for history
    skippedPatients: state.skippedPatients,
    lastAnnouncement: state.lastAnnouncement,
    stats: {
      totalWaiting: state.activeQueue.length,
      totalServed: state.completedPatients.length,
      totalSkipped: state.skippedPatients.length,
      totalRegistered: state.tokenCounter - 1
    }
  };
}

// Broadcast updated queue state to all connected WebSocket clients
function broadcast(eventType = 'QUEUE_UPDATED', extraData = {}) {
  const publicState = getPublicState();
  const message = JSON.stringify({
    type: eventType,
    data: publicState,
    ...extraData,
    timestamp: new Date().toISOString()
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// REST Endpoints
app.get('/api/queue', (req, res) => {
  res.json(getPublicState());
});

// Patient registration endpoint
app.post('/api/register', (req, res) => {
  const { name, age, reason, department } = req.body;
  const patientName = (name && name.trim()) || 'Walk-in Patient';
  
  const token = formatToken(state.tokenPrefix, state.tokenCounter++);
  const newPatient = {
    id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    token,
    name: patientName,
    age: age ? parseInt(age, 10) : null,
    reason: reason ? reason.trim() : 'General Consultation',
    department: department || 'General Medicine',
    registeredAt: new Date().toISOString(),
    status: 'waiting'
  };

  state.activeQueue.push(newPatient);
  saveState();
  broadcast('QUEUE_UPDATED', { newPatientToken: token });

  // Return patient ticket with initial position calculation
  const publicState = getPublicState();
  const enriched = publicState.activeQueue.find(p => p.id === newPatient.id) || newPatient;

  res.status(201).json({
    success: true,
    patient: enriched
  });
});

// Look up a specific token
app.get('/api/patient/:token', (req, res) => {
  const searchToken = req.params.token.toUpperCase().trim();
  const publicState = getPublicState();

  // Check if currently serving
  if (state.currentPatient && state.currentPatient.token === searchToken) {
    return res.json({
      status: 'serving',
      patient: state.currentPatient,
      peopleAhead: 0,
      estimatedWaitTime: 0,
      settings: state.settings
    });
  }

  // Check waiting queue
  const waitingIndex = publicState.activeQueue.findIndex(p => p.token === searchToken);
  if (waitingIndex !== -1) {
    const patient = publicState.activeQueue[waitingIndex];
    return res.json({
      status: 'waiting',
      patient,
      peopleAhead: patient.peopleAhead,
      position: patient.position,
      estimatedWaitTime: patient.estimatedWaitTime,
      settings: state.settings
    });
  }

  // Check completed
  const completed = state.completedPatients.find(p => p.token === searchToken);
  if (completed) {
    return res.json({
      status: 'completed',
      patient: completed,
      completedAt: completed.completedAt
    });
  }

  // Check skipped
  const skipped = state.skippedPatients.find(p => p.token === searchToken);
  if (skipped) {
    return res.json({
      status: 'skipped',
      patient: skipped,
      skippedAt: skipped.skippedAt
    });
  }

  res.status(404).json({ error: 'Token not found' });
});

// Doctor Action: Call Next Patient
app.post('/api/doctor/call-next', (req, res) => {
  // If there is an existing patient being served, mark them completed first
  if (state.currentPatient) {
    state.completedPatients.push({
      ...state.currentPatient,
      status: 'completed',
      completedAt: new Date().toISOString()
    });
    state.currentPatient = null;
  }

  if (state.activeQueue.length === 0) {
    saveState();
    broadcast('QUEUE_UPDATED');
    return res.json({ message: 'Queue is empty', currentPatient: null });
  }

  // Pop next patient
  const nextPatient = state.activeQueue.shift();
  nextPatient.status = 'serving';
  nextPatient.calledAt = new Date().toISOString();
  state.currentPatient = nextPatient;

  state.lastAnnouncement = {
    token: nextPatient.token,
    name: nextPatient.name,
    room: state.settings.roomNumber,
    timestamp: new Date().toISOString()
  };

  saveState();
  broadcast('PATIENT_CALLED', {
    calledPatient: state.currentPatient,
    announcement: state.lastAnnouncement
  });

  res.json({
    success: true,
    currentPatient: state.currentPatient
  });
});

// Doctor Action: Mark current patient as completed
app.post('/api/doctor/complete', (req, res) => {
  if (!state.currentPatient) {
    return res.status(400).json({ error: 'No patient currently being served' });
  }

  state.completedPatients.push({
    ...state.currentPatient,
    status: 'completed',
    completedAt: new Date().toISOString()
  });
  const completedPatient = state.currentPatient;
  state.currentPatient = null;

  saveState();
  broadcast('QUEUE_UPDATED', { completedPatient });

  res.json({ success: true, completedPatient });
});

// Doctor Action: Skip current patient or a specific waiting patient
app.post('/api/doctor/skip', (req, res) => {
  const { patientId } = req.body;

  let skippedPatient = null;

  if (patientId) {
    // Skip specific waiting patient
    const index = state.activeQueue.findIndex(p => p.id === patientId);
    if (index !== -1) {
      skippedPatient = state.activeQueue.splice(index, 1)[0];
    }
  } else if (state.currentPatient) {
    // Skip current patient
    skippedPatient = state.currentPatient;
    state.currentPatient = null;
  }

  if (!skippedPatient) {
    return res.status(400).json({ error: 'No patient found to skip' });
  }

  skippedPatient.status = 'skipped';
  skippedPatient.skippedAt = new Date().toISOString();
  state.skippedPatients.push(skippedPatient);

  saveState();
  broadcast('QUEUE_UPDATED', { skippedPatient });

  res.json({ success: true, skippedPatient });
});

// Doctor Action: Recall (re-announce or restore skipped patient)
app.post('/api/doctor/recall', (req, res) => {
  const { patientId } = req.body;

  if (patientId) {
    // Restore from skipped list to the top of waiting queue
    const skipIndex = state.skippedPatients.findIndex(p => p.id === patientId);
    if (skipIndex !== -1) {
      const recalled = state.skippedPatients.splice(skipIndex, 1)[0];
      recalled.status = 'waiting';
      recalled.recalledAt = new Date().toISOString();
      state.activeQueue.unshift(recalled); // place at the very front

      saveState();
      broadcast('QUEUE_UPDATED');
      return res.json({ success: true, recalledPatient: recalled });
    }
  }

  // If no patientId provided, re-announce current patient
  if (state.currentPatient) {
    state.lastAnnouncement = {
      token: state.currentPatient.token,
      name: state.currentPatient.name,
      room: state.settings.roomNumber,
      timestamp: new Date().toISOString(),
      isRecall: true
    };
    saveState();
    broadcast('PATIENT_CALLED', {
      calledPatient: state.currentPatient,
      announcement: state.lastAnnouncement
    });
    return res.json({ success: true, announced: state.currentPatient });
  }

  res.status(400).json({ error: 'No patient to recall' });
});

// Doctor Action: Update settings (e.g. avg consultation time)
app.post('/api/doctor/settings', (req, res) => {
  const { avgConsultationTime, doctorName, roomNumber, clinicName } = req.body;

  if (avgConsultationTime && !isNaN(avgConsultationTime)) {
    state.settings.avgConsultationTime = Math.max(1, Math.min(60, parseInt(avgConsultationTime, 10)));
  }
  if (doctorName) state.settings.doctorName = doctorName.trim();
  if (roomNumber) state.settings.roomNumber = roomNumber.trim();
  if (clinicName) state.settings.clinicName = clinicName.trim();

  saveState();
  broadcast('QUEUE_UPDATED');

  res.json({ success: true, settings: state.settings });
});

// Doctor Action: Reset queue
app.post('/api/doctor/reset', (req, res) => {
  state.activeQueue = [];
  state.currentPatient = null;
  state.completedPatients = [];
  state.skippedPatients = [];
  state.tokenCounter = 1;
  state.lastAnnouncement = null;

  saveState();
  broadcast('QUEUE_UPDATED');

  res.json({ success: true, message: 'Queue has been reset' });
});

// WebSocket Connection handling
wss.on('connection', (ws) => {
  // Send immediate current state upon connection
  ws.send(JSON.stringify({
    type: 'QUEUE_UPDATED',
    data: getPublicState(),
    timestamp: new Date().toISOString()
  }));

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      // Optional client-driven message handling if needed
      if (parsed.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      }
    } catch (e) {
      // Ignore malformed client messages
    }
  });

  ws.on('error', () => {});
});

// Start Server
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Hospital Queue Management System is running!`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(` Patient View:    http://localhost:${PORT}/#patient`);
  console.log(` Doctor Console:  http://localhost:${PORT}/#doctor`);
  console.log(` Public Display:  http://localhost:${PORT}/#display`);
  console.log(`=======================================================`);
});
