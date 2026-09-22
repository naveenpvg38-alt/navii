/**
 * Hospital Queue Management System - Client Application
 * Features: Mobile responsive, iOS safe-area support, animated splash screen,
 * confetti celebration engine, toast notifications, department chips, haptic feedback.
 */

(function () {
  'use strict';

  // Application State
  let queueState = {
    settings: {
      avgConsultationTime: 7,
      roomNumber: 'Consultation Room 1',
      clinicName: 'HealthFirst Medical Centre',
      doctorName: 'Dr. Naveen Pn'
    },
    currentPatient: null,
    activeQueue: [],
    completedPatients: [],
    skippedPatients: [],
    stats: {
      totalWaiting: 0,
      totalServed: 0,
      totalSkipped: 0
    },
    lastAnnouncement: null
  };

  let myPatientToken = localStorage.getItem('hqms_my_token') || null;
  let myPatientData = null;
  let socket = null;
  let consultTimerInterval = null;
  let clockInterval = null;
  let splashDismissed = false;

  // BroadcastChannel fallback for multi-tab sync if WebSocket is unavailable
  const broadcastChannel = typeof BroadcastChannel !== 'undefined' 
    ? new BroadcastChannel('hqms_broadcast_channel') 
    : null;

  // DOM Elements Map
  const dom = {
    // Splash Screen
    splashScreen: document.getElementById('splashScreen'),
    splashStatusText: document.getElementById('splashStatusText'),

    // Toast Container & Confetti
    toastContainer: document.getElementById('toastContainer'),
    confettiCanvas: document.getElementById('confettiCanvas'),

    // Header & Sync
    syncBadge: document.getElementById('syncBadge'),
    syncText: document.getElementById('syncText'),
    headerClinicName: document.getElementById('headerClinicName'),
    headerDoctorSubtitle: document.getElementById('headerDoctorSubtitle'),
    tabButtons: document.querySelectorAll('.tab-btn'),
    mobileNavButtons: document.querySelectorAll('.mobile-nav-btn'),
    viewSections: document.querySelectorAll('.view-section'),

    // Patient View
    patientView: document.getElementById('patientView'),
    patientRegCard: document.getElementById('patientRegCard'),
    patientStatusCard: document.getElementById('patientStatusCard'),
    patientRegForm: document.getElementById('patientRegForm'),
    regName: document.getElementById('regName'),
    regAge: document.getElementById('regAge'),
    regDept: document.getElementById('regDept'),
    deptChips: document.querySelectorAll('.dept-chip'),
    regReason: document.getElementById('regReason'),
    btnSubmitReg: document.getElementById('btnSubmitReg'),
    lookupTokenInput: document.getElementById('lookupTokenInput'),
    btnLookupToken: document.getElementById('btnLookupToken'),
    btnNewToken: document.getElementById('btnNewToken'),
    btnCopyToken: document.getElementById('btnCopyToken'),
    callAlertBanner: document.getElementById('callAlertBanner'),
    callAlertRoom: document.getElementById('callAlertRoom'),
    ticketStatusBadge: document.getElementById('ticketStatusBadge'),
    ticketTokenNumber: document.getElementById('ticketTokenNumber'),
    ticketPatientName: document.getElementById('ticketPatientName'),
    ticketMeta: document.getElementById('ticketMeta'),
    ticketPeopleAhead: document.getElementById('ticketPeopleAhead'),
    ticketEstimatedWait: document.getElementById('ticketEstimatedWait'),
    ticketEstimatedWaitShort: document.getElementById('ticketEstimatedWaitShort'),
    ticketNowServingInfo: document.getElementById('ticketNowServingInfo'),
    ticketProgressBar: document.getElementById('ticketProgressBar'),
    ticketQueuePosSummary: document.getElementById('ticketQueuePosSummary'),

    // Doctor View
    doctorView: document.getElementById('doctorView'),
    statWaiting: document.getElementById('statWaiting'),
    statServing: document.getElementById('statServing'),
    statCompleted: document.getElementById('statCompleted'),
    statSkipped: document.getElementById('statSkipped'),
    servingEmptyState: document.getElementById('servingEmptyState'),
    servingActiveState: document.getElementById('servingActiveState'),
    docCurrentToken: document.getElementById('docCurrentToken'),
    docCurrentName: document.getElementById('docCurrentName'),
    docCurrentDetails: document.getElementById('docCurrentDetails'),
    docConsultTimer: document.getElementById('docConsultTimer'),
    btnDocCallNext: document.getElementById('btnDocCallNext'),
    btnDocComplete: document.getElementById('btnDocComplete'),
    btnDocRecall: document.getElementById('btnDocRecall'),
    btnDocSkip: document.getElementById('btnDocSkip'),
    queueBadgeCount: document.getElementById('queueBadgeCount'),
    waitingQueueList: document.getElementById('waitingQueueList'),
    settingAvgTime: document.getElementById('settingAvgTime'),
    settingDoctor: document.getElementById('settingDoctor'),
    settingRoom: document.getElementById('settingRoom'),
    toggleSound: document.getElementById('toggleSound'),
    btnSaveSettings: document.getElementById('btnSaveSettings'),
    skippedCount: document.getElementById('skippedCount'),
    skippedQueueList: document.getElementById('skippedQueueList'),
    completedQueueList: document.getElementById('completedQueueList'),
    btnResetQueue: document.getElementById('btnResetQueue'),

    // Public TV View
    displayView: document.getElementById('displayView'),
    tvClinicTitle: document.getElementById('tvClinicTitle'),
    tvDigitalClock: document.getElementById('tvDigitalClock'),
    tvHeroToken: document.getElementById('tvHeroToken'),
    tvHeroRoom: document.getElementById('tvHeroRoom'),
    tvHeroPatient: document.getElementById('tvHeroPatient'),
    tvUpcomingList: document.getElementById('tvUpcomingList')
  };

  /* ========================================================
     SPLASH SCREEN DISMISSAL
     ======================================================== */
  function dismissSplashScreen() {
    if (splashDismissed || !dom.splashScreen) return;
    splashDismissed = true;

    if (dom.splashStatusText) {
      dom.splashStatusText.textContent = 'System Ready!';
    }

    setTimeout(() => {
      dom.splashScreen.classList.add('fade-out');
      setTimeout(() => {
        dom.splashScreen.style.display = 'none';
      }, 600);
    }, 900);
  }

  // Safety fallback: dismiss splash screen after 2.5s maximum
  setTimeout(dismissSplashScreen, 2500);

  /* ========================================================
     HAPTIC FEEDBACK & TOAST SYSTEM
     ======================================================== */
  function triggerHaptic(duration = 20) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch (e) {}
    }
  }

  function showToast(message, type = 'info', icon = 'ℹ️') {
    if (!dom.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span style="font-weight: 600;">${escapeHtml(message)}</span>
    `;

    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  /* ========================================================
     CONFETTI CELEBRATION ENGINE
     ======================================================== */
  function triggerConfetti() {
    const canvas = dom.confettiCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#0284c7', '#38bdf8', '#10b981', '#34d399', '#f59e0b', '#ec4899'];
    const particles = [];

    for (let i = 0; i < 75; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 100,
        y: canvas.height * 0.35,
        radius: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 12,
        vy: Math.random() * -10 - 4,
        gravity: 0.35,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    let animationId = null;
    function renderConfetti() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let aliveCount = 0;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.012;

        if (p.opacity > 0 && p.y < canvas.height) {
          aliveCount++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 1.5);
          ctx.restore();
        }
      });

      if (aliveCount > 0) {
        animationId = requestAnimationFrame(renderConfetti);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cancelAnimationFrame(animationId);
      }
    }

    renderConfetti();
  }

  /* ========================================================
     ROUTING & VIEW MANAGEMENT (Desktop Tabs + Mobile Nav)
     ======================================================== */
  function switchView(viewName) {
    triggerHaptic(15);

    // Sync Desktop Tabs
    dom.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Sync Mobile Bottom Tabs
    dom.mobileNavButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Toggle View Sections
    dom.viewSections.forEach(sec => {
      sec.classList.remove('active-view');
    });

    const target = document.getElementById(viewName + 'View');
    if (target) {
      target.classList.add('active-view');
    }

    window.location.hash = viewName;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  dom.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  dom.mobileNavButtons.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  function initRoute() {
    const hash = window.location.hash.replace('#', '');
    if (['patient', 'doctor', 'display'].includes(hash)) {
      switchView(hash);
    } else {
      switchView('patient');
    }
  }

  /* ========================================================
     REAL-TIME WEBSOCKET & FALLBACK SYNC
     ======================================================== */
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setSyncStatus(true);
        dismissSplashScreen();
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleServerMessage(message);
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      socket.onclose = () => {
        setSyncStatus(false);
        setTimeout(connectWebSocket, 2000);
      };

      socket.onerror = () => {
        setSyncStatus(false);
      };
    } catch (e) {
      console.warn('WebSocket connection error, using REST polling fallback', e);
      setSyncStatus(false);
    }
  }

  function setSyncStatus(isLive) {
    if (isLive) {
      dom.syncBadge.classList.remove('disconnected');
      dom.syncText.textContent = 'Live Synced';
    } else {
      dom.syncBadge.classList.add('disconnected');
      dom.syncText.textContent = 'Reconnecting...';
    }
  }

  function handleServerMessage(message) {
    if (message.type === 'QUEUE_UPDATED') {
      queueState = message.data;
      renderAllViews();
    } else if (message.type === 'PATIENT_CALLED') {
      queueState = message.data;
      renderAllViews();

      const announcement = message.announcement;
      if (announcement) {
        const token = announcement.token;
        const room = announcement.room || 'Consultation Room 1';

        // Display toast across views
        showToast(`🔔 Token ${token} called to ${room}`, 'info', '📢');

        // Play hospital ding-dong chime
        if (window.soundEffects) {
          window.soundEffects.announce(token, room);
        }

        // If this user is the one called
        if (myPatientToken === token) {
          triggerHaptic([400, 200, 400]);
          triggerConfetti();
        }
      }
    }

    if (broadcastChannel) {
      broadcastChannel.postMessage(message);
    }
  }

  if (broadcastChannel) {
    broadcastChannel.onmessage = (event) => {
      const message = event.data;
      if (message && message.data) {
        queueState = message.data;
        renderAllViews();
      }
    };
  }

  async function fetchInitialQueue() {
    try {
      const res = await fetch('/api/queue');
      if (res.ok) {
        queueState = await res.json();
        renderAllViews();
        dismissSplashScreen();
      }
    } catch (err) {
      console.warn('Initial fetch failed:', err);
    }
  }

  /* ========================================================
     RENDER CONTROLLERS
     ======================================================== */
  function renderAllViews() {
    updateHeaderBranding();
    renderPatientView();
    renderDoctorDashboard();
    renderPublicDisplay();
  }

  function updateHeaderBranding() {
    if (queueState.settings) {
      dom.headerClinicName.textContent = queueState.settings.clinicName || 'HealthFirst Medical Centre';
      dom.tvClinicTitle.textContent = queueState.settings.clinicName || 'HealthFirst Medical Centre';
      if (queueState.settings.doctorName) {
        dom.headerDoctorSubtitle.textContent = `${queueState.settings.doctorName} • ${queueState.settings.roomNumber || 'Room 1'}`;
      }
    }
  }

  /* --------------------------------------------------------
     RENDER: PATIENT PORTAL
     -------------------------------------------------------- */
  function renderPatientView() {
    if (!myPatientToken) {
      dom.patientRegCard.style.display = 'block';
      dom.patientStatusCard.style.display = 'none';
      dom.callAlertBanner.classList.remove('active');
      return;
    }

    const isServing = queueState.currentPatient && queueState.currentPatient.token === myPatientToken;
    const waitingPatient = queueState.activeQueue.find(p => p.token === myPatientToken);
    const completedPatient = queueState.completedPatients.find(p => p.token === myPatientToken);
    const skippedPatient = queueState.skippedPatients.find(p => p.token === myPatientToken);

    dom.patientRegCard.style.display = 'none';
    dom.patientStatusCard.style.display = 'block';
    dom.ticketTokenNumber.textContent = myPatientToken;

    if (queueState.currentPatient) {
      dom.ticketNowServingInfo.textContent = `${queueState.currentPatient.token} (${queueState.currentPatient.name})`;
    } else {
      dom.ticketNowServingInfo.textContent = 'None';
    }

    if (isServing) {
      const p = queueState.currentPatient;
      dom.ticketPatientName.textContent = p.name;
      dom.ticketMeta.textContent = `${p.department || 'General'} • Room: ${queueState.settings.roomNumber}`;
      dom.ticketStatusBadge.className = 'ticket-status-pill status-serving';
      dom.ticketStatusBadge.textContent = 'NOW BEING SERVED';
      dom.ticketPeopleAhead.textContent = '0';
      dom.ticketEstimatedWait.textContent = 'In Room';
      dom.ticketEstimatedWaitShort.textContent = 'Now';
      dom.ticketQueuePosSummary.textContent = 'In Consultation';
      dom.ticketProgressBar.style.width = '100%';

      dom.callAlertRoom.textContent = queueState.settings.roomNumber || 'Consultation Room 1';
      dom.callAlertBanner.classList.add('active');
    } else if (waitingPatient) {
      dom.callAlertBanner.classList.remove('active');
      dom.ticketPatientName.textContent = waitingPatient.name;
      dom.ticketMeta.textContent = `${waitingPatient.department || 'General'} • Position #${waitingPatient.position}`;
      dom.ticketStatusBadge.className = 'ticket-status-pill status-waiting';
      dom.ticketStatusBadge.textContent = 'Waiting in Queue';

      dom.ticketPeopleAhead.textContent = waitingPatient.peopleAhead;
      dom.ticketEstimatedWait.textContent = `~${waitingPatient.estimatedWaitTime} min`;
      dom.ticketEstimatedWaitShort.textContent = `~${waitingPatient.estimatedWaitTime} min`;
      dom.ticketQueuePosSummary.textContent = `${waitingPatient.peopleAhead} ahead of you`;

      // Progress bar percentage (closer to 1 = higher progress)
      const totalInLine = Math.max(1, queueState.activeQueue.length + (queueState.currentPatient ? 1 : 0));
      const progress = Math.min(95, Math.max(15, Math.round(((totalInLine - waitingPatient.position + 1) / totalInLine) * 100)));
      dom.ticketProgressBar.style.width = `${progress}%`;
    } else if (completedPatient) {
      dom.callAlertBanner.classList.remove('active');
      dom.ticketPatientName.textContent = completedPatient.name;
      dom.ticketMeta.textContent = 'Consultation completed. Take care!';
      dom.ticketStatusBadge.className = 'ticket-status-pill status-completed';
      dom.ticketStatusBadge.textContent = 'Consultation Completed';
      dom.ticketPeopleAhead.textContent = '-';
      dom.ticketEstimatedWait.textContent = 'Done';
      dom.ticketEstimatedWaitShort.textContent = 'Finished';
      dom.ticketQueuePosSummary.textContent = 'Completed';
      dom.ticketProgressBar.style.width = '100%';
    } else if (skippedPatient) {
      dom.callAlertBanner.classList.remove('active');
      dom.ticketPatientName.textContent = skippedPatient.name;
      dom.ticketMeta.textContent = 'Marked absent. Please notify the doctor.';
      dom.ticketStatusBadge.className = 'ticket-status-pill status-skipped';
      dom.ticketStatusBadge.textContent = 'Marked as No-Show';
      dom.ticketPeopleAhead.textContent = '-';
      dom.ticketEstimatedWait.textContent = 'Skipped';
      dom.ticketEstimatedWaitShort.textContent = 'Absent';
      dom.ticketQueuePosSummary.textContent = 'Skipped';
      dom.ticketProgressBar.style.width = '0%';
    } else {
      dom.callAlertBanner.classList.remove('active');
      dom.ticketPatientName.textContent = myPatientData?.name || 'Registered Patient';
      dom.ticketStatusBadge.className = 'ticket-status-pill status-completed';
      dom.ticketStatusBadge.textContent = 'Session Closed';
      dom.ticketPeopleAhead.textContent = '-';
      dom.ticketEstimatedWait.textContent = '-';
      dom.ticketProgressBar.style.width = '0%';
    }
  }

  /* --------------------------------------------------------
     RENDER: DOCTOR DASHBOARD
     -------------------------------------------------------- */
  function renderDoctorDashboard() {
    dom.statWaiting.textContent = queueState.activeQueue.length;
    dom.statServing.textContent = queueState.currentPatient ? queueState.currentPatient.token : '-';
    dom.statCompleted.textContent = queueState.completedPatients.length;
    dom.statSkipped.textContent = queueState.skippedPatients.length;
    dom.queueBadgeCount.textContent = queueState.activeQueue.length;
    dom.skippedCount.textContent = queueState.skippedPatients.length;

    dom.btnDocCallNext.disabled = queueState.activeQueue.length === 0;

    if (queueState.currentPatient) {
      dom.servingEmptyState.style.display = 'none';
      dom.servingActiveState.style.display = 'flex';

      const cp = queueState.currentPatient;
      dom.docCurrentToken.textContent = cp.token;
      dom.docCurrentName.textContent = cp.name;
      dom.docCurrentDetails.textContent = `Age: ${cp.age || 'N/A'} • ${cp.reason || 'Consultation'} (${cp.department || 'General'})`;

      startConsultTimer(cp.calledAt);
    } else {
      dom.servingEmptyState.style.display = 'block';
      dom.servingActiveState.style.display = 'none';
      stopConsultTimer();
    }

    if (queueState.activeQueue.length === 0) {
      dom.waitingQueueList.innerHTML = '<div class="empty-state-list">No patients waiting in queue.</div>';
    } else {
      dom.waitingQueueList.innerHTML = queueState.activeQueue.map((p) => `
        <div class="queue-row" data-id="${p.id}">
          <div class="queue-row-info">
            <span class="queue-pos">#${p.position}</span>
            <span class="queue-token">${p.token}</span>
            <div class="queue-details">
              <strong>${escapeHtml(p.name)} ${p.age ? `<span style="font-weight: normal; color: #64748b;">(${p.age}y)</span>` : ''}</strong>
              <span>${escapeHtml(p.department || 'General')} • ${escapeHtml(p.reason)} • ~${p.estimatedWaitTime}m</span>
            </div>
          </div>
          <div class="queue-row-actions">
            <button class="btn btn-secondary btn-sm" onclick="window.doctorActions.skipPatient('${p.id}')" title="Skip this patient">
              Skip
            </button>
          </div>
        </div>
      `).join('');
    }

    if (queueState.skippedPatients.length === 0) {
      dom.skippedQueueList.innerHTML = '<div style="font-size: 0.8rem; color: #64748b; text-align: center; padding: 1rem 0;">No skipped patients</div>';
    } else {
      dom.skippedQueueList.innerHTML = queueState.skippedPatients.map(p => `
        <div class="skipped-item">
          <div>
            <span class="skipped-token">${p.token}</span>
            <span style="margin-left: 0.4rem; color: #1e293b;">${escapeHtml(p.name)}</span>
          </div>
          <button class="btn btn-warning btn-sm" onclick="window.doctorActions.recallPatient('${p.id}')" title="Restore to front of queue">
            Recall
          </button>
        </div>
      `).join('');
    }

    if (queueState.completedPatients.length === 0) {
      dom.completedQueueList.innerHTML = '<div style="font-size: 0.8rem; color: #64748b; text-align: center; padding: 1rem 0;">No consultations completed yet</div>';
    } else {
      const recent = [...queueState.completedPatients].reverse().slice(0, 5);
      dom.completedQueueList.innerHTML = recent.map(p => `
        <div class="skipped-item">
          <div>
            <span style="font-family: monospace; font-weight: 800; color: #0284c7;">${p.token}</span>
            <span style="margin-left: 0.4rem; color: #1e293b;">${escapeHtml(p.name)}</span>
          </div>
          <span style="font-size: 0.75rem; color: #10b981; font-weight: 700;">Served</span>
        </div>
      `).join('');
    }

    if (queueState.settings) {
      dom.settingAvgTime.value = queueState.settings.avgConsultationTime || 7;
      if (dom.settingDoctor) dom.settingDoctor.value = queueState.settings.doctorName || 'Dr. Naveen Pn';
      dom.settingRoom.value = queueState.settings.roomNumber || 'Consultation Room 1';
    }
  }

  /* --------------------------------------------------------
     RENDER: PUBLIC TV DISPLAY
     -------------------------------------------------------- */
  function renderPublicDisplay() {
    if (queueState.currentPatient) {
      dom.tvHeroToken.textContent = queueState.currentPatient.token;
      dom.tvHeroRoom.textContent = queueState.settings.roomNumber || 'Consultation Room 1';
      dom.tvHeroPatient.textContent = `Patient: ${queueState.currentPatient.name}`;
    } else {
      dom.tvHeroToken.textContent = '---';
      dom.tvHeroRoom.textContent = queueState.settings.roomNumber || 'Consultation Room 1';
      dom.tvHeroPatient.textContent = 'Waiting for next patient';
    }

    if (queueState.activeQueue.length === 0) {
      dom.tvUpcomingList.innerHTML = '<div style="color: #64748b; padding: 2rem 0; text-align: center;">Queue is currently empty</div>';
    } else {
      const upcoming = queueState.activeQueue.slice(0, 4);
      dom.tvUpcomingList.innerHTML = upcoming.map((p) => `
        <div class="upcoming-item">
          <div>
            <span class="upcoming-token">${p.token}</span>
            <span style="color: #cbd5e1; margin-left: 0.75rem; font-size: 0.95rem;">${escapeHtml(p.name)}</span>
          </div>
          <div class="upcoming-wait">~${p.estimatedWaitTime} mins</div>
        </div>
      `).join('');
    }
  }

  /* ========================================================
     TIMER & DIGITAL CLOCK
     ======================================================== */
  function startConsultTimer(calledAtIso) {
    stopConsultTimer();
    const startTime = calledAtIso ? new Date(calledAtIso).getTime() : Date.now();

    function updateTimer() {
      const elapsedSec = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const secs = String(elapsedSec % 60).padStart(2, '0');
      dom.docConsultTimer.textContent = `⏱️ Consultation: ${mins}:${secs}`;
    }

    updateTimer();
    consultTimerInterval = setInterval(updateTimer, 1000);
  }

  function stopConsultTimer() {
    if (consultTimerInterval) {
      clearInterval(consultTimerInterval);
      consultTimerInterval = null;
    }
  }

  function initDigitalClock() {
    function tick() {
      const now = new Date();
      dom.tvDigitalClock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    tick();
    clockInterval = setInterval(tick, 1000);
  }

  /* ========================================================
     PATIENT ACTIONS & DEPARTMENT CHIPS
     ======================================================== */
  // Department Chip Clicks
  dom.deptChips.forEach(chip => {
    chip.addEventListener('click', () => {
      dom.deptChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      dom.regDept.value = chip.dataset.dept;
      triggerHaptic(15);
    });
  });

  // Copy Token to Clipboard
  dom.btnCopyToken.addEventListener('click', () => {
    if (myPatientToken) {
      triggerHaptic(20);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(myPatientToken).then(() => {
          showToast(`Token ${myPatientToken} copied!`, 'success', '📋');
        }).catch(() => {
          showToast(`Token: ${myPatientToken}`, 'info', '📋');
        });
      } else {
        showToast(`Token: ${myPatientToken}`, 'info', '📋');
      }
    }
  });

  // Patient Registration Submit
  dom.patientRegForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic(30);

    const name = dom.regName.value.trim();
    const age = dom.regAge.value.trim();
    const department = dom.regDept.value;
    const reason = dom.regReason.value.trim();

    if (!name) return;

    dom.btnSubmitReg.disabled = true;
    dom.btnSubmitReg.innerHTML = 'Issuing Digital Token...';

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, age, department, reason })
      });

      const data = await res.json();
      if (data.success && data.patient) {
        myPatientToken = data.patient.token;
        myPatientData = data.patient;
        localStorage.setItem('hqms_my_token', myPatientToken);

        dom.patientRegForm.reset();
        renderPatientView();

        // Celebration animation
        triggerConfetti();
        showToast(`Token ${myPatientToken} issued successfully!`, 'success', '🎉');
      }
    } catch (err) {
      showToast('Could not register patient. Please check network.', 'error', '⚠️');
      console.error(err);
    } finally {
      dom.btnSubmitReg.disabled = false;
      dom.btnSubmitReg.innerHTML = '<span class="btn-icon">🎟️</span><span class="btn-text">Issue Digital Token</span>';
    }
  });

  // Lookup Token
  dom.btnLookupToken.addEventListener('click', async () => {
    const search = dom.lookupTokenInput.value.trim().toUpperCase();
    if (!search) return;

    try {
      const res = await fetch(`/api/patient/${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        myPatientToken = search;
        myPatientData = data.patient;
        localStorage.setItem('hqms_my_token', myPatientToken);
        renderPatientView();
        showToast(`Loaded Token ${search}`, 'success', '🔍');
      } else {
        showToast(`Token "${search}" not found.`, 'info', '❓');
      }
    } catch (err) {
      showToast('Error finding token.', 'error', '⚠️');
    }
  });

  dom.btnNewToken.addEventListener('click', () => {
    triggerHaptic(15);
    myPatientToken = null;
    myPatientData = null;
    localStorage.removeItem('hqms_my_token');
    renderPatientView();
  });

  /* ========================================================
     DOCTOR DASHBOARD ACTIONS
     ======================================================== */
  dom.btnDocCallNext.addEventListener('click', async () => {
    try {
      triggerHaptic(30);
      dom.btnDocCallNext.disabled = true;
      const res = await fetch('/api/doctor/call-next', { method: 'POST' });
      const data = await res.json();
      if (data.currentPatient && window.soundEffects) {
        window.soundEffects.announce(data.currentPatient.token, queueState.settings.roomNumber);
      }
    } catch (err) {
      console.error(err);
    } finally {
      dom.btnDocCallNext.disabled = false;
    }
  });

  dom.btnDocComplete.addEventListener('click', async () => {
    try {
      triggerHaptic(20);
      await fetch('/api/doctor/complete', { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  });

  dom.btnDocSkip.addEventListener('click', async () => {
    try {
      triggerHaptic(20);
      await fetch('/api/doctor/skip', { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  });

  dom.btnDocRecall.addEventListener('click', async () => {
    try {
      triggerHaptic(20);
      const res = await fetch('/api/doctor/recall', { method: 'POST' });
      const data = await res.json();
      if (data.success && queueState.currentPatient && window.soundEffects) {
        window.soundEffects.announce(queueState.currentPatient.token, queueState.settings.roomNumber);
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Settings Save
  dom.btnSaveSettings.addEventListener('click', async () => {
    const avgTime = parseInt(dom.settingAvgTime.value, 10) || 7;
    const room = dom.settingRoom.value.trim() || 'Consultation Room 1';
    const doctor = dom.settingDoctor ? dom.settingDoctor.value.trim() : 'Dr. Naveen Pn';

    try {
      triggerHaptic(20);
      await fetch('/api/doctor/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avgConsultationTime: avgTime, roomNumber: room, doctorName: doctor })
      });
      showToast('Settings synced to all screens!', 'success', '⚙️');
    } catch (err) {
      showToast('Failed to save settings.', 'error', '⚠️');
    }
  });

  // Sound toggle
  dom.toggleSound.addEventListener('change', (e) => {
    if (window.soundEffects) {
      window.soundEffects.soundEnabled = e.target.checked;
      window.soundEffects.voiceEnabled = e.target.checked;
    }
  });

  // Reset Queue Data
  dom.btnResetQueue.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all queue data? This cannot be undone.')) {
      try {
        await fetch('/api/doctor/reset', { method: 'POST' });
        localStorage.removeItem('hqms_my_token');
        myPatientToken = null;
        renderAllViews();
        showToast('All queue data reset.', 'info', '🗑️');
      } catch (err) {
        showToast('Failed to reset queue.', 'error', '⚠️');
      }
    }
  });

  // Global methods for inline HTML onclick handlers
  window.doctorActions = {
    skipPatient: async (patientId) => {
      try {
        triggerHaptic(20);
        await fetch('/api/doctor/skip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId })
        });
      } catch (e) {
        console.error(e);
      }
    },
    recallPatient: async (patientId) => {
      try {
        triggerHaptic(20);
        await fetch('/api/doctor/recall', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId })
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Initialize
  initRoute();
  initDigitalClock();
  fetchInitialQueue();
  connectWebSocket();

})();
