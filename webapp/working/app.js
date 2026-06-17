const config = window.SPOTON_CONFIG || {};
const apiBaseUrl = config.apiBaseUrl || '/api/v1';
const WELCOME_SEEN_KEY = 'spoton.welcome.seen';
const appBasePath = config.appBasePath || '/app';
const mediaBaseUrl = config.mediaBaseUrl || '';
const mapConfig = {
  tileUrlTemplate: config.map?.tileUrlTemplate || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  defaultZoom: Number(config.map?.defaultZoom || 15),
  minZoom: Number(config.map?.minZoom || 3),
  maxZoom: Number(config.map?.maxZoom || 18),
  nearDistanceMeters: Number(config.map?.nearDistanceMeters || 120),
  closeDistanceMeters: Number(config.map?.closeDistanceMeters || 40)
};

const storageKeys = {
  activeSession: 'spoton.activeSession.v1',
  assignment: 'spoton.assignment.v1'
};

const state = {
  assignment: null,
  assignmentCode: '',
  sessionToken: null,
  progressByPlaceId: {},
  progressByBlockId: {},
  pendingBlockIds: new Set(),
  deferredPrompt: null,
  activePlaceId: null,
  activePanel: 'map',
  geolocationWatchId: null,
  userPosition: null,
  notesText: '',
  notesDirty: false,
  activeGroup: null,
  isPreviewMode: false,
  previewToken: null,
  notesSaving: false,
  notesSaveTimer: null,
  openClueIds: new Set(),
  viewedClueIds: new Set(),
  mapIntroDismissed: false,
  autoCompleteShown: false,
  map: {
    centerLat: null,
    centerLng: null,
    zoom: mapConfig.defaultZoom,
    mode: 'fitAll',
    tilesReady: false,
    renderQueued: false,
    layerEl: null,
    overlayEl: null,
    tileEls: new Map(),
    userMarkerEl: null,
    lastPositionTs: 0,
    hasFitAfterPosition: false,
    pendingRender: false,
    pointers: new Map(),
    pinch: null
  }
};

const els = {
  screenTitle: document.getElementById('screenTitle'),
  installBtn: document.getElementById('installBtn'),
  statusCard: document.getElementById('statusCard'),
  codeView: document.getElementById('codeView'),
  introView: document.getElementById('introView'),
  reopenIntroBtn: document.getElementById('reopenIntroBtn'),
  mapView: document.getElementById('mapView'),
  placeDetailView: document.getElementById('placeDetailView'),
  codeInput: document.getElementById('codeInput'),
  nicknameInput: document.getElementById('nicknameInput'),
  loadAssignmentBtn: document.getElementById('loadAssignmentBtn'),
  openStartGuideBtn: document.getElementById('openStartGuideBtn'),
  closeStartGuideBtn: document.getElementById('closeStartGuideBtn'),
  startGuideCard: document.getElementById('startGuideCard'),
  resetSessionBtn: document.getElementById('resetSessionBtn'),
  resumeCard: document.getElementById('resumeCard'),
  resumeAssignmentTitle: document.getElementById('resumeAssignmentTitle'),
  resumeAssignmentCode: document.getElementById('resumeAssignmentCode'),
  resumeBtn: document.getElementById('resumeBtn'),
  resumeDismissBtn: document.getElementById('resumeDismissBtn'),
  assignmentType: document.getElementById('assignmentType'),
  assignmentTitle: document.getElementById('assignmentTitle'),
  assignmentIntroTitle: document.getElementById('assignmentIntroTitle'),
  assignmentIntro: document.getElementById('assignmentIntro'),
  startAssignmentBtn: document.getElementById('startAssignmentBtn'),
  backToCodeBtn: document.getElementById('backToCodeBtn'),
  activeAssignmentTitle: document.getElementById('activeAssignmentTitle'),
  leaveAssignmentBtn: document.getElementById('leaveAssignmentBtn'),
  toggleListBtn: document.getElementById('toggleListBtn'),
  closeListBtn: document.getElementById('closeListBtn'),
  listBackdrop: document.getElementById('listBackdrop'),
  listPanel: document.getElementById('listPanel'),
  listSheetTitle: document.getElementById('listSheetTitle'),
  listSheetSubtitle: document.getElementById('listSheetSubtitle'),
  placesList: document.getElementById('placesList'),
  mapCanvas: document.getElementById('mapCanvas'),
  mapStatusText: document.getElementById('mapStatusText'),
  mapDistanceHint: document.getElementById('mapDistanceHint'),
  mapIntroCard: document.getElementById('mapIntroCard'),
  mapIntroCardTitle: document.getElementById('mapIntroCardTitle'),
  mapIntroCardBody: document.getElementById('mapIntroCardBody'),
  closeMapIntroBtn: document.getElementById('closeMapIntroBtn'),
  locateMeBtn: document.getElementById('locateMeBtn'),
  fitAllBtn: document.getElementById('fitAllBtn'),
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  backToMapBtn: document.getElementById('backToMapBtn'),
  backToListBtn: document.getElementById('backToListBtn'),
  assignmentTypeBadge: document.getElementById('assignmentTypeBadge'),
  assignmentPrimaryAction: document.getElementById('assignmentPrimaryAction'),
  assignmentMysteryHint: document.getElementById('assignmentMysteryHint'),
  assignmentPlaceCount: document.getElementById('assignmentPlaceCount'),
  assignmentVisitedCount: document.getElementById('assignmentVisitedCount'),
  detailBackdrop: document.getElementById('detailBackdrop'),
  detailHeroMedia: document.getElementById('detailHeroMedia'),
  groupSection: document.getElementById('groupSection'),
  createGroupBtn: document.getElementById('createGroupBtn'),
  joinGroupInput: document.getElementById('joinGroupInput'),
  joinGroupBtn: document.getElementById('joinGroupBtn'),
  groupCreated: document.getElementById('groupCreated'),
  groupInviteCode: document.getElementById('groupInviteCode'),
  groupStatus: document.getElementById('groupStatus'),
  leaderboardFabBtn: document.getElementById('leaderboardFabBtn'),
  leaderboardOverlay: document.getElementById('leaderboardOverlay'),
  leaderboardBackdrop: document.getElementById('leaderboardBackdrop'),
  leaderboardTitle: document.getElementById('leaderboardTitle'),
  leaderboardBody: document.getElementById('leaderboardBody'),
  closeLeaderboardBtn: document.getElementById('closeLeaderboardBtn'),
  refreshLeaderboardBtn: document.getElementById('refreshLeaderboardBtn'),
  notesFabBtn: document.getElementById('notesFabBtn'),
  notesOverlay: document.getElementById('notesOverlay'),
  notesBackdrop: document.getElementById('notesBackdrop'),
  closeNotesBtn: document.getElementById('closeNotesBtn'),
  notesTextarea: document.getElementById('notesTextarea'),
  notesStatus: document.getElementById('notesStatus'),
  detailCtaRow: document.getElementById('detailCtaRow'),
  detailRegisterVisitBtn: document.getElementById('detailRegisterVisitBtn'),
  detailPlaceOrder: document.getElementById('detailPlaceOrder'),
  completionView: document.getElementById('completionView'),
  digitalView: document.getElementById('digitalView'),
  completionBackdrop: document.getElementById('completionBackdrop'),
  completionBackBtn: document.getElementById('completionBackBtn'),
  completionCancelBtn: document.getElementById('completionCancelBtn'),
  completionConfirmBtn: document.getElementById('completionConfirmBtn'),
  completionLead: document.getElementById('completionLead'),
  completionPlacesStat: document.getElementById('completionPlacesStat'),
  completionAnswersStat: document.getElementById('completionAnswersStat'),
  completionCorrectStat: document.getElementById('completionCorrectStat'),
  completionScoreStat: document.getElementById('completionScoreStat'),
  completionModeNotice: document.getElementById('completionModeNotice'),
  completionRecentList: document.getElementById('completionRecentList'),
  detailPlaceTitle: document.getElementById('detailPlaceTitle'),
  detailPlaceDescription: document.getElementById('detailPlaceDescription'),
  detailContentList: document.getElementById('detailContentList'),
  placeTemplate: document.getElementById('placeTemplate'),
  autoCompleteView: document.getElementById('autoCompleteView'),
  autoCompleteBackdrop: document.getElementById('autoCompleteBackdrop'),
  autoCompleteTitle: document.getElementById('autoCompleteTitle'),
  autoCompleteLead: document.getElementById('autoCompleteLead'),
  autoCompleteSummaryWrap: document.getElementById('autoCompleteSummaryWrap'),
  autoCompletePlacesStat: document.getElementById('autoCompletePlacesStat'),
  autoCompleteAnswersStat: document.getElementById('autoCompleteAnswersStat'),
  autoCompleteCorrectStat: document.getElementById('autoCompleteCorrectStat'),
  autoCompleteScoreStat: document.getElementById('autoCompleteScoreStat'),
  autoCompleteModeNotice: document.getElementById('autoCompleteModeNotice'),
  autoCompleteRecentList: document.getElementById('autoCompleteRecentList'),
  autoCompleteSummaryToggleBtn: document.getElementById('autoCompleteSummaryToggleBtn'),
  autoCompleteFinishBtn: document.getElementById('autoCompleteFinishBtn'),
  autoCompleteContinueBtn: document.getElementById('autoCompleteContinueBtn')
};

init().catch((error) => {
  console.error(error);
  showStatus(error.message || 'Ett oväntat fel uppstod.', true);
});

async function init() {
  bindEvents();
  bindMapInteractions();
  await registerServiceWorker();
  const isPreview = hydrateFromQueryString();
  if (!isPreview) {
    hydrateFromStorage();
  }
  queueMapRender();
}

function bindEvents() {
  els.loadAssignmentBtn.addEventListener('click', handleLoadAssignment);
  if (els.openStartGuideBtn) {
    els.openStartGuideBtn.addEventListener('click', openStartGuide);
  }
  if (els.closeStartGuideBtn) {
    els.closeStartGuideBtn.addEventListener('click', closeStartGuide);
  }
  if (els.closeMapIntroBtn) {                                       // ← lägg till här
    els.closeMapIntroBtn.addEventListener('click', closeMapIntroCard);
  }

  // Välkomst-onboarding
  initWelcomeModal();
  els.startAssignmentBtn.addEventListener('click', handleStartAssignment);
  els.backToCodeBtn.addEventListener('click', () => showView('code'));

  if (els.createGroupBtn) els.createGroupBtn.addEventListener('click', handleCreateGroup);
  if (els.joinGroupBtn) els.joinGroupBtn.addEventListener('click', handleJoinGroup);
  if (els.joinGroupInput) els.joinGroupInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleJoinGroup(); });
  if (els.leaderboardFabBtn) els.leaderboardFabBtn.addEventListener('click', openLeaderboard);
  if (els.closeLeaderboardBtn) els.closeLeaderboardBtn.addEventListener('click', closeLeaderboard);
  if (els.refreshLeaderboardBtn) els.refreshLeaderboardBtn.addEventListener('click', () => loadLeaderboard());
  if (els.leaderboardBackdrop) els.leaderboardBackdrop.addEventListener('click', closeLeaderboard);
  els.resetSessionBtn.addEventListener('click', handleResetSession);

  if (els.resumeBtn) {
    els.resumeBtn.addEventListener('click', handleResumeAssignment);
  }
  if (els.resumeDismissBtn) {
    els.resumeDismissBtn.addEventListener('click', handleDismissResume);
  }
  els.leaveAssignmentBtn.addEventListener('click', handleLeaveAssignment);
  els.completionBackBtn.addEventListener('click', closeCompletionView);
  els.completionCancelBtn.addEventListener('click', closeCompletionView);
  els.completionBackdrop.addEventListener('click', closeCompletionView);
  els.completionConfirmBtn.addEventListener('click', handleConfirmCompleteAssignment);
  if (els.autoCompleteBackdrop) {
    els.autoCompleteBackdrop.addEventListener('click', closeAutoCompleteView);
  }
  if (els.autoCompleteContinueBtn) {
    els.autoCompleteContinueBtn.addEventListener('click', closeAutoCompleteView);
  }
  if (els.autoCompleteFinishBtn) {
    els.autoCompleteFinishBtn.addEventListener('click', handleAutoCompleteFinish);
  }
  if (els.autoCompleteSummaryToggleBtn) {
    els.autoCompleteSummaryToggleBtn.addEventListener('click', toggleAutoCompleteSummary);
  }
  els.toggleListBtn.addEventListener('click', () => setActivePanel(state.activePanel === 'list' ? 'map' : 'list'));
  if (els.assignmentPrimaryAction) {
    els.assignmentPrimaryAction.addEventListener('click', handleAssignmentPrimaryAction);
  }
  els.closeListBtn.addEventListener('click', () => setActivePanel('map'));
  els.listBackdrop.addEventListener('click', () => setActivePanel('map'));
  els.locateMeBtn.addEventListener('click', centerMapOnUser);
  els.fitAllBtn.addEventListener('click', fitMapToPlacesAndUser);
  els.zoomInBtn.addEventListener('click', () => zoomMap(1));
  els.zoomOutBtn.addEventListener('click', () => zoomMap(-1));
  els.backToMapBtn.addEventListener('click', async () => {
    if (isDigitalAssignment()) {
      await loadProgress(true);
      
      renderDigitalView();
      showView('digital');
    } else {
      setActivePanel('map');
      showView('map');
    }
  });
  els.backToListBtn.addEventListener('click', async () => {
    if (isDigitalAssignment()) {
      await loadProgress(true);
      renderDigitalView();
      showView('digital');
    } else {
      setActivePanel('list');
      showView('map');
    }
  });
  els.detailBackdrop.addEventListener('click', async () => {
    if (isDigitalAssignment()) {
      await loadProgress(true);
      renderDigitalView();
      showView('digital');
    } else {
      setActivePanel('map');
      showView('map');
    }
  });
  els.detailRegisterVisitBtn.addEventListener('click', handleRegisterVisitFromDetail);
  if (els.notesFabBtn) {
    els.notesFabBtn.addEventListener('click', toggleNotesPanel);
  }
  if (els.closeNotesBtn) {
    els.closeNotesBtn.addEventListener('click', () => closeNotesPanel());
  }
  if (els.notesBackdrop) {
    els.notesBackdrop.addEventListener('click', () => closeNotesPanel());
  }
  if (els.notesTextarea) {
    els.notesTextarea.addEventListener('input', handleNotesInput);
  }
 if (els.reopenIntroBtn) {
    els.reopenIntroBtn.addEventListener('click', () => {
      state.mapIntroDismissed = false;
      els.mapIntroCard.classList.remove('hidden');
      els.reopenIntroBtn.classList.add('hidden');
    });
  }
  els.installBtn.addEventListener('click', handleInstall);

  // iOS install-instruktioner
  const iosModal    = document.getElementById('iosInstallModal');
  const iosCloseBtn = document.getElementById('iosInstallCloseBtn');
  const iosDoneBtn  = document.getElementById('iosInstallDoneBtn');
  const installHintBtn = document.getElementById('installHintBtn');

  function closeIosModal() { if (iosModal) iosModal.close(); }
  if (iosCloseBtn) iosCloseBtn.addEventListener('click', closeIosModal);
  if (iosDoneBtn)  iosDoneBtn.addEventListener('click', closeIosModal);
  if (iosModal)    iosModal.addEventListener('click', (e) => { if (e.target === iosModal) closeIosModal(); });

  if (installHintBtn) {
    installHintBtn.addEventListener('click', () => {
      if (isIos() && !isInStandaloneMode()) {
        if (iosModal) iosModal.showModal();
      } else if (state.deferredPrompt) {
        handleInstall();
      }
    });
  }

  // Android: visa install-knapp när prompt finns
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    els.installBtn.classList.remove('hidden');
    if (installHintBtn) installHintBtn.classList.remove('hidden');
  });

  // iOS: visa hint om inte redan installerad
  if (isIos() && !isInStandaloneMode()) {
    if (installHintBtn) installHintBtn.classList.remove('hidden');
    els.installBtn.classList.remove('hidden');
    els.installBtn.addEventListener('click', () => {
      if (iosModal) iosModal.showModal();
    }, { once: true });
  }

  window.addEventListener('resize', queueMapRender);
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

async function handleInstall() {
  if (isIos() && !isInStandaloneMode()) {
    const iosModal = document.getElementById('iosInstallModal');
    if (iosModal) iosModal.showModal();
    return;
  }

  if (!state.deferredPrompt) return;

  state.deferredPrompt.prompt();
  await state.deferredPrompt.userChoice;
  state.deferredPrompt = null;
  els.installBtn.classList.add('hidden');
  const installHintBtn = document.getElementById('installHintBtn');
  if (installHintBtn) installHintBtn.classList.add('hidden');
}


function isMysteryAssignment() {
  const type = String(state.assignment?.type || '').trim().toLowerCase();
  return type === 'mystery' || type === 'treasure_hunt';
}

function isTrailAssignment() {
  const type = String(state.assignment?.type || '').trim().toLowerCase();
  return type === 'trail' || type === 'quiz_walk';
}

function isExplorationAssignment() {
  const type = String(state.assignment?.type || '').trim().toLowerCase();
  return type === 'exploration';
}

function isDigitalAssignment() {
  const type = String(state.assignment?.type || '').trim().toLowerCase();
  return type === 'digital';
}

function getNotesStorageKey() {
  if (!state.sessionToken) {
    return '';
  }

  return `spoton.notes.${state.sessionToken}`;
}

function getViewedCluesStorageKey() {
  if (!state.sessionToken) {
    return '';
  }

  return `spoton.clues.${state.sessionToken}`;
}

function hydrateViewedCluesFromStorage() {
  const key = getViewedCluesStorageKey();
  if (!key) {
    state.viewedClueIds = new Set();
    return;
  }

  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    const values = Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    state.viewedClueIds = new Set(values);
  } catch (error) {
    state.viewedClueIds = new Set();
  }
}

function persistViewedCluesToStorage() {
  const key = getViewedCluesStorageKey();
  if (!key) {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify([...state.viewedClueIds]));
  } catch (error) {
  }
}

function updateNotesVisibility() {
  const show = isMysteryAssignment() && !!state.sessionToken;

  if (els.notesFabBtn) {
    els.notesFabBtn.classList.toggle('hidden', !show);
  }

  if (!show) {
    state.activeGroup = null;
  closeLeaderboard();
  closeNotesPanel({ silent: true });
  }
}

function setNotesStatus(message, variant = 'idle') {
  if (!els.notesStatus) {
    return;
  }

  els.notesStatus.textContent = message || '';
  els.notesStatus.classList.remove('is-saving', 'is-error');

  if (variant === 'saving') {
    els.notesStatus.classList.add('is-saving');
  } else if (variant === 'error') {
    els.notesStatus.classList.add('is-error');
  }
}

function hydrateNotesFromSession(payload = {}) {
  const serverNotes = String(payload.notes || '');
  const localKey = getNotesStorageKey();
  const localDraft = localKey ? localStorage.getItem(localKey) : '';
  state.notesText = localDraft != null && localDraft !== '' ? localDraft : serverNotes;

  if (els.notesTextarea) {
    els.notesTextarea.value = state.notesText;
  }

  if (state.notesText) {
    setNotesStatus('Anteckningar sparas automatiskt.');
  } else {
    setNotesStatus('Tomt anteckningsblock.');
  }
}

function toggleNotesPanel() {
  if (els.notesOverlay?.classList.contains('active')) {
    closeNotesPanel();
  } else {
    openNotesPanel();
  }
}

function openNotesPanel(tab = 'notes') {
  if (!isMysteryAssignment() || !state.sessionToken) {
    return;
  }

  if (els.notesOverlay) {
    els.notesOverlay.classList.add('active');
  }

  if (els.notesBackdrop) {
    els.notesBackdrop.classList.add('active');
  }

  if (els.notesFabBtn) {
    els.notesFabBtn.setAttribute('aria-expanded', 'true');
  }

  if (els.notesTextarea) {
    els.notesTextarea.value = state.notesText || '';
    setTimeout(() => {
      try {
        els.notesTextarea.focus();
        els.notesTextarea.setSelectionRange(els.notesTextarea.value.length, els.notesTextarea.value.length);
      } catch (error) {
      }
    }, 40);
  }
}

function closeNotesPanel(options = {}) {
  const silent = !!options.silent;

  if (els.notesOverlay) {
    els.notesOverlay.classList.remove('active');
  }

  if (els.notesBackdrop) {
    els.notesBackdrop.classList.remove('active');
  }

  if (els.notesFabBtn) {
    els.notesFabBtn.setAttribute('aria-expanded', 'false');
  }

  if (!silent && state.notesDirty) {
    saveNotesNow();
  }
}

function switchNotesTab(tab) {
  state.activeNotesTab = tab;

  const notesContent = document.getElementById('notesTabContent');
  const evidenceContent = document.getElementById('evidenceTabContent');

  if (els.notesTabBtn) {
    els.notesTabBtn.classList.toggle('notes-tab-active', tab === 'notes');
  }
  if (els.evidenceTabBtn) {
    els.evidenceTabBtn.classList.toggle('notes-tab-active', tab === 'evidence');
  }
  if (notesContent) {
    notesContent.style.display = tab === 'notes' ? '' : 'none';
  }
  if (evidenceContent) {
    evidenceContent.style.display = tab === 'evidence' ? '' : 'none';
  }

  if (tab === 'notes' && els.notesTextarea) {
    els.notesTextarea.value = state.notesText || '';
    setTimeout(() => {
      try {
        els.notesTextarea.focus();
        els.notesTextarea.setSelectionRange(els.notesTextarea.value.length, els.notesTextarea.value.length);
      } catch (e) {}
    }, 40);
  }

  if (tab === 'evidence') {
    renderEvidenceList();
  }
}

function collectEvidence() {
  const places = getPlaces();
  const collected = [];

  for (const place of places) {
    if (!hasVisitedPlace(place.id)) continue;
    const blocks = getContentBlocks(place);
    for (const block of blocks) {
      if (normalizeBlockType(block.type) === 'evidence') {
        collected.push({ block, place });
      }
    }
  }

  return collected;
}

function getEvidenceCount() {
  return collectEvidence().length;
}

function getTotalEvidenceCount() {
  const places = getPlaces();
  let total = 0;
  for (const place of places) {
    const blocks = getContentBlocks(place);
    for (const block of blocks) {
      if (normalizeBlockType(block.type) === 'evidence') total++;
    }
  }
  return total;
}

function renderEvidenceList() {
  const container = els.evidenceList;
  if (!container) return;

  container.innerHTML = '';
  const collected = collectEvidence();
  const total = getTotalEvidenceCount();

  if (total === 0) {
    const empty = document.createElement('div');
    empty.className = 'evidence-empty';
    empty.textContent = 'Det finns inga bevis i det här uppdraget.';
    container.appendChild(empty);
    return;
  }

  // Insamlade bevis
  for (const { block } of collected) {
    const card = document.createElement('div');
    card.className = 'evidence-card';

    const header = document.createElement('div');
    header.className = 'evidence-card-header';

    if (block.evidence_label) {
      const label = document.createElement('span');
      label.className = 'evidence-label-badge';
      label.textContent = block.evidence_label;
      header.appendChild(label);
    }

    const title = document.createElement('span');
    title.className = 'evidence-card-title';
    title.textContent = block.title || 'Bevis';
    header.appendChild(title);
    card.appendChild(header);

    if (block.body) {
      const desc = document.createElement('p');
      desc.className = 'evidence-card-desc';
      desc.textContent = block.body;
      card.appendChild(desc);
    }

    if (block.evidence_detail) {
      const detailWrap = document.createElement('div');
      detailWrap.className = 'evidence-detail-wrap';
      const detailBtn = document.createElement('button');
      detailBtn.type = 'button';
      detailBtn.className = 'evidence-detail-btn';
      detailBtn.textContent = 'Granska närmare';
      const detailText = document.createElement('div');
      detailText.className = 'evidence-detail-text hidden';
      detailText.textContent = block.evidence_detail;
      detailBtn.addEventListener('click', () => {
        const hidden = detailText.classList.toggle('hidden');
        detailBtn.textContent = hidden ? 'Granska närmare' : 'Dölj';
      });
      detailWrap.appendChild(detailBtn);
      detailWrap.appendChild(detailText);
      card.appendChild(detailWrap);
    }

    if (block.media_url) {
      const img = document.createElement('img');
      img.src = block.media_url;
      img.alt = block.title || 'Bevis';
      img.className = 'evidence-card-img';
      img.loading = 'lazy';
      card.appendChild(img);
    }

    container.appendChild(card);
  }

  // Ej hittade bevis som platshållare
  const notFound = total - collected.length;
  for (let i = 0; i < notFound; i++) {
    const placeholder = document.createElement('div');
    placeholder.className = 'evidence-card evidence-card-hidden';
    const label = document.createElement('span');
    label.className = 'evidence-label-badge evidence-label-unknown';
    label.textContent = 'BEVIS ?';
    const title = document.createElement('span');
    title.className = 'evidence-card-title';
    title.textContent = 'Ej hittat ännu';
    placeholder.appendChild(label);
    placeholder.appendChild(title);
    container.appendChild(placeholder);
  }
}

function updateEvidenceBadge() {
  if (!els.evidenceTabBtn) return;
  const count = getEvidenceCount();
  const total = getTotalEvidenceCount();
  if (total === 0) return;
  els.evidenceTabBtn.textContent = `Bevis (${count}/${total})`;
}


function handleNotesInput(event) {
  const value = String(event?.target?.value || '');
  state.notesText = value;
  state.notesDirty = true;

  const key = getNotesStorageKey();
  if (key) {
    localStorage.setItem(key, value);
  }

  setNotesStatus('Sparar anteckning...', 'saving');

  if (state.notesSaveTimer) {
    clearTimeout(state.notesSaveTimer);
  }

  state.notesSaveTimer = setTimeout(() => {
    saveNotesNow();
  }, 500);
}

async function saveNotesNow() {
  if (!state.sessionToken || !isMysteryAssignment()) {
    return false;
  }

  if (state.notesSaveTimer) {
    clearTimeout(state.notesSaveTimer);
    state.notesSaveTimer = null;
  }

  if (!state.notesDirty && !state.notesSaving) {
    if (state.notesText) {
      setNotesStatus('Anteckningar sparas automatiskt.');
    } else {
      setNotesStatus('Tomt anteckningsblock.');
    }
    return true;
  }

  state.notesSaving = true;
  setNotesStatus('Sparar anteckning...', 'saving');

  try {
    await fetchJson(`${apiBaseUrl}/sessions/${encodeURIComponent(state.sessionToken)}/notes`, {
      method: 'PUT',
      body: JSON.stringify({
        content: state.notesText || ''
      })
    });

    state.notesDirty = false;
    state.notesSaving = false;

    const key = getNotesStorageKey();
    if (key) {
      localStorage.setItem(key, state.notesText || '');
    }

    if (state.notesText) {
      setNotesStatus('Anteckning sparad.');
    } else {
      setNotesStatus('Tomt anteckningsblock.');
    }

    return true;
  } catch (error) {
    console.error('Notes save error', error);
    state.notesSaving = false;
    setNotesStatus('Kunde inte spara anteckningen just nu.', 'error');
    return false;
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  await navigator.serviceWorker.register(`${appBasePath}/service-worker.js`, {
    scope: `${appBasePath}/`
  });
}

function hydrateFromQueryString() {
  const params = new URLSearchParams(window.location.search);
  const code    = params.get('code');
  const session = params.get('session');
  const preview = params.get('preview');

  if (preview) {
    state.previewToken = String(preview).trim();
    state.isPreviewMode = true;
    loadPreviewAssignment(state.previewToken);
    return true;
  }

  if (code) {
    const normalized = String(code).trim().toUpperCase();
    els.codeInput.value = normalized;
    state.assignmentCode = normalized;
  }

  if (session) {
    const token = String(session).trim();
    if (token) {
      state.sessionToken = token;
      persistSession(token, '');
    }
  }
  return false;
}

async function loadPreviewAssignment(token) {
  try {
    showStatus('Laddar förhandsgranskning...');
    const response = await fetchJson(`${apiBaseUrl}/assignments/preview/${encodeURIComponent(token)}`);
    const assignment = response?.data || response;
    if (!assignment?.id) throw new Error('Uppdraget kunde inte läsas in.');
    state.assignment = normalizeAssignment({ ...assignment, access_code: assignment.access_code || 'PREVIEW' });
    state.assignmentCode = assignment.access_code || 'PREVIEW';
    state.sessionToken = 'preview-' + token.substring(0, 8);
    state.isPreviewMode = true;
    renderIntro(state.assignment);
    showView('intro');
    showStatus('Förhandsgranskning aktiv — GPS-krav inaktiverat');
    setTimeout(() => showStatus(''), 3000);
  } catch (err) {
    showStatus('Förhandsgranskningsfel: ' + err.message, true);
  }
}

function hydrateFromStorage() {
  const savedAssignment = safeJsonParse(localStorage.getItem(storageKeys.assignment));
  const savedSession = safeJsonParse(localStorage.getItem(storageKeys.activeSession));

  if (savedAssignment?.access_code) {
    state.assignmentCode = String(savedAssignment.access_code).trim().toUpperCase();
    els.codeInput.value = state.assignmentCode;
  }

  if (savedAssignment?.id) {
    state.assignment = normalizeAssignment(savedAssignment);
  }

  if (savedSession?.sessionToken) {
    state.sessionToken = savedSession.sessionToken;
  }

  if (savedSession?.nickname) {
    els.nicknameInput.value = savedSession.nickname;
  }

  // Visa återuppta-kort om det finns ett sparat uppdrag
  if (savedAssignment?.id && savedAssignment?.title) {
    showResumeCard(savedAssignment, savedSession);
  }

  // Om både uppdrag och session finns — gå direkt till intro
  if (savedAssignment?.id && savedSession?.sessionToken) {
    renderIntro(savedAssignment);
    showView('intro');
  }
}

function showResumeCard(assignment, session) {
  if (!els.resumeCard) return;

  const title = assignment.title || 'Pågående uppdrag';
  const code = assignment.access_code || assignment.accessCode || '';

  if (els.resumeAssignmentTitle) {
    els.resumeAssignmentTitle.textContent = title;
  }
  if (els.resumeAssignmentCode) {
    els.resumeAssignmentCode.textContent = code ? `Kod: ${code}` : '';
  }

  els.resumeCard.classList.remove('hidden');
}

function hideResumeCard() {
  if (els.resumeCard) {
    els.resumeCard.classList.add('hidden');
  }
}

// ─── Ett försök per enhet ─────────────────────────────────────
function getSingleAttemptKey(code) {
  return `spoton.attempted.${String(code).toUpperCase()}`;
}

function hasAttemptedAssignment(code) {
  return localStorage.getItem(getSingleAttemptKey(code)) === '1';
}

function markAssignmentAttempted() {
  const code = state.assignmentCode || state.assignment?.access_code;
  if (code && state.assignment?.single_attempt) {
    localStorage.setItem(getSingleAttemptKey(code), '1');
  }
}

function clearAssignmentAttempt(code) {
  localStorage.removeItem(getSingleAttemptKey(code));
}

function handleResumeAssignment() {
  // Om session finns — gå direkt till intro
  if (state.assignment && state.sessionToken) {
    renderIntro(state.assignment);
    showView('intro');
    return;
  }

  // Annars — fyll i koden och låt användaren starta om
  if (state.assignmentCode) {
    els.codeInput.value = state.assignmentCode;
  }
  hideResumeCard();
  els.loadAssignmentBtn.click();
}

function handleDismissResume() {
  hideResumeCard();
  resetLocalSession();
  els.codeInput.value = '';
  els.codeInput.focus();
}

async function handleLoadAssignment() {
  const code = String(els.codeInput.value || '').trim().toUpperCase();

  if (!code) {
    showStatus('Ange en åtkomstkod först.', true);
    els.codeInput.focus();
    return;
  }

  const originalText = els.loadAssignmentBtn.textContent;
  els.loadAssignmentBtn.disabled = true;
  els.loadAssignmentBtn.textContent = 'Hämtar...';

  try {
    showStatus('Hämtar uppdrag...');

    const response = await fetchJson(`${apiBaseUrl}/assignments/${encodeURIComponent(code)}`);
    const assignment = response?.data || response;

    if (!assignment || !assignment.id) {
      throw new Error('Uppdraget kunde inte läsas in från API:et.');
    }

    state.assignmentCode = code;
    state.mapIntroDismissed = false;
    closeStartGuide();
    state.assignment = normalizeAssignment({
      ...assignment,
      access_code: assignment.access_code || assignment.accessCode || code
    });

    // Kontrollera ett-försök-per-enhet
    if (state.assignment.single_attempt && hasAttemptedAssignment(code)) {
      showStatus(
        `Du har redan genomfört det här uppdraget på den här enheten. Tryck på "Nollställ lokal session" om du vill köra om.`,
        true
      );
      state.assignment = null;
      state.assignmentCode = '';
      return;
    }

    persistAssignment(state.assignment, state.assignmentCode);
    renderIntro(state.assignment);
    showView('intro');
    showStatus('Uppdraget har laddats.');
  } catch (error) {
    console.error('handleLoadAssignment', error);
    const msg = String(error.message || '');
    if (msg.includes('anslutning')) {
      showStatus('Ingen anslutning till servern. Kontrollera din internetanslutning och försök igen.', true);
    } else if (msg.toLowerCase().includes('hittades') || msg.includes('404')) {
      showStatus(`Koden "${code}" hittades inte. Kontrollera att du stavat rätt och att uppdraget är aktivt.`, true);
    } else if (msg.includes('inte börjat')) {
      showStatus('Uppdraget har inte börjat ännu. Kontakta arrangören för mer information.', true);
    } else if (msg.includes('avslutat')) {
      showStatus('Uppdraget är avslutat och kan inte längre öppnas.', true);
    } else {
      showStatus(msg || 'Uppdraget kunde inte hämtas. Försök igen.', true);
    }
  } finally {
    els.loadAssignmentBtn.disabled = false;
    els.loadAssignmentBtn.textContent = originalText;
  }
}

function renderIntro(assignment) {
  els.assignmentType.textContent = humanizeType(assignment.type);
  els.assignmentTitle.textContent = assignment.title || 'Uppdrag';

  const introTitle = String(assignment.intro_title || '').trim();
  const introBody = String(assignment.intro_body || '').trim();
  const fallbackText = 'Tryck på Starta uppdrag för att fortsätta.';

  if (els.assignmentIntroTitle) {
    els.assignmentIntroTitle.textContent = introTitle;
    els.assignmentIntroTitle.classList.toggle('hidden', !introTitle);
  }

  els.assignmentIntro.textContent = introBody || fallbackText;

  const isTrail = assignment.type === 'trail';
  if (els.groupSection) els.groupSection.classList.toggle('hidden', !isTrail);
  if (els.startAssignmentBtn) els.startAssignmentBtn.textContent = isTrail ? 'Spela enskilt' : 'Starta uppdrag';
  resetGroupSection();
}

function getMapIntroText() {
  return String(state.assignment?.description || '').trim();
}

function closeMapIntroCard() {
  state.mapIntroDismissed = true;
  if (els.mapIntroCard) {
    els.mapIntroCard.classList.add('hidden');
    els.reopenIntroBtn?.classList.remove('hidden');
  }
}

function updateMapIntroCard() {
  if (!els.mapIntroCard || !els.mapIntroCardBody || !els.mapIntroCardTitle) {
    return;
  }

  const text = getMapIntroText();
  const introTitle = String(state.assignment?.intro_title || '').trim();

  if (!text || state.mapIntroDismissed || !state.sessionToken) {
    els.mapIntroCard.classList.add('hidden');
    return;
  }

  els.mapIntroCardTitle.textContent = introTitle || 'Information';
  els.mapIntroCardBody.textContent = text;
  els.mapIntroCard.classList.remove('hidden');
}


// ─── Gruppfunktioner ──────────────────────────────────────────

function resetGroupSection() {
  if (els.groupCreated) els.groupCreated.classList.add('hidden');
  if (els.groupInviteCode) els.groupInviteCode.textContent = '';
  if (els.joinGroupInput) els.joinGroupInput.value = '';
  if (els.groupStatus) {
    els.groupStatus.classList.add('hidden');
    els.groupStatus.textContent = '';
    els.groupStatus.className = 'group-status hidden';
  }
  if (els.createGroupBtn) els.createGroupBtn.disabled = false;
}

function showGroupStatus(msg, type) {
  if (!els.groupStatus) return;
  els.groupStatus.textContent = msg;
  els.groupStatus.className = 'group-status ' + type;
  els.groupStatus.classList.remove('hidden');
}

async function handleCreateGroup() {
  if (!state.assignment?.id) {
    showGroupStatus('Inget uppdrag laddat.', 'error');
    return;
  }
  if (els.createGroupBtn) els.createGroupBtn.disabled = true;
  showGroupStatus('Startar...', '');
  try {
    let sessionToken = state.sessionToken;
    if (!sessionToken) {
      showGroupStatus('Skapar grupp...', '');
      const nickname = String(els.nicknameInput?.value || '').trim();
      const accessCode = String(state.assignmentCode || state.assignment?.access_code || els.codeInput?.value || '').trim().toUpperCase();
      if (!accessCode) throw new Error('Åtkomstkod saknas.');
      const sessionResp = await fetchJson(`${apiBaseUrl}/sessions`, {
        method: 'POST',
        body: JSON.stringify({ access_code: accessCode, nickname: nickname || undefined, assignment_id: state.assignment.id })
      });
      sessionToken = sessionResp?.data?.session_token || sessionResp?.session_token || sessionResp?.data?.token || sessionResp?.token;
      if (!sessionToken) throw new Error('Sessionen kunde inte startas.');
      state.sessionToken = sessionToken;
      persistSession(sessionToken, String(els.nicknameInput?.value || '').trim());
      persistAssignment(state.assignment, accessCode);
    }
    showGroupStatus('Skapar grupp...', '');
    const nickname = String(els.nicknameInput?.value || '').trim();
    const response = await fetchJson(`${apiBaseUrl}/events/create`, {
      method: 'POST',
      body: JSON.stringify({
        assignment_id: state.assignment.id,
        session_token: sessionToken,
        display_name: nickname || null,
        group_name: (state.assignment.title || 'Grupp').substring(0, 40)
      })
    });
    if (!response.ok) throw new Error(response.error || 'Kunde inte skapa grupp.');
    state.activeGroup = { event_id: response.event_id, invite_code: response.invite_code, group_name: response.group_name };
    if (els.groupInviteCode) els.groupInviteCode.textContent = response.invite_code;
    if (els.groupCreated) els.groupCreated.classList.remove('hidden');
    if (els.groupStatus) els.groupStatus.classList.add('hidden');
    if (els.createGroupBtn) els.createGroupBtn.disabled = false;
    updateLeaderboardBtnVisibility();
  } catch (err) {
    if (els.createGroupBtn) els.createGroupBtn.disabled = false;
    showGroupStatus(err.message || 'Kunde inte skapa grupp.', 'error');
  }
}

async function handleJoinGroup() {
  const code = String(els.joinGroupInput?.value || '').trim().toUpperCase();
  if (!code) { showGroupStatus('Ange en gruppkod.', 'error'); els.joinGroupInput?.focus(); return; }
  if (els.joinGroupBtn) els.joinGroupBtn.disabled = true;
  showGroupStatus('Ansluter...', '');
  try {
    let sessionToken = state.sessionToken;
    if (!sessionToken) {
      const nickname = String(els.nicknameInput?.value || '').trim();
      const accessCode = String(state.assignmentCode || state.assignment?.access_code || els.codeInput?.value || '').trim().toUpperCase();
      if (!accessCode) throw new Error('Åtkomstkod saknas.');
      const sessionResp = await fetchJson(`${apiBaseUrl}/sessions`, {
        method: 'POST',
        body: JSON.stringify({ access_code: accessCode, nickname: nickname || undefined, assignment_id: state.assignment.id })
      });
      sessionToken = sessionResp?.data?.session_token || sessionResp?.session_token || sessionResp?.data?.token || sessionResp?.token;
      if (!sessionToken) throw new Error('Sessionen kunde inte startas.');
      state.sessionToken = sessionToken;
      persistSession(sessionToken, String(els.nicknameInput?.value || '').trim());
      persistAssignment(state.assignment, accessCode);
    }
    showGroupStatus('Ansluter till grupp...', '');
    const nickname = String(els.nicknameInput?.value || '').trim();
    const response = await fetchJson(`${apiBaseUrl}/events/join`, {
      method: 'POST',
      body: JSON.stringify({ invite_code: code, session_token: sessionToken, display_name: nickname || null })
    });
    if (!response.ok) throw new Error(response.error || 'Kunde inte gå med i grupp.');
    state.activeGroup = { event_id: response.event_id, invite_code: response.invite_code, group_name: response.group_name };
    showGroupStatus('Du är med i gruppen "' + response.group_name + '"! Tryck Spela enskilt för att starta.', 'success');
    if (els.joinGroupBtn) els.joinGroupBtn.disabled = false;
    updateLeaderboardBtnVisibility();
  } catch (err) {
    if (els.joinGroupBtn) els.joinGroupBtn.disabled = false;
    showGroupStatus(err.message || 'Kunde inte gå med i grupp.', 'error');
  }
}

function isInGroup() {
  return !!(state.activeGroup?.event_id && state.sessionToken);
}

function updateLeaderboardBtnVisibility() {
  if (!els.leaderboardFabBtn) return;
  els.leaderboardFabBtn.classList.toggle('hidden', !isInGroup());
}

function openLeaderboard() {
  if (!isInGroup()) return;
  if (els.leaderboardTitle && state.activeGroup?.group_name) {
    els.leaderboardTitle.textContent = state.activeGroup.group_name;
  }
  if (els.leaderboardOverlay) {
    els.leaderboardOverlay.classList.add('active');
  }
  if (els.leaderboardBackdrop) {
    els.leaderboardBackdrop.classList.add('active');
  }
  loadLeaderboard();
}

function closeLeaderboard() {
  if (els.leaderboardOverlay) els.leaderboardOverlay.classList.remove('active');
  if (els.leaderboardBackdrop) els.leaderboardBackdrop.classList.remove('active');
}

async function loadLeaderboard() {
  if (!state.activeGroup?.event_id || !state.sessionToken) return;
  if (!els.leaderboardBody) return;
  els.leaderboardBody.innerHTML = '<div class="leaderboard-empty">Hämtar...</div>';
  try {
    const url = `${apiBaseUrl}/events/${state.activeGroup.event_id}/leaderboard?session_token=${encodeURIComponent(state.sessionToken)}`;
    const response = await fetchJson(url);
    if (!response.ok) throw new Error(response.error || 'Kunde inte hämta topplista.');
    const { leaderboard, invite_code, group_name } = response;
    let html = `<div class="leaderboard-group-info"><span class="leaderboard-group-name">${group_name || ''}</span><span class="leaderboard-group-code">${invite_code || ''}</span></div><div class="leaderboard-list">`;
    if (!leaderboard || leaderboard.length === 0) {
      html += '<div class="leaderboard-empty">Inga deltagare ännu.</div>';
    } else {
      leaderboard.forEach(row => {
        const rankClass = row.rank <= 3 ? 'rank-' + row.rank : '';
        const meClass = row.is_me ? 'is-me' : '';
        html += `<div class="leaderboard-row ${meClass}"><div class="leaderboard-rank ${rankClass}">${row.rank}</div><div style="flex:1"><div class="leaderboard-name">${row.display_name}${row.is_me ? ' (du)' : ''}</div><div class="leaderboard-meta">${row.places_visited} platser · ${row.correct_answers} rätt</div></div><div class="leaderboard-points">${row.total_points}p</div></div>`;
      });
    }
    html += '</div>';
    els.leaderboardBody.innerHTML = html;
  } catch (err) {
    els.leaderboardBody.innerHTML = `<div class="leaderboard-empty">${err.message || 'Kunde inte hämta topplista.'}</div>`;
  }
}

async function handleStartAssignment() {
  if (!state.assignment?.id) {
    showStatus('Det finns inget aktivt uppdrag att starta.', true);
    return;
  }

  const originalText = els.startAssignmentBtn.textContent;
  els.startAssignmentBtn.disabled = true;
  els.startAssignmentBtn.textContent = 'Startar...';

  try {
    if (!state.sessionToken) {
      showStatus('Startar session...');

      const nickname = String(els.nicknameInput.value || '').trim();
      const accessCode =
        String(
          state.assignmentCode ||
          state.assignment?.access_code ||
          state.assignment?.accessCode ||
          els.codeInput.value ||
          ''
        ).trim().toUpperCase();

      if (!accessCode) {
        throw new Error('Åtkomstkod saknas inför start av session.');
      }

      const payload = {
        access_code: accessCode,
        nickname: nickname || undefined,
        assignment_id: state.assignment.id
      };

      const response = await fetchJson(`${apiBaseUrl}/sessions`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const sessionToken =
        response?.data?.session_token ||
        response?.data?.token ||
        response?.session_token ||
        response?.token ||
        response?.data?.session?.session_token ||
        response?.data?.session?.token ||
        response?.session?.session_token ||
        response?.session?.token;

      if (!sessionToken) {
        console.error('Oväntat svar från POST /sessions:', response);
        throw new Error('Session kunde inte startas. API:et returnerade ingen session_token.');
      }

      state.sessionToken = sessionToken;
      persistSession(sessionToken, nickname || '');
      persistAssignment(state.assignment, accessCode);
    }

    await loadProgress();
    hydrateViewedCluesFromStorage();
    state.positionResolved = false;
    state.positionDenied = false;

    if (isDigitalAssignment()) {
      renderDigitalView();
      showView('digital');
      showStatus('Sessionen är aktiv.');
      setTimeout(() => showStatus(''), 3000);
    } else {
      renderAssignmentView();
      startGeolocationWatch();
      setActivePanel('map');
      showView('map');
      showStatus('Sessionen är aktiv.');
    }

    startCountdownTimer();
  } catch (error) {
    console.error('handleStartAssignment', error);
    showStatus(error.message || 'Kunde inte starta sessionen.', true);
  } finally {
    els.startAssignmentBtn.disabled = false;
    els.startAssignmentBtn.textContent = originalText;
  }
}

async function loadProgress(preserveOnError = false) {
  if (!state.sessionToken) {
    return;
  }

  if (state.isPreviewMode) {
    renderAssignmentView();
    if (state.activePlaceId) {
      const place = getPlaceById(state.activePlaceId);
      if (place) renderPlaceDetail(place);
    }
    return;
  }

  try {
    const response = await fetchJson(`${apiBaseUrl}/sessions/${encodeURIComponent(state.sessionToken)}`);
    const payload = response?.data || response || {};
    const progressRows = payload.progress || [];
    const indexes = buildProgressIndexes(progressRows);
    state.progressByPlaceId = indexes.byPlaceId;
    state.progressByBlockId = indexes.byBlockId;

    if (payload.grading_mode && state.assignment) {
      state.assignment.grading_mode = payload.grading_mode;
    }

    hydrateNotesFromSession(payload);
  } catch (error) {
    const msg = String(error.message || '');

    if (msg.includes('404')) {
      showSessionExpiredDialog();
    } else if (msg.includes('anslutning')) {
      showStatus('Ingen anslutning. Framsteg visas när du är online igen.', true);
    } else {
      console.warn('Kunde inte läsa progress.', error);
    }

    if (!preserveOnError) {
      state.progressByPlaceId = {};
      state.progressByBlockId = {};
    }
  }
}

function showSessionExpiredDialog() {
  const modal       = document.getElementById('sessionExpiredModal');
  const restartBtn  = document.getElementById('sessionExpiredRestartBtn');
  const continueBtn = document.getElementById('sessionExpiredContinueBtn');
  const homeBtn     = document.getElementById('sessionExpiredHomeBtn');

  if (!modal) {
    showStatus('Din session har löpt ut. Nollställ och starta om uppdraget.', true);
    return;
  }

  modal.showModal();

  // Klona knappar för att undvika dubbla lyssnare
  const newRestart  = restartBtn.cloneNode(true);
  const newContinue = continueBtn.cloneNode(true);
  const newHome     = homeBtn.cloneNode(true);
  restartBtn.parentNode.replaceChild(newRestart, restartBtn);
  continueBtn.parentNode.replaceChild(newContinue, continueBtn);
  homeBtn.parentNode.replaceChild(newHome, homeBtn);

  // Starta om — nollställ session men behåll uppdrag, starta ny session
  newRestart.addEventListener('click', async () => {
    modal.close();
    const code = state.assignmentCode || state.assignment?.access_code;
    state.sessionToken = null;
    localStorage.removeItem('spoton.session');
    if (code) {
      els.codeInput.value = code;
      await handleStartAssignment();
    } else {
      resetLocalSession();
      showView('code');
    }
  });

  // Fortsätt utan session — stäng dialogen, framsteg sparas inte
  newContinue.addEventListener('click', () => {
    modal.close();
    state.sessionToken = null;
    showStatus('Du fortsätter utan aktiv session. Framsteg sparas inte.', true);
  });

  // Gå till start
  newHome.addEventListener('click', () => {
    modal.close();
    resetLocalSession();
    showView('code');
  });
}

function renderAssignmentView() {
  document.body.dataset.mode = isMysteryAssignment() ? 'mystery' : 'standard';
  renderPlaces();
  updateAssignmentSummary();
  updateNotesVisibility();
  updateMapStatus();
  fitMapToPlacesAndUser(false);
  queueMapRender();
}

// ─── Digital uppdragslista (utan karta) ───────────────────────
function renderDigitalView() {
  const view = els.digitalView;
  if (!view) return;

  const places = state.assignment?.places || [];
  const sorted = [...places].sort((a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0));

  // Räkna totalt antal besökta steg
  const visitedCount = sorted.filter(p => hasVisitedPlace(p.id)).length;
  const totalCount   = sorted.length;

  // Rubrik och progress
  const titleEl    = view.querySelector('#digitalTitle');
  const progressEl = view.querySelector('#digitalProgress');
  const listEl     = view.querySelector('#digitalStepList');
  const leaveBtn   = view.querySelector('#digitalLeaveBtn');
  const notesBtn   = view.querySelector('#digitalNotesBtn');

  if (titleEl)    titleEl.textContent = state.assignment?.title || 'Uppdrag';
  if (progressEl) progressEl.textContent = `${visitedCount} av ${totalCount} steg slutförda`;

  // Visa meddelande när alla steg är klara
  const allDone = totalCount > 0 && visitedCount >= totalCount;
  if (allDone && !state._allVisitedNotified && state.sessionToken) {
    state._allVisitedNotified = true;
    showStatus('Alla steg klara! Tryck på "Avsluta uppdrag" för att slutföra.');
  }

  if (notesBtn) {
    notesBtn.classList.toggle('hidden', !isMysteryAssignment());
  }

  if (leaveBtn && !leaveBtn._bound) {
    leaveBtn._bound = true;
    leaveBtn.addEventListener('click', () => {
      const places = getPlaces();
      const visitedCount = places.filter((p) => hasVisitedPlace(p.id)).length;
      const allDone = places.length > 0 && visitedCount >= places.length;

      if (allDone) {
        showView('completion');
      } else {
        showLeaveConfirmDialog(() => showView('completion'));
      }
    });
  }

  if (notesBtn && !notesBtn._bound) {
    notesBtn._bound = true;
    notesBtn.addEventListener('click', openNotesPanel);
  }

  if (!listEl) return;
  listEl.innerHTML = '';

  sorted.forEach((place, index) => {
    const isVisited   = hasVisitedPlace(place.id);
    const prevPlace   = sorted[index - 1];
    const isLocked    = index > 0 && !hasVisitedPlace(prevPlace?.id);
    const isCurrent   = !isVisited && !isLocked;

    const item = document.createElement('div');
    item.className = 'digital-step' +
      (isVisited ? ' digital-step--done' : '') +
      (isLocked  ? ' digital-step--locked' : '') +
      (isCurrent ? ' digital-step--current' : '');

    const number = document.createElement('div');
    number.className = 'digital-step-number';
    number.textContent = isVisited ? '✓' : (index + 1);

    const body = document.createElement('div');
    body.className = 'digital-step-body';

    const stepTitle = document.createElement('div');
    stepTitle.className = 'digital-step-title';
    stepTitle.textContent = place.title || `Steg ${index + 1}`;

    body.appendChild(stepTitle);

    if (place.short_description && !isLocked) {
      const desc = document.createElement('div');
      desc.className = 'digital-step-desc';
      desc.textContent = place.short_description;
      body.appendChild(desc);
    }

    if (isLocked) {
      const lock = document.createElement('div');
      lock.className = 'digital-step-locked-note';
      lock.textContent = `🔒 Låses upp när steg ${index} är klart`;
      body.appendChild(lock);
    }

    if (!isLocked) {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (isVisited ? 'btn-ghost' : 'primary') + ' digital-step-btn';
      btn.type = 'button';
      btn.textContent = isVisited ? 'Öppna igen' : 'Öppna steg';
      btn.addEventListener('click', () => handleDigitalStepOpen(place));
      body.appendChild(btn);
    }

    item.appendChild(number);
    item.appendChild(body);
    listEl.appendChild(item);
  });
}

async function handleDigitalStepOpen(place) {
  state.selectedPlace = place;

  // Registrera besök om inte redan gjort
  const alreadyVisited = hasVisitedPlace(place.id);
  if (!alreadyVisited && state.sessionToken) {
    try {
      await fetchJson(`${apiBaseUrl}/sessions/${encodeURIComponent(state.sessionToken)}/progress`, {
        method: 'POST',
        body: JSON.stringify({ place_id: place.id })
      });

      // Markera lokalt direkt så att nästa steg låses upp utan fördröjning
      const pid = String(place.id);
      state.progressByPlaceId[pid] = {
        ...(state.progressByPlaceId[pid] || {}),
        place_id: place.id,
        visited_at: new Date().toISOString(),
        visited: true,
      };

      // Ladda om progress från server i bakgrunden
      loadProgress(true).catch(() => {});
    } catch (e) {
      console.warn('Kunde inte registrera besök:', e.message);
    }
  }

  state.activePlaceId = place.id;
  renderPlaceDetail(place);
  showView('placeDetail');
}

function setActivePanel(panel) {
  const nextPanel = panel === 'list' ? 'list' : panel === 'detail' ? 'detail' : 'map';
  state.activePanel = nextPanel;

  const isList = nextPanel === 'list';
  const isDetail = nextPanel === 'detail';

  if (els.listPanel) {
    els.listPanel.classList.toggle('active', isList);
  }

  if (els.listBackdrop) {
    els.listBackdrop.classList.toggle('active', isList);
  }

  if (els.toggleListBtn) {
    els.toggleListBtn.querySelector('.map-fab-label').textContent = isList ? 'Till karta' : 'Platslista';
  }

  if (!isList && state.map.pendingRender) {
    state.map.pendingRender = false;
    queueMapRender();
  }
}

function handleAssignmentPrimaryAction() {
  // Om alla platser är besökta — gå till avslutningsvyn
  const places = getPlaces();
  const visitedCount = places.filter((place) => hasVisitedPlace(place.id)).length;
  if (places.length > 0 && visitedCount >= places.length) {
    handleLeaveAssignment();
    return;
  }

  const action = getAssignmentBottomActionState();
  if (!action || !action.place) {
    return;
  }

  setActivePanel('detail');
  openPlace(action.place.id);
}

function updateAssignmentSummary() {
  const places = getPlaces();
  const visitedCount = places.filter((place) => hasVisitedPlace(place.id)).length;
  const unlockedCount = places.filter((place) => getPlaceAvailability(place).unlocked).length;
  const mysteryMode = isMysteryAssignment();
  const trailMode = isTrailAssignment();
  const action = getAssignmentBottomActionState();

  // Visa meddelande första gången alla platser är besökta
  const allVisited = places.length > 0 && visitedCount >= places.length;
  if (allVisited && !state._allVisitedNotified && state.sessionToken) {
    state._allVisitedNotified = true;
    const msg = mysteryMode
      ? 'Alla steg klara! Tryck på "Avsluta uppdrag" när du är klar.'
      : trailMode
        ? 'Alla platser besökta! Tryck på "Avsluta uppdrag" för att se ditt resultat.'
        : 'Du har besökt alla platser! Tryck på "Avsluta uppdrag" när du är klar.';
    showStatus(msg);
  }

  if (els.assignmentTypeBadge) {
    els.assignmentTypeBadge.textContent = humanizeType(state.assignment?.type).toLowerCase();
    els.assignmentTypeBadge.classList.toggle('hidden', true);
  }

  if (els.assignmentPrimaryAction) {
    els.assignmentPrimaryAction.classList.toggle('hidden', false);
    if (allVisited) {
      els.assignmentPrimaryAction.textContent = 'Avsluta uppdraget →';
      els.assignmentPrimaryAction.disabled = false;
    } else if (action) {
      els.assignmentPrimaryAction.textContent = action.label;
      els.assignmentPrimaryAction.disabled = !!action.disabled;
    } else {
      els.assignmentPrimaryAction.textContent = mysteryMode ? 'Nästa steg' : 'Öppna plats';
      els.assignmentPrimaryAction.disabled = true;
    }
  }

  if (els.assignmentMysteryHint) {
    els.assignmentMysteryHint.classList.remove('hidden');
    if (action?.hint) {
      els.assignmentMysteryHint.textContent = action.hint;
    } else if (mysteryMode) {
      els.assignmentMysteryHint.textContent = 'Fortsätt med nästa steg i gåtan.';
    } else if (trailMode) {
      els.assignmentMysteryHint.textContent = 'Fortsätt till nästa plats i tipspromenaden.';
    } else {
      els.assignmentMysteryHint.textContent = 'Öppna en plats för att börja utforska.';
    }
  }

  if (els.assignmentPlaceCount) {
    if (mysteryMode) {
      els.assignmentPlaceCount.textContent = `${places.length} steg`;
    } else {
      els.assignmentPlaceCount.textContent = `${places.length} platser`;
    }
  }

  if (els.assignmentVisitedCount) {
    const remaining = Math.max(places.length - visitedCount, 0);
    if (mysteryMode) {
      els.assignmentVisitedCount.textContent = `${visitedCount} klara • ${remaining} kvar`;
    } else if (trailMode) {
      els.assignmentVisitedCount.textContent = `${visitedCount} besökta • ${remaining} kvar`;
    } else {
      // Exploration: visa besökta och kvar, inte totalt (samma som platser)
      if (visitedCount === 0) {
        els.assignmentVisitedCount.textContent = 'Inga besökta ännu';
      } else {
        els.assignmentVisitedCount.textContent = `${visitedCount} besökta • ${remaining} kvar`;
      }
    }
  }

  if (els.listSheetTitle) {
    els.listSheetTitle.textContent = state.assignment?.title || 'Platslista';
  }

  if (els.listSheetSubtitle) {
    if (mysteryMode) {
      const nextPlace = getNextMysteryPlace();
      const nextText = nextPlace ? ` • Nästa: ${nextPlace.title || nextPlace.name || 'plats'}` : ' • Alla steg klara';
      els.listSheetSubtitle.textContent = `${visitedCount}/${places.length} klara${nextText}`;
    } else if (trailMode) {
      const nextPlace = places.find((place) => !hasVisitedPlace(place.id));
      const nextText = nextPlace ? ` • Nästa: ${nextPlace.title || nextPlace.name || 'plats'}` : ' • Alla platser klara';
      els.listSheetSubtitle.textContent = `${visitedCount}/${places.length} besökta${nextText}`;
    } else {
      const targetPlace = action?.place;
      const extra = targetPlace ? ` • Närmast: ${targetPlace.title || targetPlace.name || 'plats'}` : '';
      els.listSheetSubtitle.textContent = `${places.length} platser i uppdraget${extra}`;
    }
  }
}


function renderPlaces() {
  const places = getPlaces();
  els.activeAssignmentTitle.textContent = state.assignment?.title || 'Uppdrag';
  els.placesList.innerHTML = '';

  if (!places.length) {
    els.placesList.innerHTML = '<div class="empty-state"><p class="muted">Det finns inga platser att visa i uppdraget ännu.</p></div>';
    return;
  }

  for (const place of places) {
    const fragment = els.placeTemplate.content.cloneNode(true);
    const row = fragment.querySelector('.place-row');
    const dotEl = fragment.querySelector('.place-row-dot');
    const titleEl = fragment.querySelector('.place-row-title');
    const subtitleEl = fragment.querySelector('.place-row-subtitle');
    const metaEl = fragment.querySelector('.place-row-meta');
    const statusEl = fragment.querySelector('.place-row-status');

    const availability = getPlaceAvailability(place);
    const unlocked = availability.unlocked;
    const visited = availability.visited;
    const distance = availability.distance;
    const mysteryStage = isMysteryAssignment() ? getMysteryPlaceStage(place) : null;

    row.dataset.placeId = String(place.id);
    row.classList.toggle('is-unlocked', unlocked);
    row.classList.toggle('is-locked', !unlocked);
    row.classList.toggle('is-visited', visited);
    row.classList.toggle('is-next', mysteryStage === 'next');
    row.classList.toggle('is-complete', mysteryStage === 'complete');

    titleEl.textContent = place.title || place.name || 'Plats';

    if (isMysteryAssignment()) {
      subtitleEl.textContent =
        mysteryStage === 'complete' ? 'Klar' :
        mysteryStage === 'next' ? 'Nästa steg' :
        mysteryStage === 'unlocked' ? 'Upplåst' :
        'Låst';
      metaEl.textContent = buildMysteryPlaceMeta(place, availability);

      statusEl.textContent =
        mysteryStage === 'complete' ? 'Klar' :
        mysteryStage === 'next' ? 'Nästa' :
        mysteryStage === 'unlocked' ? 'Upplåst' :
        'Låst';
    } else {
      subtitleEl.textContent = buildPlaceSubtitle(place);
      metaEl.textContent = buildPlaceMetaText(place);

      if (visited) {
        statusEl.textContent = 'Besökt';
      } else if (availability.sequenceBlocked) {
        statusEl.textContent = 'Ordning';
      } else if (availability.pendingPosition) {
        statusEl.textContent = 'Väntar';
      } else if (unlocked) {
        statusEl.textContent = distance != null ? formatDistance(distance) : 'Öppna';
      } else {
        statusEl.textContent = 'Låst';
      }
    }

    row.addEventListener('click', () => openPlace(place.id));

    els.placesList.appendChild(fragment);
  }
}

function buildPlaceSubtitle(place) {
  return place.subtitle || place.category_name || place.category || getPlaceDescription(place);
}

function buildPlaceMetaText(place) {
  const availability = getPlaceAvailability(place);

  if (availability.sequenceBlocked) {
    const previousTitle = availability.previousPlace?.title || availability.previousPlace?.name || 'föregående plats';
    return `Låst tills ${previousTitle} är besökt`;
  }

  if (availability.pendingPosition) {
    return 'Väntar på position';
  }

  if (availability.requiresLocation && availability.distance != null) {
    if (availability.unlocked) {
      return `${formatDistance(availability.distance)} bort`;
    }
    return `${formatDistance(availability.distance)} • Låst tills du är inom ${formatDistance(availability.unlockDistance)}`;
  }

  if (hasCoordinates(place)) {
    return 'Väntar på position';
  }

  return availability.unlockMode === 'linear' ? 'Linjär ordning' : 'Fri ordning';
}

async function openPlace(placeId) {
  const place = getPlaceById(placeId);

  if (!place) {
    showStatus('Platsen kunde inte öppnas.', true);
    return;
  }

  const availability = getPlaceAvailability(place);

  if (availability.sequenceBlocked) {
    const previousTitle = availability.previousPlace?.title || availability.previousPlace?.name || 'föregående plats';
    const message = `Platsens första block visas nu. Övrigt innehåll låses upp när ${previousTitle} har besökts.`;
    showStatus(message);
    updateMapStatus(message, getNearestPlace());
  } else if (availability.pendingPosition) {
    const message = state.positionDenied
      ? 'Platsens första block visas, men övrigt innehåll låses upp först när du tillåter platsåtkomst i Safari.'
      : 'Platsens första block visas nu. Övrigt innehåll låses upp när din position har verifierats.';
    showStatus(message);
    updateMapStatus(message, getNearestPlace());
  } else if (!availability.unlocked) {
    const message = availability.distance != null
      ? `Platsens första block visas nu. Övrigt innehåll låses upp när du är inom ${formatDistance(availability.unlockDistance)}. Just nu är du ${formatDistance(availability.distance)} bort.`
      : 'Platsens första block visas nu. Övrigt innehåll låses upp när din position kan verifieras.';
    showStatus(message);
    updateMapStatus(message, getNearestPlace());
  } else if (!availability.visited) {
    const autoVisited = await handleRegisterVisit(placeId, null, { silent: true });
    if (!autoVisited) {
      console.warn('Auto registrering av besök misslyckades för plats', placeId);
    }
  }

  state.activePlaceId = placeId;
  renderPlaceDetail(getPlaceById(placeId) || place);
  setActivePanel('detail');
  showView('placeDetail');
}

function renderPlaceDetail(place) {
  const blocks = getContentBlocks(place);
  const availability = getPlaceAvailability(place);
  const visibleBlocks = getVisibleBlocksForPlace(place, availability);
  const hiddenBlockCount = Math.max(0, blocks.length - visibleBlocks.length);
  const heroBlock = getHeroMediaBlock(visibleBlocks);

  // Anpassa detaljvyn för digitalt läge
  if (els.backToListBtn) {
    // I digitalt läge byter vi texten till "← Steg" istället för "Platslista"
    els.backToListBtn.textContent = isDigitalAssignment() ? '← Steg' : 'Platslista';
  }

  // Platsnamn
  els.detailPlaceTitle.textContent = place.title || place.name || 'Plats';
  els.detailPlaceDescription.textContent = getPlaceDescription(place);
  els.detailContentList.innerHTML = '';
  els.detailHeroMedia.innerHTML = '';

  // Ordningsetikett + kategori som en rad
  const categoryName = place.category_name || place.category || null;
  const orderLabel = getPlaceOrderLabel(place);
  els.detailPlaceOrder.textContent = categoryName
    ? `${orderLabel}  ·  ${categoryName}`
    : orderLabel;

  if (els.detailCtaRow) {
    els.detailCtaRow.hidden = true;
    els.detailCtaRow.style.display = 'none';
  }

  updateDetailVisitButton(place.id);

  if (heroBlock) {
    const mediaNode = createMediaNode(heroBlock, false);
    if (mediaNode) {
      els.detailHeroMedia.classList.remove('hidden');
      els.detailHeroMedia.appendChild(mediaNode);
    } else {
      els.detailHeroMedia.classList.add('hidden');
    }
  } else {
    els.detailHeroMedia.classList.add('hidden');
  }

  // Badge-rad: distans om låst, grön bricka om upplåst eller besökt
  // Unlock-statustext tas bort — den informationen finns i 🔒-kortet nedan
  const badgeRow = document.createElement('div');
  badgeRow.className = 'badge-row';

  const distance = availability.distance;
  if (distance != null && !availability.unlocked) {
    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = `${formatDistance(distance)} bort`;
    badgeRow.appendChild(badge);
  }

  if (availability.visited) {
    const badge = document.createElement('div');
    badge.className = 'badge badge-visited';
    badge.textContent = '✓ Besökt';
    badgeRow.appendChild(badge);
  } else if (availability.unlocked) {
    const badge = document.createElement('div');
    badge.className = 'badge badge-unlocked';
    badge.textContent = '✓ Upplåst';
    badgeRow.appendChild(badge);
  }

  if (badgeRow.childNodes.length) {
    els.detailContentList.appendChild(badgeRow);
  }

  if (hiddenBlockCount > 0) {
    els.detailContentList.appendChild(createLockedBlocksNotice(hiddenBlockCount, availability));
  }

  for (const block of visibleBlocks) {
    if (heroBlock && block === heroBlock) {
      continue;
    }
    els.detailContentList.appendChild(createContentBlockElement(block, place, availability));
  }

  if (!visibleBlocks.length && !els.detailContentList.childNodes.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<p class="muted">Det finns inget innehåll på den här platsen ännu.</p>';
    els.detailContentList.appendChild(empty);
  }
}

function getVisibleBlocksForPlace(place, availability) {
  const blocks = getContentBlocks(place);

  if (!blocks.length) {
    return [];
  }

  if (availability?.visited || availability?.unlocked) {
    return blocks;
  }

  return [blocks[0]];
}

function createLockedBlocksNotice(hiddenBlockCount, availability) {
  const article = document.createElement('article');
  article.className = 'content-block content-block-locked';

  const title = document.createElement('h3');
  title.className = 'locked-notice-title';
  title.textContent = '🔒 Mer innehåll låses upp på plats';
  article.appendChild(title);

  const text = document.createElement('div');
  text.className = 'text-content locked-notice-text';

  if (availability?.sequenceBlocked) {
    const previousTitle = availability.previousPlace?.title || availability.previousPlace?.name || 'föregående plats';
    text.textContent = hiddenBlockCount === 1
      ? `Låses upp när ${previousTitle} har besökts.`
      : `${hiddenBlockCount} block låses upp när ${previousTitle} har besökts.`;
  } else if (availability?.pendingPosition) {
    text.textContent = hiddenBlockCount === 1
      ? 'Väntar på att din position ska verifieras.'
      : `${hiddenBlockCount} block väntar på positionsverifiering.`;
  } else if (availability?.distance != null) {
    text.textContent = hiddenBlockCount === 1
      ? `Låses upp när du är inom ${formatDistance(availability.unlockDistance)}. Du är ${formatDistance(availability.distance)} bort.`
      : `${hiddenBlockCount} block låses upp inom ${formatDistance(availability.unlockDistance)}. Du är ${formatDistance(availability.distance)} bort.`;
  } else {
    text.textContent = hiddenBlockCount === 1
      ? 'Låses upp när du är på plats.'
      : `${hiddenBlockCount} block låses upp när du är på plats.`;
  }

  article.appendChild(text);
  return article;
}



function updateDetailVisitButton(placeId) {
  const place = getPlaceById(placeId);
  const availability = place ? getPlaceAvailability(place) : null;

  if (!els.detailRegisterVisitBtn) {
    return;
  }

  if (els.detailCtaRow) {
    els.detailCtaRow.hidden = true;
    els.detailCtaRow.style.display = 'none';
  }

  if (hasVisitedPlace(placeId)) {
    els.detailRegisterVisitBtn.textContent = 'Besök registrerat';
    els.detailRegisterVisitBtn.disabled = true;
    return;
  }

  if (availability?.sequenceBlocked) {
    els.detailRegisterVisitBtn.textContent = 'Fel ordning';
    els.detailRegisterVisitBtn.disabled = true;
    return;
  }

  if (availability?.pendingPosition) {
    els.detailRegisterVisitBtn.textContent = 'Väntar på position';
    els.detailRegisterVisitBtn.disabled = true;
    return;
  }

  if (availability && !availability.unlocked) {
    els.detailRegisterVisitBtn.textContent = 'För långt bort';
    els.detailRegisterVisitBtn.disabled = true;
    return;
  }

  /*
    Besöket ska normalt registreras automatiskt när en upplåst plats öppnas.
    Knappen hålls dold och finns bara kvar som teknisk fallback.
  */
  els.detailRegisterVisitBtn.textContent = 'Registrera besök';
  els.detailRegisterVisitBtn.disabled = false;

  if (els.detailCtaRow) {
    els.detailCtaRow.hidden = false;
    els.detailCtaRow.style.display = '';
  }
}

async function handleRegisterVisitFromDetail() {
  if (!state.activePlaceId) {
    showStatus('Ingen plats är vald.', true);
    return;
  }

  await handleRegisterVisit(state.activePlaceId, els.detailRegisterVisitBtn);
}

function renderFirstMediaPreview(place, container) {
  const blocks = getContentBlocks(place);
  const mediaBlock = blocks.find((block) => isMediaBlock(block));

  if (!mediaBlock) {
    return;
  }

  const mediaNode = createMediaNode(mediaBlock, true);

  if (!mediaNode) {
    return;
  }

  container.classList.remove('hidden');
  container.appendChild(mediaNode);
}

async function handleRegisterVisit(placeId, button, options = {}) {
  const silent = !!options.silent;

  if (!state.sessionToken) {
    if (!silent) {
      showStatus('Ingen aktiv session finns.', true);
    }
    return false;
  }

  if (hasVisitedPlace(placeId)) {
    return true;
  }

  const place = getPlaceById(placeId);
  const availability = place ? getPlaceAvailability(place) : null;

  if (availability?.sequenceBlocked) {
    if (!silent) {
      const previousTitle = availability.previousPlace?.title || availability.previousPlace?.name || 'föregående plats';
      showStatus(`Platsen kan inte registreras ännu eftersom ${previousTitle} inte är besökt än.`, true);
    }
    return false;
  }

  if (availability?.pendingPosition) {
    if (!silent) {
      showStatus('Väntar på position innan platsen kan registreras som besökt.', true);
    }
    return false;
  }

  if (availability && !availability.unlocked) {
    if (!silent) {
      showStatus('Platsen kan inte registreras ännu eftersom du inte är nära nog.', true);
    }
    return false;
  }

  const targetButton = button || els.detailRegisterVisitBtn;
  const originalText = targetButton ? targetButton.textContent : '';

  if (targetButton && !silent) {
    targetButton.disabled = true;
    targetButton.textContent = 'Sparar...';
  }

  try {
    if (state.isPreviewMode) {
      state.progressByPlaceId[placeId] = { ...(state.progressByPlaceId[placeId] || {}), visited: true, place_id: placeId };
    } else {
      await fetchJson(`${apiBaseUrl}/sessions/${encodeURIComponent(state.sessionToken)}/progress`, {
        method: 'POST',
        body: JSON.stringify({ place_id: placeId, placeId: placeId, latitude: place?.latitude ?? null, longitude: place?.longitude ?? null })
      });
      state.progressByPlaceId[placeId] = { ...(state.progressByPlaceId[placeId] || {}), visited: true, place_id: placeId };
    }

    renderPlaces();
    updateAssignmentSummary();
    updateMapStatus();
    queueMapRender();

    if (state.activePlaceId === placeId) {
      updateDetailVisitButton(placeId);
      if (els.detailCtaRow) {
        els.detailCtaRow.hidden = true;
      }
    }

    if (targetButton) {
      targetButton.textContent = 'Besök registrerat';
      targetButton.disabled = true;
    }

    if (!silent) {
      showStatus('Besöket registrerades.');
    }

    checkAndShowAutoComplete();
    return true;
  } catch (error) {
    console.error(error);

    if (targetButton && !silent) {
      targetButton.disabled = false;
      targetButton.textContent = originalText;
    }

    if (!silent) {
      showStatus(error.message || 'Kunde inte registrera besök.', true);
    }

    return false;
  }
}

async function handleLeaveAssignment() {
  const places = getPlaces();
  const visitedCount = places.filter((p) => hasVisitedPlace(p.id)).length;
  const allDone = places.length > 0 && visitedCount >= places.length;

  // Om alla platser är klara — gå direkt till completion utan bekräftelse
  if (allDone) {
    await loadProgress(true);
    renderCompletionSummary();
    setActivePanel('map');
    showView('completion');
    return;
  }

  // Annars — visa bekräftelsedialog
  showLeaveConfirmDialog(async () => {
    await loadProgress(true);
    renderCompletionSummary();
    setActivePanel('map');
    showView('completion');
  });
}

function showLeaveConfirmDialog(onConfirm) {
  const modal     = document.getElementById('leaveConfirmModal');
  const okBtn     = document.getElementById('leaveConfirmOkBtn');
  const cancelBtn = document.getElementById('leaveConfirmCancelBtn');
  const textEl    = document.getElementById('leaveConfirmText');

  if (!modal) {
    // Fallback om modal saknas
    if (confirm('Vill du avsluta uppdraget? Dina framsteg sparas.')) onConfirm();
    return;
  }

  // Anpassa text beroende på uppdragstyp
  const places = getPlaces();
  const visitedCount = places.filter((p) => hasVisitedPlace(p.id)).length;
  const remaining = places.length - visitedCount;

  if (textEl) {
    if (remaining > 0) {
      textEl.textContent = `Du har ${remaining} plats${remaining === 1 ? '' : 'er'} kvar att besöka. Dina framsteg sparas men uppdraget markeras som avslutat.`;
    } else {
      textEl.textContent = 'Dina framsteg sparas och uppdraget markeras som avslutat.';
    }
  }

  modal.showModal();

  // Rensa gamla lyssnare och sätt nya
  const newOk     = okBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOk, okBtn);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

  newOk.addEventListener('click', () => {
    modal.close();
    onConfirm();
  });
  newCancel.addEventListener('click', () => modal.close());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); }, { once: true });
}

function closeCompletionView() {
  showView('map');
}

async function handleConfirmCompleteAssignment() {
  if (!state.sessionToken) {
    resetLocalSession();
    showView('code');
    showStatus('Den lokala sessionen har nollställts.');
    return;
  }

  els.completionConfirmBtn.disabled = true;
  const originalText = els.completionConfirmBtn.textContent;
  els.completionConfirmBtn.textContent = 'Avslutar...';

  try {
    await fetchJson(`${apiBaseUrl}/sessions/${encodeURIComponent(state.sessionToken)}/complete`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  } catch (error) {
    console.warn('Kunde inte avsluta sessionen mot backend.', error);
  } finally {
    els.completionConfirmBtn.disabled = false;
    els.completionConfirmBtn.textContent = originalText;
  }

  // Sätt single_attempt-märke om uppdraget kräver det
  markAssignmentAttempted();

  resetLocalSession();
  showView('code');
  showStatus('Uppdraget avslutades och den lokala sessionen nollställdes.');
}

function collectCompletionSummary() {
  const places = getPlaces();
  const visitedCount = places.filter((place) => hasVisitedPlace(place.id)).length;
  const answers = Object.values(state.progressByBlockId || {}).filter((row) => hasProgressAnswer(row));
  const answerCount = answers.length;
  const correctCount = answers.filter((row) => normalizeCorrectness(row?.is_correct) === 1).length;
  const totalScore = answers.reduce((sum, row) => sum + (Number(row?.points_earned) || 0), 0);

  const recentItems = places
    .map((place) => {
      const availability = getPlaceAvailability(place);
      const placeRows = Object.values(state.progressByBlockId || {}).filter((row) => String(row.place_id || row.placeId) === String(place.id));
      const answeredHere = placeRows.filter((row) => hasProgressAnswer(row)).length;
      return {
        id: place.id,
        title: place.title || place.name || 'Plats',
        visited: hasVisitedPlace(place.id),
        answeredHere,
        unlocked: availability.unlocked,
        pendingPosition: availability.pendingPosition
      };
    })
    .filter((item) => item.visited || item.answeredHere > 0)
    .slice(0, 6);

  return {
    placeCount: places.length,
    visitedCount,
    answerCount,
    correctCount,
    totalScore,
    recentItems
  };
}

function renderCompletionSummary() {
  const summary = collectCompletionSummary();
  const gradingMode = getGradingMode();
  const immediate = shouldShowImmediateFeedback();

  els.completionPlacesStat.textContent = `${summary.visitedCount} / ${summary.placeCount}`;
  els.completionAnswersStat.textContent = String(summary.answerCount);
  els.completionCorrectStat.textContent = immediate ? String(summary.correctCount) : '—';
  els.completionScoreStat.textContent = immediate ? String(summary.totalScore) : '—';

  if (immediate) {
    els.completionLead.textContent = 'Här ser du din sammanfattning innan du avslutar uppdraget.';
    els.completionModeNotice.classList.remove('is-collected');
    els.completionModeNotice.textContent = summary.answerCount
      ? 'Du har fått direkt återkoppling på de svar som rättas automatiskt.'
      : 'Du har ännu inte skickat in några svar.';
  } else {
    els.completionLead.textContent = 'Dina svar är sparade och kommer att återkopplas av arrangören.';
    els.completionModeNotice.classList.add('is-collected');
    els.completionModeNotice.textContent = summary.answerCount
      ? 'Det här uppdraget använder insamlad rättning. Rätt eller fel och poäng visas därför inte här direkt.'
      : 'Det här uppdraget använder insamlad rättning. När du skickat svar kommer arrangören att återkoppla resultatet senare.';
  }

  els.completionRecentList.innerHTML = '';

  if (!summary.recentItems.length) {
    const empty = document.createElement('div');
    empty.className = 'completion-recent-item';
    empty.innerHTML = '<div class="completion-recent-title">Inga registrerade aktiviteter ännu</div><div class="completion-recent-meta">Du kan fortsätta uppdraget eller avsluta det härifrån.</div>';
    els.completionRecentList.appendChild(empty);
    return;
  }

  for (const item of summary.recentItems) {
    const card = document.createElement('article');
    card.className = 'completion-recent-item';

    const title = document.createElement('div');
    title.className = 'completion-recent-title';
    title.textContent = item.title;

    const meta = document.createElement('div');
    meta.className = 'completion-recent-meta';

    const parts = [];
    parts.push(item.visited ? 'Besökt' : 'Ej besökt');
    if (item.answeredHere > 0) {
      parts.push(`${item.answeredHere} svar`);
    }
    meta.textContent = parts.join(' • ');

    card.appendChild(title);
    card.appendChild(meta);
    els.completionRecentList.appendChild(card);
  }
}

// ─── Auto-bekräftelse ─────────────────────────────────────────
//
// Triggas automatiskt efter varje besöksregistrering och efter
// varje inskickat svar. Visar ett fira-kort en enda gång per
// session när ALLA platser är besökta OCH alla frågeblock
// besvarade (platser utan frågor räknas som klara direkt).
//
// Tre val för användaren:
//   1. Visa sammanfattning  — expanderar statistik inline
//   2. Avsluta till startsidan — kör handleConfirmCompleteAssignment
//   3. Stäng och fortsätt utforska — stänger kortet, session lever vidare
// ──────────────────────────────────────────────────────────────

function checkAndShowAutoComplete() {
  // Visa aldrig mer än en gång per session
  if (state.autoCompleteShown) {
    return;
  }

  // Kräver aktiv session och laddat uppdrag
  if (!state.sessionToken || !state.assignment) {
    return;
  }

  const places = getPlaces();
  if (!places.length) {
    return;
  }

  // Alla platser måste vara besökta
  const allPlacesVisited = places.every((place) => hasVisitedPlace(place.id));
  if (!allPlacesVisited) {
    return;
  }

  // Alla fråge- och lösningsblock måste vara besvarade
  // (platser utan sådana block räknas automatiskt som klara)
  const allQuestionBlocks = places.flatMap((place) =>
    getContentBlocks(place).filter(
      (block) => block.type === 'question' || block.type === 'solution'
    )
  );

  const allQuestionsAnswered =
    allQuestionBlocks.length === 0 ||
    allQuestionBlocks.every((block) =>
      hasProgressAnswer(getProgressForBlock(block.id))
    );

  if (!allQuestionsAnswered) {
    return;
  }

  // Allt klart — markera och visa
  state.autoCompleteShown = true;
  showAutoCompleteView();
}

function showAutoCompleteView() {
  if (!els.autoCompleteView) {
    return;
  }

  // Fyll sammanfattningen innan animationen startar
  renderAutoCompleteSummary();

  // Anpassa rubrik och ingress efter uppdragstyp
  const places = getPlaces();
  const isMystery = isMysteryAssignment();
  const hasQuestions = places.some((place) =>
    getContentBlocks(place).some(
      (block) => block.type === 'question' || block.type === 'solution'
    )
  );

  if (isMystery) {
    if (els.autoCompleteTitle) els.autoCompleteTitle.textContent = 'Gåtan löst!';
    if (els.autoCompleteLead)  els.autoCompleteLead.textContent  = 'Du har klarat alla steg i gåtan. Bra jobbat!';
    if (els.autoCompleteView)  els.autoCompleteView.querySelector('.autocomplete-emoji').textContent = '🔍';
  } else if (hasQuestions) {
    if (els.autoCompleteTitle) els.autoCompleteTitle.textContent = 'Uppdraget klart!';
    if (els.autoCompleteLead)  els.autoCompleteLead.textContent  = 'Du har besökt alla platser och svarat på alla frågor.';
  } else {
    if (els.autoCompleteTitle) els.autoCompleteTitle.textContent = 'Alla platser klara!';
    if (els.autoCompleteLead)  els.autoCompleteLead.textContent  = 'Du har besökt samtliga platser i uppdraget.';
  }

  // Återställ sammanfattning till dolt läge varje gång
  if (els.autoCompleteSummaryWrap) {
    els.autoCompleteSummaryWrap.classList.add('hidden');
  }
  if (els.autoCompleteSummaryToggleBtn) {
    els.autoCompleteSummaryToggleBtn.textContent = 'Visa sammanfattning';
  }

  // Aktivera overlay — CSS-animationen tar vid
  els.autoCompleteView.classList.add('active');
  document.body.dataset.autoComplete = 'open';
}

function closeAutoCompleteView() {
  if (!els.autoCompleteView) {
    return;
  }
  els.autoCompleteView.classList.remove('active');
  delete document.body.dataset.autoComplete;
}

function toggleAutoCompleteSummary() {
  if (!els.autoCompleteSummaryWrap) {
    return;
  }
  const nowHidden = els.autoCompleteSummaryWrap.classList.toggle('hidden');
  if (els.autoCompleteSummaryToggleBtn) {
    els.autoCompleteSummaryToggleBtn.textContent = nowHidden
      ? 'Visa sammanfattning'
      : 'Dölj sammanfattning';
  }
}

async function handleAutoCompleteFinish() {
  // Stäng overlaynen visuellt först, sedan kör avslutslogiken
  closeAutoCompleteView();
  await handleConfirmCompleteAssignment();
}

function renderAutoCompleteSummary() {
  if (!els.autoCompletePlacesStat) {
    return;
  }

  const summary = collectCompletionSummary();
  const immediate = shouldShowImmediateFeedback();

  els.autoCompletePlacesStat.textContent  = `${summary.visitedCount} / ${summary.placeCount}`;
  els.autoCompleteAnswersStat.textContent = String(summary.answerCount);
  els.autoCompleteCorrectStat.textContent = immediate ? String(summary.correctCount) : '—';
  els.autoCompleteScoreStat.textContent   = immediate ? String(summary.totalScore)   : '—';

  if (els.autoCompleteModeNotice) {
    if (immediate) {
      els.autoCompleteModeNotice.classList.remove('is-collected');
      els.autoCompleteModeNotice.textContent = summary.answerCount
        ? 'Du fick direkt återkoppling på de svar som rättas automatiskt.'
        : '';
    } else {
      els.autoCompleteModeNotice.classList.add('is-collected');
      els.autoCompleteModeNotice.textContent = summary.answerCount
        ? 'Det här uppdraget använder insamlad rättning — rätt/fel och poäng visas av arrangören.'
        : '';
    }
  }

  if (els.autoCompleteRecentList) {
    els.autoCompleteRecentList.innerHTML = '';

    if (!summary.recentItems.length) {
      const empty = document.createElement('article');
      empty.className = 'completion-recent-item';
      empty.innerHTML =
        '<div class="completion-recent-title">Inga registrerade aktiviteter</div>' +
        '<div class="completion-recent-meta">Sessionen innehåller inga sparade besök.</div>';
      els.autoCompleteRecentList.appendChild(empty);
      return;
    }

    for (const item of summary.recentItems) {
      const card = document.createElement('article');
      card.className = 'completion-recent-item';

      const title = document.createElement('div');
      title.className = 'completion-recent-title';
      title.textContent = item.title;

      const meta = document.createElement('div');
      meta.className = 'completion-recent-meta';
      const parts = [item.visited ? '✓ Besökt' : 'Ej besökt'];
      if (item.answeredHere > 0) {
        parts.push(`${item.answeredHere} svar`);
      }
      meta.textContent = parts.join(' • ');

      card.appendChild(title);
      card.appendChild(meta);
      els.autoCompleteRecentList.appendChild(card);
    }
  }
}

function openStartGuide() {
  if (!els.startGuideCard) {
    return;
  }

  els.startGuideCard.classList.remove('hidden');
}

function closeStartGuide() {
  if (!els.startGuideCard) {
    return;
  }

  els.startGuideCard.classList.add('hidden');
}

// ─── Välkomst-onboarding ──────────────────────────────────────
function initWelcomeModal() {
  const modal    = document.getElementById('welcomeModal');
  const closeBtn = document.getElementById('welcomeModalCloseBtn');
  const skipBtn  = document.getElementById('welcomeModalSkipBtn');

  if (!modal) return;

  // Koppla "Så fungerar det"-knappen till modalen
  if (els.openStartGuideBtn) {
    els.openStartGuideBtn.removeEventListener('click', openStartGuide);
    els.openStartGuideBtn.addEventListener('click', () => modal.showModal());
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.close();
      localStorage.setItem(WELCOME_SEEN_KEY, '1');
    });
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      modal.close();
      localStorage.setItem(WELCOME_SEEN_KEY, '1');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.close();
      localStorage.setItem(WELCOME_SEEN_KEY, '1');
    }
  });

  // Visa automatiskt vid första besök
  if (!localStorage.getItem(WELCOME_SEEN_KEY)) {
    // Liten fördröjning så appen hinner laddas klart
    setTimeout(() => modal.showModal(), 600);
  }
}

function handleResetSession() {
  // Rensa ett-försök-märket om det finns ett aktivt uppdrag
  if (state.assignmentCode) {
    clearAssignmentAttempt(state.assignmentCode);
  }
  resetLocalSession();
  showStatus('Den lokala sessionen har nollställts.');
}

function resetLocalSession() {
  stopGeolocationWatch();
  stopCountdownTimer();

  // Rensa personlig starttid för tidsgräns
  if (state.sessionToken) {
    localStorage.removeItem(`spoton.start.${state.sessionToken}`);
  }
  state._endTimeWarningShown = false;
  state._allVisitedNotified = false;

  closeNotesPanel({ silent: true });
  closeAutoCompleteView();
  state.assignment = null;
  state.assignmentCode = '';
  state.sessionToken = null;
  state.progressByPlaceId = {};
  state.progressByBlockId = {};
  state.pendingBlockIds.clear();
  state.activePlaceId = null;
  state.userPosition = null;
  state.notesText = '';
  state.notesDirty = false;
  state.notesSaving = false;
  state.openClueIds.clear();
  state.viewedClueIds.clear();
  state.mapIntroDismissed = false;
  state.autoCompleteShown = false;
  if (state.notesSaveTimer) {
    clearTimeout(state.notesSaveTimer);
    state.notesSaveTimer = null;
  }
  state.activePanel = 'map';
  state.positionResolved = false;
  state.positionDenied = false;
  state.map.centerLat = null;
  state.map.centerLng = null;
  state.map.zoom = mapConfig.defaultZoom;
  state.map.mode = 'fitAll';
  state.map.hasFitAfterPosition = false;
  state.map.tileEls.forEach((tile) => tile.remove());
  state.map.tileEls.clear();
  if (state.map.overlayEl) {
    state.map.overlayEl.replaceChildren();
  }
  localStorage.removeItem(storageKeys.activeSession);
  localStorage.removeItem(storageKeys.assignment);

  const notesKey = getNotesStorageKey();
  if (notesKey) {
    localStorage.removeItem(notesKey);
  }

  const viewedCluesKey = getViewedCluesStorageKey();
  if (viewedCluesKey) {
    localStorage.removeItem(viewedCluesKey);
  }
}

function persistAssignment(assignment, accessCode) {
  const persistedAssignment = {
    ...assignment,
    access_code: accessCode || assignment.access_code || assignment.accessCode || ''
  };

  localStorage.setItem(storageKeys.assignment, JSON.stringify(persistedAssignment));
}

function persistSession(sessionToken, nickname) {
  localStorage.setItem(storageKeys.activeSession, JSON.stringify({
    sessionToken,
    nickname
  }));
}

function showView(name) {
  els.codeView.classList.remove('active');
  els.introView.classList.remove('active');
  els.mapView.classList.remove('active');
  els.placeDetailView.classList.remove('active');
  els.completionView.classList.remove('active');
  if (els.digitalView) els.digitalView.classList.remove('active');

  if (name === 'code') {
    document.body.dataset.mode = 'standard';
    els.screenTitle.textContent = 'Ange kod';
    els.codeView.classList.add('active');
  } else if (name === 'intro') {
    els.screenTitle.textContent = 'Uppdragsintro';
    els.introView.classList.add('active');
  } else if (name === 'digital') {
    document.body.dataset.mode = isMysteryAssignment() ? 'mystery' : 'standard';
    els.screenTitle.textContent = state.assignment?.title || 'Uppdrag';
    if (els.digitalView) els.digitalView.classList.add('active');
  } else if (name === 'map') {
    els.screenTitle.textContent = 'Karta';
    els.mapView.classList.add('active');
    updateMapIntroCard();
    queueMapRender();
  } else if (name === 'placeDetail') {
    if (els.mapIntroCard) {
      els.mapIntroCard.classList.add('hidden');
    }
    els.screenTitle.textContent = 'Plats';
    els.mapView.classList.add('active');
    els.placeDetailView.classList.add('active');
  } else if (name === 'completion') {
    els.screenTitle.textContent = 'Avsluta';
    els.mapView.classList.add('active');
    els.completionView.classList.add('active');
  }

  if (name === 'code' || name === 'intro' || name === 'completion') {
    closeNotesPanel({ silent: true });
    closeAutoCompleteView();
    if (els.mapIntroCard) {
      els.mapIntroCard.classList.add('hidden');
    }
  }

  document.body.dataset.view = name;
}

function showStatus(message, isError = false) {
  if (!message) {
    els.statusCard.classList.add('hidden');
    els.statusCard.textContent = '';
    els.statusCard.classList.remove('info');
    return;
  }

  els.statusCard.classList.remove('hidden');
  els.statusCard.classList.toggle('info', !isError);
  els.statusCard.style.background = isError ? 'rgba(220, 38, 38, .18)' : 'rgba(22, 163, 74, .18)';
  els.statusCard.style.borderColor = isError ? 'rgba(220, 38, 38, .35)' : 'rgba(34, 197, 94, .35)';
  els.statusCard.textContent = message;
}

function normalizeAssignment(assignment) {
  const places = Array.isArray(assignment?.places) ? assignment.places.map(normalizePlace) : [];

  return {
    ...assignment,
    places
  };
}

function normalizePlace(place) {
  const contentBlocks = getContentBlocks(place).map((block) => ({ ...block }));

  return {
    ...place,
    latitude: toNumberOrNull(place.latitude ?? place.lat),
    longitude: toNumberOrNull(place.longitude ?? place.lng ?? place.lon),
    content_blocks: contentBlocks
  };
}

function getPlaces() {
  const places = Array.isArray(state.assignment?.places) ? state.assignment.places : [];
  return [...places].sort(compareByOrder);
}


function isLinearMysteryMode() {
  return isMysteryAssignment() && getUnlockMode() === 'linear';
}

function isLinearMode() {
  return getUnlockMode() === 'linear' || isLinearMysteryMode();
}

function getPreviousPlaceInSequence(place) {
  if (!place) {
    return null;
  }

  const places = getPlaces();
  const currentIndex = places.findIndex((item) => String(item.id) === String(place.id));
  if (currentIndex <= 0) {
    return null;
  }

  return places[currentIndex - 1] || null;
}

function getNextMysteryPlace() {
  if (!isMysteryAssignment()) {
    return null;
  }

  const places = getPlaces();
  return places.find((place) => !hasVisitedPlace(place.id)) || null;
}

function getMysteryPlaceStage(place) {
  const availability = getPlaceAvailability(place);
  const nextPlace = getNextMysteryPlace();

  if (availability.visited) {
    return 'complete';
  }

  if (nextPlace && String(nextPlace.id) === String(place.id)) {
    return 'next';
  }

  if (availability.unlocked) {
    return 'unlocked';
  }

  return 'locked';
}

function buildMysteryPlaceMeta(place, availability) {
  const stage = getMysteryPlaceStage(place);

  if (stage == 'complete') {
    return 'Redan besökt';
  }

  if (stage == 'next') {
    if (availability.pendingPosition) {
      return 'Nästa steg • väntar på position';
    }

    if (availability.sequenceBlocked) {
      const previousTitle = availability.previousPlace?.title || availability.previousPlace?.name || 'föregående plats';
      return `Nästa steg • efter ${previousTitle}`;
    }

    if (availability.distance != null) {
      return `${formatDistance(availability.distance)} kvar`;
    }

    return 'Nästa steg i gåtan';
  }

  if (stage == 'unlocked') {
    return availability.distance != null ? `${formatDistance(availability.distance)} bort` : 'Upplåst';
  }

  if (availability.sequenceBlocked) {
    const previousTitle = availability.previousPlace?.title || availability.previousPlace?.name || 'föregående plats';
    return `Låst tills ${previousTitle} är klart`;
  }

  if (availability.pendingPosition) {
    return 'Väntar på position';
  }

  if (availability.distance != null) {
    return `${formatDistance(availability.distance)} bort • låst`;
  }

  return 'Låst';
}

function getMysteryBottomActionState() {
  const nextPlace = getNextMysteryPlace();

  if (!nextPlace) {
    return {
      place: null,
      label: 'Klart',
      disabled: true,
      hint: 'Alla steg i gåtan är klara.'
    };
  }

  const availability = getPlaceAvailability(nextPlace);
  const title = nextPlace.title || nextPlace.name || 'Nästa plats';

  if (availability.sequenceBlocked) {
    const previousTitle = availability.previousPlace?.title || availability.previousPlace?.name || 'föregående plats';
    return {
      place: nextPlace,
      label: 'Nästa steg',
      disabled: false,
      hint: `Nästa steg: ${title}. Besök först ${previousTitle}.`
    };
  }

  if (availability.unlocked) {
    return {
      place: nextPlace,
      label: 'Öppna nästa',
      disabled: false,
      hint: availability.distance != null
        ? `Nästa steg: ${title} • ${formatDistance(availability.distance)} kvar`
        : `Nästa steg: ${title}`
    };
  }

  if (availability.pendingPosition) {
    return {
      place: nextPlace,
      label: 'Nästa steg',
      disabled: false,
      hint: `Nästa steg: ${title}. Väntar på position.`
    };
  }

  return {
    place: nextPlace,
    label: availability.distance != null ? `${formatDistance(availability.distance)} kvar` : 'Nästa steg',
    disabled: false,
    hint: availability.distance != null
      ? `Nästa steg: ${title} • ${formatDistance(availability.distance)} kvar`
      : `Nästa steg: ${title}`
  };
}

function getTrailBottomActionState() {
  const places = getPlaces();
  const nextPlace = places.find((place) => !hasVisitedPlace(place.id)) || null;

  if (!nextPlace) {
    return {
      place: null,
      label: 'Klart',
      disabled: true,
      hint: 'Alla platser är klara.'
    };
  }

  const availability = getPlaceAvailability(nextPlace);
  const title = nextPlace.title || nextPlace.name || 'Nästa plats';

  if (availability.pendingPosition) {
    return {
      place: nextPlace,
      label: 'Öppna nästa',
      disabled: false,
      hint: `Nästa: ${title} • väntar på position`
    };
  }

  if (availability.unlocked) {
    return {
      place: nextPlace,
      label: 'Öppna nästa',
      disabled: false,
      hint: availability.distance != null
        ? `Nästa: ${title} • ${formatDistance(availability.distance)} kvar`
        : `Nästa: ${title}`
    };
  }

  if (availability.distance != null) {
    return {
      place: nextPlace,
      label: 'Öppna nästa',
      disabled: false,
      hint: `Nästa: ${title} • ${formatDistance(availability.distance)} kvar`
    };
  }

  return {
    place: nextPlace,
    label: 'Öppna nästa',
    disabled: false,
    hint: `Nästa: ${title}`
  };
}

function getExplorationBottomActionState() {
  const places = getPlaces();
  const nearest = getNearestPlace();
  const targetPlace = nearest?.place || places.find((place) => !hasVisitedPlace(place.id)) || places[0] || null;

  if (!targetPlace) {
    return {
      place: null,
      label: 'Klart',
      disabled: true,
      hint: 'Det finns inga platser att öppna just nu.'
    };
  }

  const availability = getPlaceAvailability(targetPlace);
  const title = targetPlace.title || targetPlace.name || 'Plats';

  if (availability.pendingPosition) {
    return {
      place: targetPlace,
      label: 'Öppna närmaste',
      disabled: false,
      hint: `Närmast: ${title} • väntar på position`
    };
  }

  if (availability.unlocked) {
    return {
      place: targetPlace,
      label: 'Öppna närmaste',
      disabled: false,
      hint: availability.distance != null
        ? `Närmast: ${title} • ${formatDistance(availability.distance)} bort`
        : `Närmast: ${title}`
    };
  }

  if (availability.distance != null) {
    return {
      place: targetPlace,
      label: 'Öppna närmaste',
      disabled: false,
      hint: `Närmast: ${title} • ${formatDistance(availability.distance)} bort`
    };
  }

  return {
    place: targetPlace,
    label: 'Öppna närmaste',
    disabled: false,
    hint: `Närmast: ${title}`
  };
}

function getAssignmentBottomActionState() {
  if (isMysteryAssignment()) {
    return getMysteryBottomActionState();
  }

  if (isTrailAssignment()) {
    return getTrailBottomActionState();
  }

  return getExplorationBottomActionState();
}

function getPlaceById(placeId) {
  return getPlaces().find((place) => String(place.id) === String(placeId)) || null;
}

function getContentBlocks(place) {
  const blocks = place?.content_blocks || place?.contentBlocks || [];
  if (!Array.isArray(blocks)) {
    return [];
  }

  return [...blocks].sort(compareByOrder);
}

function compareByOrder(a, b) {
  const aOrder = getOrderValue(a);
  const bOrder = getOrderValue(b);
  return aOrder - bOrder;
}

function getOrderValue(item) {
  const candidates = [
    item?.stop_order,
    item?.sort_order,
    item?.display_order,
    item?.order,
    item?.position,
    item?.id
  ];

  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return num;
    }
  }

  return Number.MAX_SAFE_INTEGER;
}

function getPlaceOrderLabel(place) {
  const places = getPlaces();
  const index = places.findIndex((item) => String(item.id) === String(place.id));
  return `Plats ${index >= 0 ? index + 1 : 'okänd'}`;
}

function getPlaceDescription(place) {
  return place.description || place.summary || place.excerpt || 'Ingen beskrivning tillgänglig ännu.';
}

function getPlaceDistanceMeters(place) {
  if (!state.userPosition || !hasCoordinates(place)) {
    return null;
  }

  return haversineDistanceMeters(
    state.userPosition.latitude,
    state.userPosition.longitude,
    Number(place.latitude),
    Number(place.longitude)
  );
}

function getPlaceUnlockDistance(place) {
  const candidates = [
    place?.unlock_radius_meters,
    place?.unlockRadiusMeters,
    place?.unlock_distance_meters,
    place?.unlockDistanceMeters,
    place?.unlock_distance,
    place?.unlockDistance,
    place?.radius_meters,
    place?.radiusMeters,
    place?.radius,
    place?.proximity_meters,
    place?.proximityMeters,
    place?.proximity_radius_meters,
    place?.proximityRadiusMeters,
    place?.gps_radius_meters,
    place?.gpsRadiusMeters,
    place?.trigger_radius_meters,
    place?.triggerRadiusMeters,
    place?.activation_radius_meters,
    place?.activationRadiusMeters,
    place?.geofence_radius_meters,
    place?.geofenceRadiusMeters,
    place?.distance_meters,
    place?.distanceMeters,
    place?.unlock?.radius_meters,
    place?.unlock?.distance_meters,
    place?.unlock?.distance,
    state.assignment?.unlock_radius_meters,
    state.assignment?.unlockRadiusMeters,
    state.assignment?.unlock_distance_meters,
    state.assignment?.unlockDistanceMeters,
    state.assignment?.unlock_distance,
    state.assignment?.unlockDistance,
    state.assignment?.radius_meters,
    state.assignment?.radiusMeters,
    state.assignment?.radius,
    state.assignment?.proximity_meters,
    state.assignment?.proximityMeters,
    state.assignment?.proximity_radius_meters,
    state.assignment?.proximityRadiusMeters,
    state.assignment?.gps_radius_meters,
    state.assignment?.gpsRadiusMeters,
    state.assignment?.trigger_radius_meters,
    state.assignment?.triggerRadiusMeters,
    state.assignment?.activation_radius_meters,
    state.assignment?.activationRadiusMeters,
    state.assignment?.geofence_radius_meters,
    state.assignment?.geofenceRadiusMeters,
    state.assignment?.distance_meters,
    state.assignment?.distanceMeters,
    state.assignment?.unlock?.radius_meters,
    state.assignment?.unlock?.distance_meters,
    state.assignment?.unlock?.distance
  ];

  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) {
      return num;
    }
  }

  return mapConfig.nearDistanceMeters;
}

function getUnlockMode(place = null) {
  return String(place?.unlock_mode || state.assignment?.unlock_mode || state.assignment?.unlockMode || 'free')
    .trim()
    .toLowerCase();
}

function getPlaceAvailability(place) {
  if (!place) {
    return {
      visited: false,
      unlockMode: 'free',
      requiresLocation: false,
      distance: null,
      unlockDistance: mapConfig.nearDistanceMeters,
      pendingPosition: false,
      sequenceBlocked: false,
      previousPlace: null,
      unlocked: false
    };
  }

  const visited = hasVisitedPlace(place.id);

  // Preview-läge — alla platser tillgängliga utan GPS
  if (state.isPreviewMode) {
    const sorted = [...getPlaces()].sort((a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0));
    const currentIndex = sorted.findIndex((p) => String(p.id) === String(place.id));
    const previousPlace = currentIndex > 0 ? sorted[currentIndex - 1] : null;
    const sequenceBlocked = isLinearMode() && !!(previousPlace && !hasVisitedPlace(previousPlace.id) && !visited);
    return { visited, unlockMode: getUnlockMode(place), requiresLocation: false, distance: 0, unlockDistance: 0, pendingPosition: false, sequenceBlocked, previousPlace: sequenceBlocked ? previousPlace : null, unlocked: visited || !sequenceBlocked };
  }

  // Digitala uppdrag: alltid linjär ordning, aldrig GPS
  if (isDigitalAssignment()) {
    const sorted = [...getPlaces()].sort((a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0));
    const currentIndex = sorted.findIndex((p) => String(p.id) === String(place.id));
    const previousPlace = currentIndex > 0 ? sorted[currentIndex - 1] : null;
    const sequenceBlocked = !!(previousPlace && !hasVisitedPlace(previousPlace.id) && !visited);

    return {
      visited,
      unlockMode: 'linear',
      requiresLocation: false,
      distance: null,
      unlockDistance: 0,
      pendingPosition: false,
      sequenceBlocked,
      previousPlace,
      unlocked: visited || !sequenceBlocked
    };
  }

  const unlockMode = getUnlockMode(place);

  /*
    Viktigt:
    unlock_mode i admin används här bara för mystery uppdrag som ska gå i en
    bestämd ordning. GPS upplåsningen följer fortfarande platsens radius.
  */
  const requiresLocation = hasCoordinates(place);
  const distance = getPlaceDistanceMeters(place);
  const unlockDistance = getPlaceUnlockDistance(place);
  const previousPlace = isLinearMode() ? getPreviousPlaceInSequence(place) : null;
  const sequenceBlocked = !!(previousPlace && !hasVisitedPlace(previousPlace.id) && !visited);

  /*
    Om ordningen inte är uppfylld ska platsen inte visas som upplåst även om
    användaren står precis vid platsen.
  */
  const pendingPosition = !sequenceBlocked && requiresLocation && (!state.userPosition || distance == null);

  let unlocked = false;
  if (visited) {
    unlocked = true;
  } else if (sequenceBlocked) {
    unlocked = false;
  } else if (!hasCoordinates(place)) {
    unlocked = true;
  } else if (!pendingPosition && distance != null) {
    unlocked = distance <= unlockDistance;
  }

  return {
    visited,
    unlockMode,
    requiresLocation,
    distance,
    unlockDistance,
    pendingPosition,
    sequenceBlocked,
    previousPlace,
    unlocked
  };
}

function isPlaceUnlocked(place) {
  return getPlaceAvailability(place).unlocked;
}

function hasVisitedPlace(placeId) {
  const row = state.progressByPlaceId[placeId] || state.progressByPlaceId[String(placeId)];
  if (!row) {
    return false;
  }

  return row.visited === true || row.visited_at || row.visit_time || row.completed_at || row.place_id != null;
}

function getHeroMediaBlock(blocks) {
  return blocks.find((block) => {
    const type = normalizeBlockType(block.type);
    const url = resolveMediaUrl(getBlockMediaUrl(block));
    if (!url) {
      return false;
    }
    return type === 'image' || type === 'video' || looksLikeImageUrl(url) || looksLikeVideoUrl(url);
  }) || null;
}

function createContentBlockElement(block, place = null, availability = null) {
  const article = document.createElement('article');
  article.className = 'content-block';

  const title = getBlockTitle(block);
  if (title) {
    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    article.appendChild(titleEl);
  }

  const type = normalizeBlockType(block.type);

  if (isClueType(type)) {
    const clueNode = createClueNode(block);
    if (clueNode) {
      article.classList.add('content-block-clue');
      article.appendChild(clueNode);
    }
    return article;
  }

  if (isQuestionType(type)) {
    const questionNode = createQuestionNode(block, place, availability);
    if (questionNode) {
      article.appendChild(questionNode);
    }
  } else if (isSolutionType(type)) {
    const solutionNode = createSolutionNode(block, place, availability);
    if (solutionNode) {
      article.classList.add('content-block-solution');
      article.appendChild(solutionNode);
    }
  } else if (isTextLikeType(type)) {
    const text = extractTextContent(block);
    if (text) {
      const textEl = document.createElement('div');
      textEl.className = 'text-content';
      textEl.textContent = text;
      article.appendChild(textEl);
    }
  }

  const mediaNode = createMediaNode(block, false);
  if (mediaNode) {
    const wrapper = document.createElement('div');
    wrapper.className = 'content-media';
    wrapper.appendChild(mediaNode);
    article.appendChild(wrapper);
  }

  const linkUrl = resolveMediaUrl(getFirstDefined(block.cta_url, block.link_url, block.href, block.url));
  const ctaLabel = getFirstDefined(block.cta_label, block.link_text, block.button_text, 'Öppna länk');
  if (linkUrl && !mediaNode && !looksLikeMediaUrl(linkUrl)) {
    const link = document.createElement('a');
    link.className = 'link-button';
    link.href = linkUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = ctaLabel;
    article.appendChild(link);
  }

  if (!article.childNodes.length) {
    const fallback = document.createElement('div');
    fallback.className = 'text-content';
    fallback.textContent = 'Det här innehållsblocket saknar visningsbart innehåll i PWA:n just nu.';
    article.appendChild(fallback);
  }

  return article;
}



function createWitnessNode(block) {
  const wrapper = document.createElement('div');
  wrapper.className = 'witness-block';

  // Tillförlitlighetsmarkering
  const reliabilityConfig = {
    reliable:   { label: 'Pålitlig',     cls: 'witness-reliable' },
    uncertain:  { label: 'Osäker',       cls: 'witness-uncertain' },
    suspicious: { label: 'Misstänksam',  cls: 'witness-suspicious' }
  };
  const rel = reliabilityConfig[block.witness_reliability] || null;

  // Header: bild + namn + roll
  const header = document.createElement('div');
  header.className = 'witness-header';

  if (block.witness_image_url) {
    const img = document.createElement('img');
    img.src = block.witness_image_url;
    img.alt = block.witness_name || 'Vittne';
    img.className = 'witness-portrait';
    header.appendChild(img);
  } else {
    const avatar = document.createElement('div');
    avatar.className = 'witness-avatar';
    avatar.textContent = block.witness_name ? block.witness_name.charAt(0).toUpperCase() : 'V';
    header.appendChild(avatar);
  }

  const nameWrap = document.createElement('div');
  nameWrap.className = 'witness-name-wrap';

  if (block.witness_name) {
    const name = document.createElement('div');
    name.className = 'witness-name';
    name.textContent = block.witness_name;
    nameWrap.appendChild(name);
  }

  if (block.witness_role) {
    const role = document.createElement('div');
    role.className = 'witness-role';
    role.textContent = block.witness_role;
    nameWrap.appendChild(role);
  }

  header.appendChild(nameWrap);

  if (rel) {
    const badge = document.createElement('span');
    badge.className = `witness-reliability-badge ${rel.cls}`;
    badge.textContent = rel.label;
    header.appendChild(badge);
  }

  wrapper.appendChild(header);

  // Uttalande
  if (block.witness_statement) {
    const statement = document.createElement('blockquote');
    statement.className = 'witness-statement';
    statement.textContent = block.witness_statement;
    wrapper.appendChild(statement);
  }

  return wrapper;
}

// ─── Bevisblock ───────────────────────────────────────────────
function createEvidenceNode(block) {
  const wrapper = document.createElement('div');
  wrapper.className = 'evidence-block';

  // Header med märkning och titel
  const header = document.createElement('div');
  header.className = 'evidence-block-header';

  if (block.evidence_label) {
    const label = document.createElement('span');
    label.className = 'evidence-label-badge';
    label.textContent = block.evidence_label;
    header.appendChild(label);
  }

  if (block.title) {
    const title = document.createElement('span');
    title.className = 'evidence-block-title';
    title.textContent = block.title;
    header.appendChild(title);
  }

  wrapper.appendChild(header);

  // Bild
  if (block.media_url) {
    const img = document.createElement('img');
    img.src = block.media_url;
    img.alt = block.title || 'Bevis';
    img.className = 'evidence-block-img';
    img.loading = 'lazy';
    wrapper.appendChild(img);
  }

  // Beskrivning
  if (block.body) {
    const desc = document.createElement('p');
    desc.className = 'evidence-block-desc';
    desc.textContent = block.body;
    wrapper.appendChild(desc);
  }

  // Dold detaljbeskrivning
  if (block.evidence_detail) {
    const detailBtn = document.createElement('button');
    detailBtn.type = 'button';
    detailBtn.className = 'evidence-detail-btn';
    detailBtn.textContent = 'Granska närmare';

    const detailText = document.createElement('div');
    detailText.className = 'evidence-detail-text hidden';
    detailText.textContent = block.evidence_detail;

    detailBtn.addEventListener('click', () => {
      const hidden = detailText.classList.toggle('hidden');
      detailBtn.textContent = hidden ? 'Granska närmare' : 'Dölj detalj';
    });

    wrapper.appendChild(detailBtn);
    wrapper.appendChild(detailText);
  }

  // Länk till bevissamling
  const hint = document.createElement('div');
  hint.className = 'evidence-collection-hint';
  hint.textContent = 'Beviset sparas i din bevissamling';
  wrapper.appendChild(hint);

  return wrapper;
}

function isClueOpen(blockId) {
  return state.openClueIds.has(blockId) || state.openClueIds.has(String(blockId));
}

function hasViewedClue(blockId) {
  return state.viewedClueIds.has(String(blockId));
}

function getMaxClues() {
  const val = state.assignment?.max_clues;
  if (val === null || val === undefined || val === '') return null; // obegränsat
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function getUsedClueCount() {
  return state.viewedClueIds.size;
}

function getRemainingClues() {
  const max = getMaxClues();
  if (max === null) return null; // obegränsat
  return Math.max(0, max - getUsedClueCount());
}

function isClueBlocked(blockId) {
  // Redan öppnad — aldrig blockerad
  if (hasViewedClue(blockId)) return false;
  const remaining = getRemainingClues();
  return remaining !== null && remaining <= 0;
}

function markClueViewed(blockId) {
  const key = String(blockId);
  state.viewedClueIds.add(key);
  persistViewedCluesToStorage();
}

function toggleClueBlock(blockId) {
  const key = String(blockId);

  if (state.openClueIds.has(key)) {
    state.openClueIds.delete(key);
  } else {
    // Kontrollera ledtråds-gränsen innan öppning
    if (isClueBlocked(blockId)) {
      showStatus('Du har använt alla dina ledtrådar för det här uppdraget.', true);
      return;
    }
    state.openClueIds.add(key);
    markClueViewed(key);
  }

  if (state.activePlaceId) {
    const place = getPlaceById(state.activePlaceId);
    if (place) {
      renderPlaceDetail(place);
    }
  }
}

function createClueNode(block) {
  const wrapper = document.createElement('div');
  wrapper.className = 'clue-block';

  const introRow = document.createElement('div');
  introRow.className = 'clue-intro-row';

  const intro = document.createElement('div');
  intro.className = 'clue-intro';
  intro.textContent = 'Ledtråd';
  introRow.appendChild(intro);

  if (hasViewedClue(block.id)) {
    const viewed = document.createElement('div');
    viewed.className = 'clue-viewed-badge';
    viewed.textContent = 'Öppnad';
    introRow.appendChild(viewed);
  }

  // Visa ledtråds-räknare om gräns är satt
  const max = getMaxClues();
  if (max !== null) {
    const remaining = getRemainingClues();
    const counter = document.createElement('div');
    counter.className = 'clue-counter' + (remaining === 0 && !hasViewedClue(block.id) ? ' clue-counter--empty' : '');
    counter.textContent = hasViewedClue(block.id)
      ? `${getUsedClueCount()} / ${max} använda`
      : remaining === 0
        ? 'Inga ledtrådar kvar'
        : `${remaining} av ${max} kvar`;
    introRow.appendChild(counter);
  }

  wrapper.appendChild(introRow);

  const blocked = isClueBlocked(block.id);
  const open = isClueOpen(block.id);

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'clue-toggle-btn' + (blocked ? ' clue-toggle-btn--blocked' : '');
  toggleBtn.disabled = blocked;

  toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (blocked) {
    toggleBtn.innerHTML = `<span>Inga ledtrådar kvar</span><span class="clue-toggle-icon">🔒</span>`;
  } else {
    toggleBtn.innerHTML = `<span>${open ? 'Dölj ledtråd' : 'Visa ledtråd'}</span><span class="clue-toggle-icon">${open ? '▴' : '▾'}</span>`;
    toggleBtn.addEventListener('click', () => toggleClueBlock(block.id));
  }
  wrapper.appendChild(toggleBtn);

  if (!open) {
    const muted = document.createElement('div');
    muted.className = 'clue-muted';
    if (blocked) {
      muted.textContent = 'Du har använt alla dina ledtrådar för det här uppdraget.';
    } else {
      muted.textContent = hasViewedClue(block.id) ? 'Ledtråden har öppnats tidigare på den här enheten.' : 'Tryck för att öppna ledtråden.';
    }
    wrapper.appendChild(muted);
    return wrapper;
  }

  const text = extractTextContent(block);
  if (text) {
    const textEl = document.createElement('div');
    textEl.className = 'text-content clue-content';
    textEl.textContent = text;
    wrapper.appendChild(textEl);
  }

  const mediaNode = createMediaNode(block, false);
  if (mediaNode) {
    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'content-media';
    mediaWrap.appendChild(mediaNode);
    wrapper.appendChild(mediaWrap);
  }

  const linkUrl = resolveMediaUrl(getFirstDefined(block.cta_url, block.link_url, block.href, block.url));
  const ctaLabel = getFirstDefined(block.cta_label, block.link_text, block.button_text, 'Öppna ledtråd');
  if (linkUrl && !mediaNode && !looksLikeMediaUrl(linkUrl)) {
    const link = document.createElement('a');
    link.className = 'link-button';
    link.href = linkUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = ctaLabel;
    wrapper.appendChild(link);
  }

  if (!text && !mediaNode && !linkUrl) {
    const empty = document.createElement('div');
    empty.className = 'clue-muted';
    empty.textContent = 'Den här ledtråden saknar innehåll.';
    wrapper.appendChild(empty);
  }

  return wrapper;
}

function canAnswerBlock(place, availability) {
  if (!place || !availability) {
    return false;
  }

  if (availability.pendingPosition) {
    return false;
  }

  return availability.visited || availability.unlocked;
}

function getGradingMode() {
  return String(state.assignment?.grading_mode || 'auto').trim().toLowerCase();
}

function shouldShowImmediateFeedback() {
  return getGradingMode() !== 'collected';
}

function normalizeCorrectness(value) {
  if (value === true) {
    return 1;
  }

  if (value === false) {
    return 0;
  }

  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function getProgressForBlock(blockId) {
  return state.progressByBlockId[blockId] || state.progressByBlockId[String(blockId)] || null;
}

function hasProgressAnswer(progress) {
  if (!progress) {
    return false;
  }

  return hasValue(progress.chosen_option) || hasValue(progress.solution_text) || normalizeCorrectness(progress.is_correct) === 0 || normalizeCorrectness(progress.is_correct) === 1;
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function normalizeChosenOption(value) {
  return hasValue(value) ? String(value).trim().toLowerCase() : '';
}

function getOptionLabelValue(block, optionKey) {
  const key = normalizeChosenOption(optionKey);
  if (!key) {
    return '';
  }
  return getFirstDefined(block[`option_${key}`], '');
}

async function submitQuestionAnswer(place, block, optionKey) {
  if (!place) {
    showStatus('Platsen kunde inte identifieras.', true);
    return;
  }

  const availability = getPlaceAvailability(place);
  if (!canAnswerBlock(place, availability)) {
    if (availability.sequenceBlocked) {
      const previousTitle = availability.previousPlace?.title || availability.previousPlace?.name || 'föregående plats';
      showStatus(`Du kan svara här när ${previousTitle} har besökts.`, true);
    } else {
      showStatus(availability.pendingPosition ? 'Väntar på position innan du kan svara.' : 'Du kan svara när du är på plats.', true);
    }
    return;
  }

  if (!state.sessionToken) {
    showStatus('Ingen aktiv session finns.', true);
    return;
  }

  if (state.pendingBlockIds.has(block.id) || hasProgressAnswer(getProgressForBlock(block.id))) {
    return;
  }

  state.pendingBlockIds.add(block.id);
  renderPlaceDetail(place);

  const payload = {
    place_id: place.id,
    placeId: place.id,
    block_id: block.id,
    blockId: block.id,
    chosen_option: optionKey,
    chosenOption: optionKey,
    answer_type: 'question'
  };

  try {
    const response = await fetchJson(`${apiBaseUrl}/sessions/${encodeURIComponent(state.sessionToken)}/progress`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const result = response?.data || response || {};

    mergeProgressRow({
      place_id: place.id,
      block_id: block.id,
      chosen_option: optionKey,
      visited_at: new Date().toISOString(),
      is_correct: result.is_correct,
      points_earned: result.points_earned || 0,
      explanation: getFirstDefined(block.explanation, ''),
      placeId: place.id,
      blockId: block.id
    });

    await loadProgress(true);

    if (shouldShowImmediateFeedback()) {
      if (normalizeCorrectness(result.is_correct) === 1) {
        showStatus(`Rätt svar${result.points_earned ? `, +${result.points_earned} poäng` : ''}.`);
      } else if (normalizeCorrectness(result.is_correct) === 0) {
        showStatus('Svaret sparades. Det var inte rätt.', true);
      } else {
        showStatus('Svar sparat.');
      }
    } else {
      showStatus('Svar sparat. Rättning visas senare av arrangören.');
    }
  } catch (error) {
    console.error(error);
    showStatus(error.message || 'Kunde inte spara svaret.', true);
  } finally {
    state.pendingBlockIds.delete(block.id);
    renderAssignmentView();
    if (state.activePlaceId === place.id) {
      renderPlaceDetail(place);
    }
    checkAndShowAutoComplete();
  }
}

async function submitSolutionAnswer(place, block, rawValue) {
  if (!place) {
    showStatus('Platsen kunde inte identifieras.', true);
    return;
  }

  const solutionText = String(rawValue || '').trim();
  if (!solutionText) {
    showStatus('Skriv ett svar först.', true);
    return;
  }

  const availability = getPlaceAvailability(place);
  if (!canAnswerBlock(place, availability)) {
    if (availability.sequenceBlocked) {
      const previousTitle = availability.previousPlace?.title || availability.previousPlace?.name || 'föregående plats';
      showStatus(`Du kan svara här när ${previousTitle} har besökts.`, true);
    } else {
      showStatus(availability.pendingPosition ? 'Väntar på position innan du kan svara.' : 'Du kan svara när du är på plats.', true);
    }
    return;
  }

  if (!state.sessionToken) {
    showStatus('Ingen aktiv session finns.', true);
    return;
  }

  if (state.pendingBlockIds.has(block.id) || hasProgressAnswer(getProgressForBlock(block.id))) {
    return;
  }

  state.pendingBlockIds.add(block.id);
  renderPlaceDetail(place);

  const payload = {
    place_id: place.id,
    placeId: place.id,
    block_id: block.id,
    blockId: block.id,
    solution_text: solutionText,
    solutionText: solutionText,
    answer_type: 'solution'
  };

  try {
    const response = await fetchJson(`${apiBaseUrl}/sessions/${encodeURIComponent(state.sessionToken)}/progress`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const result = response?.data || response || {};

    mergeProgressRow({
      place_id: place.id,
      block_id: block.id,
      solution_text: solutionText,
      visited_at: new Date().toISOString(),
      is_correct: result.is_correct,
      points_earned: result.points_earned || 0,
      explanation: getFirstDefined(block.explanation, ''),
      placeId: place.id,
      blockId: block.id
    });

    await loadProgress(true);

    if (shouldShowImmediateFeedback()) {
      if (normalizeCorrectness(result.is_correct) === 1) {
        showStatus(`Rätt svar${result.points_earned ? `, +${result.points_earned} poäng` : ''}.`);
      } else if (normalizeCorrectness(result.is_correct) === 0) {
        showStatus('Svaret sparades. Det var inte rätt.', true);
      } else {
        showStatus('Svar sparat.');
      }
    } else {
      showStatus('Svar sparat. Rättning visas senare av arrangören.');
    }
  } catch (error) {
    console.error(error);
    showStatus(error.message || 'Kunde inte spara svaret.', true);
  } finally {
    state.pendingBlockIds.delete(block.id);
    renderAssignmentView();
    if (state.activePlaceId === place.id) {
      renderPlaceDetail(place);
    }
    checkAndShowAutoComplete();
  }
}

function mergeProgressRow(row) {
  if (!row) {
    return;
  }

  const placeId = row.place_id || row.placeId;
  const blockId = row.block_id || row.blockId;

  if (placeId != null) {
    state.progressByPlaceId[placeId] = {
      ...(state.progressByPlaceId[placeId] || {}),
      ...row
    };
  }

  if (blockId != null) {
    state.progressByBlockId[blockId] = {
      ...(state.progressByBlockId[blockId] || {}),
      ...row
    };
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


function isClueType(type) {
  return type === 'clue' || type === 'hint' || type === 'lead';
}


function createQuestionNode(block, place, availability) {
  const wrapper = document.createElement('div');
  wrapper.className = 'question-block';

  if (block.body) {
    const prompt = document.createElement('div');
    prompt.className = 'question-prompt';
    prompt.textContent = block.body;
    wrapper.appendChild(prompt);
  }

  const options = [
    ['A', block.option_a],
    ['B', block.option_b],
    ['C', block.option_c],
    ['D', block.option_d]
  ].filter(([, value]) => value);

  const progress = getProgressForBlock(block.id);
  const hasAnswer = hasProgressAnswer(progress);
  const selectedOption = normalizeChosenOption(progress?.chosen_option);
  const isSaving = state.pendingBlockIds.has(block.id);
  const canAnswer = canAnswerBlock(place, availability);

  if (options.length) {
    const list = document.createElement('div');
    list.className = 'question-options';

    for (const [label, value] of options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'question-option question-option-button';
      button.innerHTML = `<span class="question-option-label">${label}</span><span class="question-option-text">${escapeHtml(value)}</span>`;

      const optionKey = label.toLowerCase();
      const isSelected = selectedOption === optionKey;
      button.classList.toggle('is-selected', isSelected);
      button.classList.toggle('is-correct', isSelected && normalizeCorrectness(progress?.is_correct) === 1);
      button.classList.toggle('is-incorrect', isSelected && normalizeCorrectness(progress?.is_correct) === 0);

      if (hasAnswer || isSaving || !canAnswer) {
        button.disabled = true;
      } else {
        button.addEventListener('click', () => submitQuestionAnswer(place, block, optionKey));
      }

      list.appendChild(button);
    }

    wrapper.appendChild(list);
  }

  if (isSaving) {
    const saving = document.createElement('div');
    saving.className = 'answer-status is-pending';
    saving.textContent = 'Sparar svar...';
    wrapper.appendChild(saving);
  } else if (hasAnswer) {
    const selectedValue = getOptionLabelValue(block, selectedOption);
    const summary = document.createElement('div');
    summary.className = 'answer-status';

    let summaryText = selectedOption
      ? `Ditt svar: ${selectedOption.toUpperCase()}${selectedValue ? `. ${selectedValue}` : ''}`
      : 'Svar sparat';

    if (shouldShowImmediateFeedback()) {
      if (normalizeCorrectness(progress?.is_correct) === 1) {
        summary.classList.add('is-correct');
        summaryText += progress?.points_earned != null ? ` · Rätt, +${progress.points_earned} poäng` : ' · Rätt';
      } else if (normalizeCorrectness(progress?.is_correct) === 0) {
        summary.classList.add('is-incorrect');
        summaryText += ' · Fel';
      }
    } else {
      summary.classList.add('is-muted');
      summaryText += ' · Sparat för senare rättning';
    }

    summary.textContent = summaryText;
    wrapper.appendChild(summary);

    if (shouldShowImmediateFeedback()) {
      const explanationText = getFirstDefined(progress?.explanation, block.explanation, '');
      if (explanationText) {
        const explanation = document.createElement('div');
        explanation.className = 'question-explanation';
        explanation.textContent = explanationText;
        wrapper.appendChild(explanation);
      }
    }
  } else if (!canAnswer) {
    const notice = document.createElement('div');
    notice.className = 'answer-status is-muted';
    notice.textContent = availability?.pendingPosition
      ? 'Du kan prova lösningen när din position har verifierats.'
      : 'Du kan prova lösningen när du är på plats.';
    wrapper.appendChild(notice);
  }

  return wrapper;
}

function createSolutionNode(block, place, availability) {
  const wrapper = document.createElement('div');
  wrapper.className = 'solution-block';

  const introRow = document.createElement('div');
  introRow.className = 'solution-intro-row';

  const intro = document.createElement('div');
  intro.className = 'solution-intro';
  intro.textContent = 'Lösning';
  introRow.appendChild(intro);

  wrapper.appendChild(introRow);

  if (block.body) {
    const body = document.createElement('div');
    body.className = 'text-content solution-body';
    body.textContent = block.body;
    wrapper.appendChild(body);
  }

  const progress = getProgressForBlock(block.id);
  const hasAnswer = hasProgressAnswer(progress);
  const isSaving = state.pendingBlockIds.has(block.id);
  const canAnswer = canAnswerBlock(place, availability);

  if (block.solution_hint && !hasAnswer) {
    const hint = document.createElement('div');
    hint.className = 'solution-hint';
    hint.textContent = `Ledtråd: ${block.solution_hint}`;
    wrapper.appendChild(hint);
  }

  if (isSaving) {
    const saving = document.createElement('div');
    saving.className = 'answer-status is-pending';
    saving.textContent = 'Sparar svar...';
    wrapper.appendChild(saving);
    return wrapper;
  }

  if (hasAnswer) {
    const saved = document.createElement('div');
    saved.className = 'answer-status';

    let summaryText = progress?.solution_text
      ? `Ditt svar: ${progress.solution_text}`
      : 'Svar sparat';

    if (shouldShowImmediateFeedback()) {
      if (normalizeCorrectness(progress?.is_correct) === 1) {
        saved.classList.add('is-correct');
        summaryText += progress?.points_earned != null ? ` · Rätt, +${progress.points_earned} poäng` : ' · Rätt';
      } else if (normalizeCorrectness(progress?.is_correct) === 0) {
        saved.classList.add('is-incorrect');
        summaryText += ' · Fel';
      }
    } else {
      saved.classList.add('is-muted');
      summaryText += ' · Sparat för senare rättning';
    }

    saved.textContent = summaryText;
    wrapper.appendChild(saved);

    if (shouldShowImmediateFeedback() && block.explanation) {
      const explanation = document.createElement('div');
      explanation.className = 'question-explanation solution-explanation';
      explanation.textContent = block.explanation;
      wrapper.appendChild(explanation);
    }

    return wrapper;
  }

  if (!canAnswer) {
    const notice = document.createElement('div');
    notice.className = 'answer-status is-muted';
    notice.textContent = availability?.pendingPosition
      ? 'Du kan svara när din position har verifierats.'
      : 'Du kan svara när du är på plats.';
    wrapper.appendChild(notice);
    return wrapper;
  }

  const form = document.createElement('form');
  form.className = 'solution-form';

  const input = document.createElement('textarea');
  input.className = 'solution-input';
  input.rows = 3;
  input.placeholder = isMysteryAssignment() ? 'Skriv din lösning här' : 'Skriv ditt svar här';
  form.appendChild(input);

  const actions = document.createElement('div');
  actions.className = 'solution-actions';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'solution-submit';
  submit.textContent = isMysteryAssignment() ? 'Pröva lösning' : 'Skicka svar';
  actions.appendChild(submit);

  form.appendChild(actions);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitSolutionAnswer(place, block, input.value);
  });

  wrapper.appendChild(form);
  return wrapper;
}

// ─── Lightbox (pinch-to-zoom för bilder) ──────────────────────
function openLightbox(src, alt) {
  const existing = document.getElementById('spoton-lightbox');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'spoton-lightbox';
  overlay.className = 'lightbox-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', alt || 'Bild');

  const img = document.createElement('img');
  img.src = src;
  img.alt = alt || 'Bild';
  img.className = 'lightbox-img';
  img.draggable = false;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'lightbox-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Stäng');
  closeBtn.addEventListener('click', closeLightbox);

  overlay.appendChild(img);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);

  // Stäng vid klick på bakgrunden
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeLightbox();
  });

  // Stäng med Escape
  document.addEventListener('keydown', onLightboxKeyDown);

  // Pinch-to-zoom
  let scale = 1;
  let startDist = 0;
  let startScale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let startX = 0;
  let startY = 0;
  let isDragging = false;

  img.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      startDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      startScale = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      startX = e.touches[0].clientX - offsetX;
      startY = e.touches[0].clientY - offsetY;
      isDragging = true;
    }
  }, { passive: true });

  img.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      scale = Math.min(5, Math.max(1, startScale * (dist / startDist)));
      img.style.transform = `scale(${scale}) translate(${offsetX / scale}px, ${offsetY / scale}px)`;
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      offsetX = e.touches[0].clientX - startX;
      offsetY = e.touches[0].clientY - startY;
      img.style.transform = `scale(${scale}) translate(${offsetX / scale}px, ${offsetY / scale}px)`;
    }
  }, { passive: true });

  img.addEventListener('touchend', () => {
    isDragging = false;
    if (scale < 1.05) {
      scale = 1;
      offsetX = 0;
      offsetY = 0;
      img.style.transform = '';
    }
  }, { passive: true });

  // Dubbelklick för att zooma in/ut
  img.addEventListener('dblclick', () => {
    if (scale > 1) {
      scale = 1;
      offsetX = 0;
      offsetY = 0;
      img.style.transform = '';
    } else {
      scale = 2.5;
      img.style.transform = `scale(${scale})`;
    }
  });

  requestAnimationFrame(() => overlay.classList.add('active'));
}

function closeLightbox() {
  const overlay = document.getElementById('spoton-lightbox');
  if (!overlay) return;
  overlay.classList.remove('active');
  document.removeEventListener('keydown', onLightboxKeyDown);
  setTimeout(() => overlay.remove(), 200);
}

function onLightboxKeyDown(e) {
  if (e.key === 'Escape') closeLightbox();
}

function createMediaNode(block, mutedPreview) {
  const type = normalizeBlockType(block.type);
  const rawUrl = getBlockMediaUrl(block);
  const url = resolveMediaUrl(rawUrl);

  if (!url) {
    return null;
  }

  if (type === 'image' || looksLikeImageUrl(url)) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = getBlockTitle(block) || 'Bild';
    img.loading = 'lazy';
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => openLightbox(url, img.alt));
    return img;
  }

  if (type === 'video' || looksLikeVideoUrl(url)) {
    const video = document.createElement('video');
    video.src = url;
    video.controls = true;
    video.preload = mutedPreview ? 'metadata' : 'auto';
    if (mutedPreview) {
      video.muted = true;
      video.playsInline = true;
    }
    return video;
  }

  if (type === 'audio' || looksLikeAudioUrl(url)) {
    const audio = document.createElement('audio');
    audio.src = url;
    audio.controls = true;
    audio.preload = mutedPreview ? 'metadata' : 'auto';
    return audio;
  }

  if ((type === 'embed' || type === 'iframe') && isEmbeddableUrl(url)) {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.loading = 'lazy';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    return iframe;
  }

  return null;
}

function normalizeBlockType(type) {
  return String(type || '').trim().toLowerCase();
}

function isTextLikeType(type) {
  return [
    '',
    'text',
    'rich_text',
    'paragraph',
    'info',
    'intro',
    'body',
    'note',
    'html',
    'markdown'
  ].includes(type);
}

function isMediaBlock(block) {
  const type = normalizeBlockType(block.type);
  const url = resolveMediaUrl(getBlockMediaUrl(block));

  if (!url) {
    return false;
  }

  return ['image', 'audio', 'video', 'embed', 'iframe'].includes(type) || looksLikeMediaUrl(url);
}

function getBlockTitle(block) {
  return getFirstDefined(block.title, block.heading, block.label, block.name, '');
}

function getBlockMediaUrl(block) {
  return getFirstDefined(
    block.media_url,
    block.mediaUrl,
    block.file_url,
    block.fileUrl,
    block.asset_url,
    block.assetUrl,
    block.url,
    block.embed_url,
    block.embedUrl,
    ''
  );
}

function extractTextContent(block) {
  const raw = getFirstDefined(
    block.body,
    block.text,
    block.content,
    block.description,
    block.caption,
    block.html,
    block.markdown,
    ''
  );

  if (!raw) {
    return '';
  }

  return stripHtml(String(raw)).trim();
}

function stripHtml(value) {
  if (!value || !value.includes('<')) {
    return value || '';
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(value, 'text/html');
  return doc.body.textContent || '';
}

function resolveMediaUrl(url) {
  if (!url) {
    return '';
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  if (mediaBaseUrl) {
    return `${mediaBaseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  }

  return url;
}

function looksLikeMediaUrl(url) {
  return looksLikeImageUrl(url) || looksLikeVideoUrl(url) || looksLikeAudioUrl(url);
}

function looksLikeImageUrl(url) {
  return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url);
}

function looksLikeVideoUrl(url) {
  return /\.(mp4|m4v|mov|webm)(\?.*)?$/i.test(url);
}

function looksLikeAudioUrl(url) {
  return /\.(mp3|m4a|wav|ogg|aac)(\?.*)?$/i.test(url);
}

function isEmbeddableUrl(url) {
  return /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
}

function buildProgressIndexes(progressRows) {
  const rows = Array.isArray(progressRows) ? progressRows : [];
  const byPlaceId = {};
  const byBlockId = {};

  for (const row of rows) {
    const placeId = row.place_id || row.placeId;
    const blockId = row.block_id || row.blockId;

    if (placeId != null) {
      const existing = byPlaceId[placeId] || {};
      byPlaceId[placeId] = {
        ...existing,
        ...row,
        // Sätt alltid visited:true om visited_at finns — server returnerar
        // visited_at men inte visited, så vi normaliserar det här.
        visited: existing.visited || row.visited || !!(row.visited_at || row.visit_time || row.completed_at),
      };
    }

    if (blockId != null) {
      byBlockId[blockId] = {
        ...(byBlockId[blockId] || {}),
        ...row
      };
    }
  }

  return { byPlaceId, byBlockId };
}

function humanizeType(type) {
  const map = {
    exploration: 'Utforskning',
    quiz: 'Tipspromenad',
    mystery: 'Mordgåta',
    treasure_hunt: 'Skattjakt',
    free: 'Fritt uppdrag'
  };

  return map[type] || 'Uppdrag';
}

async function fetchJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });
  } catch (networkError) {
    // Nätverksfel — ingen anslutning till servern
    throw new Error('Ingen anslutning till servern. Kontrollera din internetanslutning och försök igen.');
  }

  const raw = await response.text();
  const data = raw ? safeJsonParse(raw) : null;

  if (!response.ok) {
    const message = data?.error || data?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function getFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return '';
}

function safeJsonParse(value) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function toNumberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function hasCoordinates(place) {
  return Number.isFinite(Number(place?.latitude)) && Number.isFinite(Number(place?.longitude));
}


function bindMapInteractions() {
  if (!els.mapCanvas) {
    return;
  }

  els.mapCanvas.addEventListener('pointerdown', handleMapPointerDown);
  els.mapCanvas.addEventListener('pointermove', handleMapPointerMove);
  els.mapCanvas.addEventListener('pointerup', handleMapPointerUp);
  els.mapCanvas.addEventListener('pointercancel', handleMapPointerUp);
  els.mapCanvas.addEventListener('pointerleave', handleMapPointerUp);
  els.mapCanvas.addEventListener('wheel', handleMapWheel, { passive: false });
}

function canInteractWithMap(event) {
  if (!els.mapView.classList.contains('active')) {
    return false;
  }

  if (state.activePanel === 'list' || els.placeDetailView.classList.contains('active')) {
    return false;
  }

  if (event?.target?.closest('.map-marker')) {
    return false;
  }

  return true;
}

function handleMapPointerDown(event) {
  if (!canInteractWithMap(event)) {
    return;
  }

  state.map.pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
    pointerType: event.pointerType
  });

  const pointerCount = state.map.pointers.size;

  if (pointerCount === 1) {
    initDragFromPointer(event.pointerId, event.clientX, event.clientY);
  } else if (pointerCount === 2) {
    state.map.drag = null;
    beginPinchGesture();
  } else {
    state.map.drag = null;
    state.map.pinch = null;
  }

  els.mapCanvas.setPointerCapture?.(event.pointerId);
}

function handleMapPointerMove(event) {
  if (!state.map.pointers.has(event.pointerId)) {
    return;
  }

  state.map.pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
    pointerType: event.pointerType
  });

  if (state.map.pinch && state.map.pointers.size >= 2) {
    updatePinchGesture();
    return;
  }

  if (state.map.pointers.size === 2 && !state.map.pinch) {
    state.map.drag = null;
    beginPinchGesture();
    return;
  }

  const drag = state.map.drag;
  if (!drag?.active || drag.pointerId !== event.pointerId) {
    return;
  }

  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;

  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
    drag.moved = true;
  }

  const zoom = clamp(state.map.zoom || mapConfig.defaultZoom, mapConfig.minZoom, mapConfig.maxZoom);
  const nextWorldX = drag.startCenterWorldX - dx;
  const nextWorldY = drag.startCenterWorldY - dy;
  const nextLatLng = unprojectWorld(nextWorldX, nextWorldY, zoom);

  state.map.centerLat = nextLatLng.lat;
  state.map.centerLng = nextLatLng.lng;
  state.map.mode = 'manual';
  queueMapRender();
}

function handleMapPointerUp(event) {
  state.map.pointers.delete(event.pointerId);

  if (state.map.drag?.pointerId === event.pointerId) {
    state.map.drag = null;
  }

  els.mapCanvas.releasePointerCapture?.(event.pointerId);

  if (state.map.pinch) {
    if (state.map.pointers.size >= 2) {
      beginPinchGesture();
      return;
    }

    state.map.pinch = null;

    if (state.map.pointers.size === 1) {
      const [remainingId, point] = Array.from(state.map.pointers.entries())[0];
      initDragFromPointer(remainingId, point.x, point.y);
    }
  }
}

function initDragFromPointer(pointerId, clientX, clientY) {
  const zoom = clamp(state.map.zoom || mapConfig.defaultZoom, mapConfig.minZoom, mapConfig.maxZoom);
  const centerLat = state.map.centerLat ?? 59.326;
  const centerLng = state.map.centerLng ?? 14.523;
  const centerWorld = projectLatLng(centerLat, centerLng, zoom);

  state.map.drag = {
    active: true,
    pointerId,
    startX: clientX,
    startY: clientY,
    startCenterWorldX: centerWorld.x,
    startCenterWorldY: centerWorld.y,
    moved: false
  };
}

function beginPinchGesture() {
  const points = Array.from(state.map.pointers.entries()).slice(0, 2);
  if (points.length < 2) {
    return;
  }

  const [firstEntry, secondEntry] = points;
  const p1 = firstEntry[1];
  const p2 = secondEntry[1];
  const mid = midpointBetweenPoints(p1, p2);
  const distance = Math.max(distanceBetweenPoints(p1, p2), 12);

  const zoom = clamp(state.map.zoom || mapConfig.defaultZoom, mapConfig.minZoom, mapConfig.maxZoom);
  const centerLat = state.map.centerLat ?? 59.326;
  const centerLng = state.map.centerLng ?? 14.523;
  const centerWorld = projectLatLng(centerLat, centerLng, zoom);
  const width = els.mapCanvas.clientWidth || window.innerWidth || 390;
  const height = els.mapCanvas.clientHeight || window.innerHeight || 844;
  const topLeftWorldX = centerWorld.x - (width / 2);
  const topLeftWorldY = centerWorld.y - (height / 2);

  state.map.pinch = {
    pointerIds: [firstEntry[0], secondEntry[0]],
    startDistance: distance,
    startZoom: zoom,
    startMidX: mid.x,
    startMidY: mid.y,
    startAnchorWorldX: topLeftWorldX + mid.x,
    startAnchorWorldY: topLeftWorldY + mid.y
  };

  state.map.mode = 'manual';
}

function updatePinchGesture() {
  const pinch = state.map.pinch;
  if (!pinch) {
    return;
  }

  const points = pinch.pointerIds
    .map((id) => state.map.pointers.get(id))
    .filter(Boolean);

  if (points.length < 2) {
    return;
  }

  const p1 = points[0];
  const p2 = points[1];
  const width = els.mapCanvas.clientWidth || window.innerWidth || 390;
  const height = els.mapCanvas.clientHeight || window.innerHeight || 844;
  const currentDistance = Math.max(distanceBetweenPoints(p1, p2), 12);
  const currentMid = midpointBetweenPoints(p1, p2);

  const rawZoom = pinch.startZoom + Math.log2(currentDistance / pinch.startDistance);
  const nextZoom = clamp(
    Math.round(rawZoom),
    mapConfig.minZoom,
    mapConfig.maxZoom
  );

  const scale = 2 ** (nextZoom - pinch.startZoom);
  const anchorWorldX = pinch.startAnchorWorldX * scale;
  const anchorWorldY = pinch.startAnchorWorldY * scale;
  const topLeftWorldX = anchorWorldX - currentMid.x;
  const topLeftWorldY = anchorWorldY - currentMid.y;
  const nextCenterWorldX = topLeftWorldX + (width / 2);
  const nextCenterWorldY = topLeftWorldY + (height / 2);
  const nextLatLng = unprojectWorld(nextCenterWorldX, nextCenterWorldY, nextZoom);

  state.map.zoom = nextZoom;
  state.map.centerLat = nextLatLng.lat;
  state.map.centerLng = nextLatLng.lng;
  state.map.mode = 'manual';
  queueMapRender();
}

function distanceBetweenPoints(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt((dx * dx) + (dy * dy));
}

function midpointBetweenPoints(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function handleMapWheel(event) {
  if (!els.mapView.classList.contains('active') || state.activePanel === 'list') {
    return;
  }

  event.preventDefault();
  zoomMap(event.deltaY < 0 ? 1 : -1);
}

function unprojectWorld(x, y, zoom) {
  const scale = 256 * (2 ** zoom);
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

function startGeolocationWatch() {
  if (!('geolocation' in navigator)) {
    updateMapStatus('Din webbläsare stöder inte platsdelning.');
    return;
  }

  if (state.geolocationWatchId != null) {
    return;
  }

  updateMapStatus('Söker efter din position…');

  // Visa ett hjälpmeddelande om ingen position kommit efter 20 sekunder
  state._gpsTimeoutTimer = setTimeout(() => {
    if (!state.positionResolved && !state.positionDenied) {
      updateMapStatus('GPS tar lång tid. Gå ut utomhus eller kontrollera att platsåtkomst är tillåten.');
    }
  }, 20000);

  state.geolocationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      // Position mottagen — rensa timeout-timern
      if (state._gpsTimeoutTimer) {
        clearTimeout(state._gpsTimeoutTimer);
        state._gpsTimeoutTimer = null;
      }

      const now = Date.now();
      const nextPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };

      let movedMeters = Infinity;
      if (state.userPosition) {
        movedMeters = haversineDistanceMeters(
          state.userPosition.latitude,
          state.userPosition.longitude,
          nextPosition.latitude,
          nextPosition.longitude
        );
      }

      state.userPosition = nextPosition;
      state.positionResolved = true;
      state.positionDenied = false;

      if (state.map.mode === 'followUser' || state.map.centerLat == null || state.map.centerLng == null) {
        state.map.centerLat = state.userPosition.latitude;
        state.map.centerLng = state.userPosition.longitude;
      }

      if (state.map.mode === 'fitAll') {
        fitMapToPlacesAndUser(false);
      }

      updateMapStatus();
      renderPlaces();
      updateAssignmentSummary();

      const shouldRenderMap = state.activePanel === 'map' && (now - state.map.lastPositionTs > 1400 || movedMeters > 8);
      if (shouldRenderMap) {
        state.map.lastPositionTs = now;
        queueMapRender();
      } else {
        state.map.pendingRender = true;
      }
    },
    (error) => {
      if (state._gpsTimeoutTimer) {
        clearTimeout(state._gpsTimeoutTimer);
        state._gpsTimeoutTimer = null;
      }

      state.positionResolved = false;
      state.positionDenied = error.code === error.PERMISSION_DENIED;

      let message;
      if (error.code === error.PERMISSION_DENIED) {
        message = 'Platsåtkomst nekad. Öppna Inställningar → Safari → Plats och välj "Vid användning av appen".';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message = 'Din position kunde inte fastställas. Gå ut utomhus och försök igen.';
      } else if (error.code === error.TIMEOUT) {
        message = 'GPS svarade inte i tid. Kontrollera att platsåtkomst är tillåten och försök igen.';
      } else {
        message = 'Platsposition kunde inte hämtas. Försök starta om appen.';
      }

      updateMapStatus(message);
      renderPlaces();
      updateAssignmentSummary();
      if (state.activePanel === 'map') {
        queueMapRender();
      } else {
        state.map.pendingRender = true;
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 12000,
      timeout: 15000
    }
  );
}

function stopGeolocationWatch() {
  if (state.geolocationWatchId != null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(state.geolocationWatchId);
  }
  state.geolocationWatchId = null;

  if (state._gpsTimeoutTimer) {
    clearTimeout(state._gpsTimeoutTimer);
    state._gpsTimeoutTimer = null;
  }
}

// ─── Countdown mot activation_ends_at och personlig tidsgräns ─

function getAssignmentEndTime() {
  // Personlig tidsgräns har prioritet om den är kortare än activation_ends_at
  const personalEnd = getPersonalTimeLimitEnd();
  const globalEnd   = getGlobalEndTime();

  if (personalEnd && globalEnd) {
    return personalEnd < globalEnd ? personalEnd : globalEnd;
  }
  return personalEnd || globalEnd || null;
}

function getGlobalEndTime() {
  const raw = state.assignment?.activation_ends_at;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function getPersonalTimeLimitEnd() {
  const limitMins = state.assignment?.time_limit_minutes;
  if (!limitMins) return null;

  const startKey = `spoton.start.${state.sessionToken}`;
  let startTs = localStorage.getItem(startKey);

  if (!startTs) {
    // Första gången — spara starttiden
    startTs = Date.now().toString();
    localStorage.setItem(startKey, startTs);
  }

  const endMs = parseInt(startTs, 10) + limitMins * 60 * 1000;
  return new Date(endMs);
}

function getCountdownLabel() {
  const personalEnd = getPersonalTimeLimitEnd();
  const globalEnd   = getGlobalEndTime();

  if (personalEnd && globalEnd) {
    return personalEnd < globalEnd ? 'Tid kvar' : 'Uppdraget stänger om';
  }
  if (personalEnd) return 'Tid kvar';
  return 'Uppdraget stänger om';
}

function formatCountdown(ms) {
  if (ms <= 0) return 'Tiden har gått ut';
  const label = getCountdownLabel();
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) {
    return `${label} ${h} tim ${m} min`;
  }
  if (m > 5) {
    return `${label} ${m} min`;
  }
  if (m > 0) {
    return `${label} ${m} min ${s} s`;
  }
  return `${label} ${s} s`;
}

function updateCountdownDisplay() {
  const endTime = getAssignmentEndTime();
  if (!endTime) {
    const el = document.getElementById('digitalCountdown');
    if (el) el.classList.add('hidden');
    const mapEl = document.getElementById('mapCountdown');
    if (mapEl) mapEl.className = 'map-countdown hidden';
    return;
  }

  const remaining = endTime - Date.now();
  const text = formatCountdown(remaining);

  // Uppdatera i digital vy
  const digitalEl = document.getElementById('digitalCountdown');
  if (digitalEl) {
    digitalEl.textContent = text;
    digitalEl.classList.remove('hidden');
    digitalEl.className = 'digital-countdown' +
      (remaining <= 0 ? ' digital-countdown--expired' :
       remaining <= 5 * 60 * 1000 ? ' digital-countdown--urgent' : '');
  }

  // Uppdatera i kartvyn — eget element som inte skrivs över av updateMapStatus
  if (!isDigitalAssignment()) {
    const mapEl = document.getElementById('mapCountdown');
    if (mapEl) {
      if (remaining <= 0) {
        mapEl.textContent = 'Tiden har gått ut';
        mapEl.className = 'map-countdown map-countdown--expired';
      } else {
        mapEl.textContent = text;
        mapEl.className = 'map-countdown' +
          (remaining <= 5 * 60 * 1000 ? ' map-countdown--urgent' : '');
      }
    }
  }

  // Om uppdraget stängt — visa varning
  if (remaining <= 0 && state.sessionToken && !state._endTimeWarningShown) {
    state._endTimeWarningShown = true;
    showStatus('Uppdragets tid har gått ut. Du kan inte längre registrera framsteg.', true);
  }
}

function startCountdownTimer() {
  stopCountdownTimer();
  const endTime = getAssignmentEndTime();
  if (!endTime) return; // Inget slutdatum — ingen timer

  updateCountdownDisplay(); // Visa direkt

  state._countdownInterval = setInterval(() => {
    updateCountdownDisplay();
  }, 10000); // Uppdatera var 10:e sekund
}

function stopCountdownTimer() {
  if (state._countdownInterval) {
    clearInterval(state._countdownInterval);
    state._countdownInterval = null;
  }
}

function centerMapOnUser() {
  if (!state.userPosition) {
    updateMapStatus('Ingen aktuell position finns ännu.');
    return;
  }

  state.map.centerLat = state.userPosition.latitude;
  state.map.centerLng = state.userPosition.longitude;
  state.map.mode = 'followUser';
  if (!Number.isFinite(state.map.zoom)) {
    state.map.zoom = mapConfig.defaultZoom;
  }
  queueMapRender();
}

function fitMapToPlacesAndUser(renderAfter = true) {
  const points = getMapPoints();

  if (!points.length) {
    state.map.centerLat = 59.326;
    state.map.centerLng = 14.523;
    state.map.zoom = mapConfig.defaultZoom;
    if (renderAfter) {
      queueMapRender();
    }
    return;
  }

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  state.map.centerLat = (minLat + maxLat) / 2;
  state.map.centerLng = (minLng + maxLng) / 2;
  state.map.zoom = calculateFitZoom(minLat, maxLat, minLng, maxLng, els.mapCanvas.clientWidth || 700, els.mapCanvas.clientHeight || 420);
  state.map.mode = 'fitAll';
  if (state.userPosition) {
    state.map.hasFitAfterPosition = true;
  }

  if (renderAfter) {
    queueMapRender();
  }
}

function getMapPoints() {
  const points = [];

  for (const place of getPlaces()) {
    if (hasCoordinates(place)) {
      points.push({ lat: Number(place.latitude), lng: Number(place.longitude) });
    }
  }

  if (state.userPosition) {
    points.push({ lat: state.userPosition.latitude, lng: state.userPosition.longitude });
  }

  return points;
}

function calculateFitZoom(minLat, maxLat, minLng, maxLng, mapWidth, mapHeight) {
  if (minLat === maxLat && minLng === maxLng) {
    return Math.min(Math.max(mapConfig.defaultZoom, mapConfig.minZoom), mapConfig.maxZoom);
  }

  const latFraction = Math.max((mercatorY(maxLat) - mercatorY(minLat)) / Math.PI, 0.000001);
  const lngDiff = maxLng - minLng;
  const lngFraction = Math.max(((lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360), 0.000001);

  const latZoom = Math.log2((mapHeight * 0.8) / 256 / latFraction);
  const lngZoom = Math.log2((mapWidth * 0.8) / 256 / lngFraction);
  const zoom = Math.floor(Math.min(latZoom, lngZoom, mapConfig.maxZoom));

  return clamp(zoom, mapConfig.minZoom, mapConfig.maxZoom);
}

function mercatorY(lat) {
  const sin = Math.sin((lat * Math.PI) / 180);
  return Math.log((1 + sin) / (1 - sin)) / 2;
}

function zoomMap(step) {
  state.map.zoom = clamp((state.map.zoom || mapConfig.defaultZoom) + step, mapConfig.minZoom, mapConfig.maxZoom);
  state.map.mode = 'manual';
  queueMapRender();
}

function queueMapRender() {
  if (state.activePanel !== 'map') {
    state.map.pendingRender = true;
    return;
  }

  if (state.map.renderQueued) {
    return;
  }

  state.map.renderQueued = true;
  window.requestAnimationFrame(() => {
    state.map.renderQueued = false;
    renderMap();
  });
}

function ensureMapDom() {
  if (!state.map.layerEl) {
    state.map.layerEl = document.createElement('div');
    state.map.layerEl.className = 'map-layer';
    els.mapCanvas.appendChild(state.map.layerEl);
  }

  if (!state.map.overlayEl) {
    state.map.overlayEl = document.createElement('div');
    state.map.overlayEl.className = 'map-overlay';
    els.mapCanvas.appendChild(state.map.overlayEl);
  }
}

function renderMap() {
  if (!els.mapCanvas) {
    return;
  }

  const width = els.mapCanvas.clientWidth;
  const height = els.mapCanvas.clientHeight;

  if (!width || !height) {
    return;
  }

  if (state.map.centerLat == null || state.map.centerLng == null) {
    fitMapToPlacesAndUser(false);
  }

  ensureMapDom();

  const centerLat = state.map.centerLat ?? 59.326;
  const centerLng = state.map.centerLng ?? 14.523;
  const zoom = clamp(state.map.zoom || mapConfig.defaultZoom, mapConfig.minZoom, mapConfig.maxZoom);

  const centerWorld = projectLatLng(centerLat, centerLng, zoom);
  const topLeftWorldX = centerWorld.x - (width / 2);
  const topLeftWorldY = centerWorld.y - (height / 2);
  const bottomRightWorldX = centerWorld.x + (width / 2);
  const bottomRightWorldY = centerWorld.y + (height / 2);

  const minTileX = Math.floor(topLeftWorldX / 256);
  const maxTileX = Math.floor(bottomRightWorldX / 256);
  const minTileY = Math.floor(topLeftWorldY / 256);
  const maxTileY = Math.floor(bottomRightWorldY / 256);
  const maxTileIndex = (2 ** zoom) - 1;
  const desiredTileKeys = new Set();

  for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      if (tileY < 0 || tileY > maxTileIndex) {
        continue;
      }

      const wrappedTileX = modulo(tileX, 2 ** zoom);
      const key = `${zoom}:${wrappedTileX}:${tileY}:${tileX}`;
      desiredTileKeys.add(key);

      let tile = state.map.tileEls.get(key);
      if (!tile) {
        tile = document.createElement('img');
        tile.className = 'map-tile';
        tile.alt = '';
        tile.decoding = 'async';
        tile.loading = 'eager';
        tile.src = mapConfig.tileUrlTemplate
          .replace('{z}', String(zoom))
          .replace('{x}', String(wrappedTileX))
          .replace('{y}', String(tileY));
        state.map.tileEls.set(key, tile);
        state.map.layerEl.appendChild(tile);
      }

      tile.style.left = `${(tileX * 256) - topLeftWorldX}px`;
      tile.style.top = `${(tileY * 256) - topLeftWorldY}px`;
    }
  }

  for (const [key, tile] of state.map.tileEls.entries()) {
    if (!desiredTileKeys.has(key)) {
      tile.remove();
      state.map.tileEls.delete(key);
    }
  }

  state.map.overlayEl.replaceChildren();

  const places = getPlaces();
  const nearest = getNearestPlace();

  for (const place of places) {
    if (!hasCoordinates(place)) {
      continue;
    }

    const world = projectLatLng(Number(place.latitude), Number(place.longitude), zoom);
    const x = world.x - topLeftWorldX;
    const y = world.y - topLeftWorldY;

    if (x < -48 || x > width + 48 || y < -48 || y > height + 48) {
      continue;
    }

    const availability = getPlaceAvailability(place);
    const distance = availability.distance;
    const unlocked = availability.unlocked;

    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'map-marker';
    marker.title = place.title || place.name || 'Plats';
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;

    if (hasVisitedPlace(place.id)) {
      marker.classList.add('visited');
    }
    if (!unlocked || availability.pendingPosition) {
      marker.classList.add('locked');
    }
    if (state.activePlaceId && String(state.activePlaceId) === String(place.id)) {
      marker.classList.add('active');
    }
    if (distance != null && distance <= availability.unlockDistance) {
      marker.classList.add('near');
    }

    marker.addEventListener('click', () => openPlace(place.id));

    const label = document.createElement('div');
    label.className = 'map-label';
    if (!unlocked || availability.pendingPosition) {
      label.classList.add('locked');
    }
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    label.innerHTML = `${escapeHtml(place.title || place.name || 'Plats')}${availability.pendingPosition ? '<span class="distance">Väntar</span>' : distance != null ? `<span class="distance">${formatDistance(distance)}</span>` : '<span class="distance">Låst</span>'}`;

    state.map.overlayEl.appendChild(marker);
    state.map.overlayEl.appendChild(label);
  }

  if (state.userPosition) {
    const userWorld = projectLatLng(state.userPosition.latitude, state.userPosition.longitude, zoom);
    const x = userWorld.x - topLeftWorldX;
    const y = userWorld.y - topLeftWorldY;

    const userMarker = document.createElement('div');
    userMarker.className = 'map-marker user';
    userMarker.style.left = `${x}px`;
    userMarker.style.top = `${y}px`;
    state.map.overlayEl.appendChild(userMarker);
  }

  state.map.tilesReady = true;

  let empty = els.mapCanvas.querySelector('.map-loading');
  if (!places.some(hasCoordinates) && !state.userPosition) {
    if (!empty) {
      empty = document.createElement('div');
      empty.className = 'map-loading';
      els.mapCanvas.appendChild(empty);
    }
    empty.textContent = 'Inga koordinater finns att visa på kartan.';
  } else if (empty) {
    empty.remove();
  }

  updateMapStatus(undefined, nearest);
}

function getNearestPlace() {
  if (!state.userPosition || !state.positionResolved) {
    return null;
  }

  let best = null;

  for (const place of getPlaces()) {
    if (!hasCoordinates(place)) {
      continue;
    }

    const distance = getPlaceDistanceMeters(place);

    if (distance == null) {
      continue;
    }

    if (!best || distance < best.distance) {
      best = { place, distance, unlocked: isPlaceUnlocked(place) };
    }
  }

  return best;
}

function updateMapStatus(overrideMessage, nearestOverride) {
  const nearest = nearestOverride === undefined ? getNearestPlace() : nearestOverride;
  const accuracy = Number(state.userPosition?.accuracy);
  const hasPosition = state.userPosition && state.positionResolved;
  const accuracyText = Number.isFinite(accuracy) ? `GPS ${Math.round(accuracy)} m` : 'Position hittad';
  const mysteryMode = isMysteryAssignment();

  // Tillfälligt överskridande-meddelande (t.ex. vid fel eller statusuppdatering)
  if (overrideMessage) {
    els.mapStatusText.textContent = overrideMessage;
    els.mapDistanceHint.textContent = hasPosition ? accuracyText : '';
    return;
  }

  // Ingen position ännu
  if (!hasPosition) {
    els.mapStatusText.textContent = 'Tillåt platsåtkomst för att se din position på kartan.';
    els.mapDistanceHint.textContent = nearest
      ? `Närmast: ${nearest.place.title || nearest.place.name} • ${formatDistance(nearest.distance)}`
      : '';
    return;
  }

  // Position finns — visa närmaste plats som primär info
  if (nearest) {
    const availability = getPlaceAvailability(nearest.place);
    const threshold = availability.unlockDistance;
    const lockText = availability.sequenceBlocked
      ? `låst tills föregående är besökt`
      : availability.unlocked
        ? 'upplåst'
        : `låst tills ${formatDistance(threshold)}`;

    els.mapStatusText.textContent = `${nearest.place.title || nearest.place.name} • ${formatDistance(nearest.distance)}`;
    els.mapDistanceHint.textContent = `${lockText} · ${accuracyText}`;
  } else {
    // Ingen plats i uppdraget eller position utan uppdrag
    els.mapStatusText.textContent = Number.isFinite(accuracy) ? accuracyText : 'Position hittad.';
    els.mapDistanceHint.textContent = '';
  }
}

function projectLatLng(lat, lng, zoom) {
  const scale = 256 * (2 ** zoom);
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const x = ((lng + 180) / 360) * scale;
  const y = (0.5 - (Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI))) * scale;
  return { x, y };
}

function modulo(value, size) {
  return ((value % size) + size) % size;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) {
    return '';
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1).replace('.', ',')} km`;
}