/**
 * På plats — app.js  v2
 * Placeras i: webapp/pwa/app.js
 *
 * Nytt i v2:
 *   - Grupp-funktionalitet för trail-uppdrag
 *     POST /api/v1/events/create  — skapa grupp
 *     POST /api/v1/events/join    — gå med i grupp
 *     GET  /api/v1/events/:id/leaderboard — hämta topplista
 *   - Topplista-panel i kartvy (bottom sheet-overlay)
 *   - Dela gruppkod via Web Share API / clipboard
 *   - Slutresultat-topplista på avslutningsskärmen
 *   - Grupp-badge på kartan
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  //  KONFIGURATION
  // ═══════════════════════════════════════════════════════════
  const CFG           = window.PAPLATS_CONFIG || {};
  const apiBaseUrl    = CFG.apiBaseUrl    || '/api/v1';
  const mediaBaseUrl  = CFG.mediaBaseUrl  || '';
  const MAP_CFG       = CFG.map           || {};
  const GEO_CFG       = CFG.geo           || {};
  const STORAGE_KEYS  = CFG.storage       || {};

  const NEAR_M       = MAP_CFG.nearDistanceMeters  || 120;
  const CLOSE_M      = MAP_CFG.closeDistanceMeters || 40;
  const DEFAULT_ZOOM = MAP_CFG.defaultZoom || 15;
  const TILE_URL     = MAP_CFG.tileUrlTemplate || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  const SK = {
    session:    STORAGE_KEYS.sessionKey    || 'paplats_session',
    assignment: STORAGE_KEYS.assignmentKey || 'paplats_assignment',
    group:      'paplats_group',
  };


  // ═══════════════════════════════════════════════════════════
  //  CENTRALT TILLSTÅND
  // ═══════════════════════════════════════════════════════════
  const state = {
    // Uppdrag & session
    assignment:       null,
    assignmentCode:   null,
    sessionToken:     null,
    nickname:         '',

    // Grupp
    activeGroup:      null, // { event_id, invite_code, group_name }

    // Geo
    userLat:          null,
    userLng:          null,
    userAccuracy:     null,
    geoWatchId:       null,
    geoActive:        false,
    geoDenied:        false,

    // Progress
    progressByPlaceId: {},
    progressByBlockId: {},
    viewedClues:       {},
    notes:             { suspects: [], evidence: [], free: '' },

    // Karta
    mapInitialized:    false,
    mapLon:            15.0,
    mapLat:            62.0,
    mapZoom:           DEFAULT_ZOOM,
    mapTiles:          {},
    mapRenderQueued:   false,

    // UI
    currentView:       'code',
    activePanel:       'map',
    selectedPlace:     null,

    // Övrigt
    countdownInterval:     null,
    allVisitedNotified:    false,
    leaderboardInterval:   null,
  };


  // ═══════════════════════════════════════════════════════════
  //  DOM-ELEMENT
  // ═══════════════════════════════════════════════════════════
  function cacheEls() {
    return {
      viewCode:       q('#viewCode'),
      viewIntro:      q('#viewIntro'),
      viewMap:        q('#viewMap'),
      viewNotes:      q('#viewNotes'),
      viewCompletion: q('#viewCompletion'),

      // Kod
      codeInput:      q('#codeInput'),
      loadBtn:        q('#loadAssignmentBtn'),
      codeStatus:     q('#codeStatus'),
      resumeCard:     q('#resumeCard'),
      resumeTitle:    q('#resumeTitle'),
      resumeBtn:      q('#resumeBtn'),
      resumeClearBtn: q('#resumeClearBtn'),
      installBtn:     q('#installBtn'),

      // Intro
      introBackBtn:        q('#introBackBtn'),
      introType:           q('#introAssignmentType'),
      introTitle:          q('#introTitle'),
      introSubtitle:       q('#introSubtitle'),
      introDescription:    q('#introDescription'),
      introPlaceCountText: q('#introPlaceCountText'),
      introTimelimit:      q('#introTimelimit'),
      introTimelimitText:  q('#introTimelimitText'),
      nicknameInput:       q('#nicknameInput'),
      startBtn:            q('#startAssignmentBtn'),

      // Grupp-sektionen i intro
      groupSection:     q('#groupSection'),
      createGroupBtn:   q('#createGroupBtn'),
      groupCreated:     q('#groupCreated'),
      groupInviteCode:  q('#groupInviteCode'),
      shareGroupCodeBtn: q('#shareGroupCodeBtn'),
      joinGroupInput:   q('#joinGroupInput'),
      joinGroupBtn:     q('#joinGroupBtn'),
      groupStatus:      q('#groupStatus'),

      // Karta
      mapCanvas:           q('#mapCanvas'),
      mapGpsStatus:        q('#mapGpsStatus'),
      mapGpsText:          q('#mapGpsText'),
      mapIntroCard:        q('#mapIntroCard'),
      mapIntroCardTitle:   q('#mapIntroCardTitle'),
      mapIntroCardBody:    q('#mapIntroCardBody'),
      mapIntroCloseBtn:    q('#mapIntroCloseBtn'),
      mapAssignmentTitle:  q('#mapAssignmentTitle'),
      mapTimerBadge:       q('#mapTimerBadge'),
      mapLocateBtn:        q('#mapLocateBtn'),
      mapZoomInBtn:        q('#mapZoomInBtn'),
      mapZoomOutBtn:       q('#mapZoomOutBtn'),
      mapGroupBadge:       q('#mapGroupBadge'),
      mapGroupName:        q('#mapGroupName'),

      // Sheets
      listSheet:           q('#listSheet'),
      detailSheet:         q('#detailSheet'),
      placesList:          q('#placesList'),
      listSheetTitle:      q('#listSheetTitle'),
      listSheetSubtitle:   q('#listSheetSubtitle'),
      listSheetBackBtn:    q('#listSheetBackBtn'),
      listNotesBtn:        q('#listNotesBtn'),
      detailSheetTitle:    q('#detailSheetTitle'),
      detailSheetBody:     q('#detailSheetBody'),
      detailSheetBackBtn:  q('#detailSheetBackBtn'),

      // Topplista
      leaderboardOverlay:   q('#leaderboardOverlay'),
      leaderboardTitle:     q('#leaderboardTitle'),
      leaderboardInviteCode: q('#leaderboardInviteCode'),
      leaderboardBody:      q('#leaderboardBody'),
      leaderboardCloseBtn:  q('#leaderboardCloseBtn'),
      leaderboardRefreshBtn: q('#leaderboardRefreshBtn'),

      // Nav
      navMap:          q('#navMap'),
      navList:         q('#navList'),
      navLeaderboard:  q('#navLeaderboard'),
      navNotes:        q('#navNotes'),
      navLeave:        q('#navLeave'),
      navListBadge:    q('#navListBadge'),

      // Anteckningar
      notesBackBtn:   q('#notesBackBtn'),
      notesTabs:      q('#notesTabs'),
      tabSuspects:    q('#tabSuspects'),
      tabEvidence:    q('#tabEvidence'),
      tabFree:        q('#tabFree'),
      suspectsList:   q('#suspectsList'),
      evidenceList:   q('#evidenceList'),
      notesTextarea:  q('#notesTextarea'),
      saveNotesBtn:   q('#saveNotesBtn'),

      // Avslutning
      completionSummary:         q('#completionSummary'),
      completionDoneBtn:         q('#completionDoneBtn'),
      completionLeaderboard:     q('#completionLeaderboard'),
      completionLeaderboardBody: q('#completionLeaderboardBody'),

      // Dela-modal
      shareGroupModal:    q('#shareGroupModal'),
      shareGroupCloseBtn: q('#shareGroupCloseBtn'),
      shareGroupCode:     q('#shareGroupCode'),
      copyGroupCodeBtn:   q('#copyGroupCodeBtn'),
      shareGroupNativeBtn: q('#shareGroupNativeBtn'),

      // Lightbox
      lightbox:        q('#lightbox'),
      lightboxImg:     q('#lightboxImg'),
      lightboxCloseBtn: q('#lightboxCloseBtn'),

      // Modaler
      leaveConfirmModal:     q('#leaveConfirmModal'),
      leaveConfirmCancelBtn: q('#leaveConfirmCancelBtn'),
      leaveConfirmOkBtn:     q('#leaveConfirmOkBtn'),
      leaveConfirmText:      q('#leaveConfirmText'),
      clueModal:             q('#clueModal'),
      clueModalCloseBtn:     q('#clueModalCloseBtn'),
      clueModalText:         q('#clueModalText'),
      iosInstallModal:       q('#iosInstallModal'),
      iosInstallCloseBtn:    q('#iosInstallCloseBtn'),
      iosInstallDoneBtn:     q('#iosInstallDoneBtn'),

      // Toast
      toast: q('#toast'),
    };
  }

  let els = {};
  function q(sel) { return document.querySelector(sel); }


  // ═══════════════════════════════════════════════════════════
  //  STORAGE
  // ═══════════════════════════════════════════════════════════
  const storage = {
    get(key)      { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
    remove(key)   { try { localStorage.removeItem(key); } catch {} },
  };

  function saveSession(token, nickname) {
    storage.set(SK.session, { token, nickname, savedAt: Date.now() });
  }

  function loadStoredSession() { return storage.get(SK.session); }

  function saveAssignment(assignment, code) {
    storage.set(SK.assignment, { assignment, code, savedAt: Date.now() });
  }

  function loadStoredAssignment() {
    const d = storage.get(SK.assignment);
    if (!d) return null;
    if (Date.now() - (d.savedAt || 0) > 86400000) return null;
    return d;
  }

  function saveGroup(group) {
    if (group) storage.set(SK.group, { ...group, savedAt: Date.now() });
    else storage.remove(SK.group);
  }

  function loadStoredGroup() {
    const d = storage.get(SK.group);
    if (!d) return null;
    // Grupper lever 24h (TTL_HOURS i backend)
    if (Date.now() - (d.savedAt || 0) > 86400000) return null;
    return d;
  }

  function clearSession() {
    storage.remove(SK.session);
    storage.remove(SK.assignment);
    storage.remove(SK.group);
  }


  // ═══════════════════════════════════════════════════════════
  //  API
  // ═══════════════════════════════════════════════════════════
  async function apiFetch(path, options = {}) {
    const res = await fetch(apiBaseUrl + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    let body;
    try { body = await res.json(); } catch { body = {}; }
    if (!res.ok) throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
    return body;
  }

  async function fetchAssignment(code) {
    const d = await apiFetch(`/assignments/${encodeURIComponent(code)}`);
    return d?.data || d;
  }

  async function createSession(assignmentId, code, nickname) {
    const body = { access_code: code, assignment_id: assignmentId };
    if (nickname) body.nickname = nickname;
    const d = await apiFetch('/sessions', { method: 'POST', body: JSON.stringify(body) });
    const p = d?.data || d;
    return p?.session_token || p?.token || p?.session?.session_token || p?.session?.token;
  }

  async function fetchSessionProgress(token) {
    const d = await apiFetch(`/sessions/${encodeURIComponent(token)}`);
    return d?.data || d;
  }

  async function postProgress(token, payload) {
    await apiFetch(`/sessions/${encodeURIComponent(token)}/progress`, {
      method: 'POST', body: JSON.stringify(payload),
    });
  }

  async function putNotes(token, notes) {
    await apiFetch(`/sessions/${encodeURIComponent(token)}/notes`, {
      method: 'PUT', body: JSON.stringify({ notes }),
    });
  }

  async function postComplete(token) {
    await apiFetch(`/sessions/${encodeURIComponent(token)}/complete`, { method: 'POST' });
  }

  // ── Grupp-API ────────────────────────────────────────────
  async function apiCreateGroup(assignmentId, sessionToken, groupName, displayName) {
    return apiFetch('/events/create', {
      method: 'POST',
      body: JSON.stringify({
        assignment_id: assignmentId,
        session_token: sessionToken,
        group_name:    groupName,
        display_name:  displayName || null,
      }),
    });
  }

  async function apiJoinGroup(inviteCode, sessionToken, displayName) {
    return apiFetch('/events/join', {
      method: 'POST',
      body: JSON.stringify({
        invite_code:   inviteCode,
        session_token: sessionToken,
        display_name:  displayName || null,
      }),
    });
  }

  async function apiFetchLeaderboard(eventId, sessionToken) {
    return apiFetch(
      `/events/${eventId}/leaderboard?session_token=${encodeURIComponent(sessionToken)}`
    );
  }

  function resolveMediaUrl(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return mediaBaseUrl + (path.startsWith('/') ? path : '/' + path);
  }


  // ═══════════════════════════════════════════════════════════
  //  GEOLOKALISERING
  // ═══════════════════════════════════════════════════════════
  function startGeo() {
    if (!navigator.geolocation) { updateGpsStatus('denied', 'GPS saknas'); return; }
    updateGpsStatus('searching', 'Söker position…');
    state.geoWatchId = navigator.geolocation.watchPosition(
      onGeoSuccess, onGeoError,
      { enableHighAccuracy: GEO_CFG.highAccuracy !== false, timeout: 12000, maximumAge: 5000 }
    );
  }

  function stopGeo() {
    if (state.geoWatchId != null) {
      navigator.geolocation.clearWatch(state.geoWatchId);
      state.geoWatchId = null;
    }
  }

  function onGeoSuccess(pos) {
    const { latitude, longitude, accuracy } = pos.coords;
    const firstFix = state.userLat == null;
    state.userLat = latitude; state.userLng = longitude; state.userAccuracy = accuracy;
    state.geoActive = true; state.geoDenied = false;
    updateGpsStatus('active', `±${Math.round(accuracy)} m`);
    scheduleGpsFadeOut();
    if (firstFix) map.centerOn(latitude, longitude);
    places.updateDistances();
    queueMapRender();
  }

  function onGeoError(err) {
    state.geoDenied = err.code === 1;
    updateGpsStatus('denied', state.geoDenied ? 'Plats nekad' : 'Plats ej tillgänglig');
  }

  function updateGpsStatus(type, text) {
    if (!els.mapGpsStatus) return;
    els.mapGpsStatus.className = `map-gps-status map-gps-${type}`;
    if (els.mapGpsText) els.mapGpsText.textContent = text;
  }

  let gpsFadeTimer = null;
  function scheduleGpsFadeOut() {
    clearTimeout(gpsFadeTimer);
    els.mapGpsStatus?.classList.remove('fade-out');
    gpsFadeTimer = setTimeout(() => els.mapGpsStatus?.classList.add('fade-out'), 3000);
  }

  function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }


  // ═══════════════════════════════════════════════════════════
  //  KARTA
  // ═══════════════════════════════════════════════════════════
  const map = (() => {
    function latLngToTile(lat, lng, z) {
      const n = Math.pow(2, z);
      const x = Math.floor((lng + 180) / 360 * n);
      const latRad = lat * Math.PI / 180;
      const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1/Math.cos(latRad)) / Math.PI) / 2 * n);
      return { x, y, z };
    }

    function tileToLatLng(tx, ty, z) {
      const n = Math.pow(2, z);
      const lng = tx / n * 360 - 180;
      const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * ty / n))) * 180 / Math.PI;
      return { lat, lng };
    }

    function latLngToPixel(lat, lng, cLat, cLng, zoom, w, h) {
      const TILE = 256;
      const scale = TILE * Math.pow(2, zoom);
      function project(la, lo) {
        const x = (lo + 180) / 360 * scale;
        const latR = la * Math.PI / 180;
        const y = (1 - Math.log(Math.tan(latR) + 1/Math.cos(latR)) / Math.PI) / 2 * scale;
        return { x, y };
      }
      const center = project(cLat, cLng);
      const point  = project(lat, lng);
      return { px: (point.x - center.x) + w/2, py: (point.y - center.y) + h/2 };
    }

    function getTile(x, y, z) {
      const key = `${z}/${x}/${y}`;
      if (state.mapTiles[key]) return state.mapTiles[key];
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
      const entry = { img, loaded: false };
      img.onload = () => {
        entry.loaded = true; queueMapRender();
        const keys = Object.keys(state.mapTiles);
        if (keys.length > 300) keys.slice(0, 50).forEach(k => delete state.mapTiles[k]);
      };
      return (state.mapTiles[key] = entry);
    }

    function metersToPixels(meters, lat, zoom) {
      const latRad = lat * Math.PI / 180;
      const mpp = (40075016.686 * Math.cos(latRad)) / (256 * Math.pow(2, zoom));
      return meters / mpp;
    }

    function render() {
      state.mapRenderQueued = false;
      const canvas = els.mapCanvas;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w*dpr || canvas.height !== h*dpr) {
        canvas.width = w*dpr; canvas.height = h*dpr;
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#1a2b3c';
      ctx.fillRect(0, 0, w, h);

      const zoom = Math.floor(state.mapZoom);
      const TILE = 256;
      const cLat = state.mapLat, cLng = state.mapLon;
      const originTile = latLngToTile(cLat, cLng, zoom);
      const originLatLng = tileToLatLng(originTile.x, originTile.y, zoom);
      const { px: originPx, py: originPy } = latLngToPixel(originLatLng.lat, originLatLng.lng, cLat, cLng, state.mapZoom, w, h);
      const tilesX = Math.ceil(w / TILE) + 2, tilesY = Math.ceil(h / TILE) + 2;
      const maxTile = Math.pow(2, zoom) - 1;

      for (let dx = -1; dx <= tilesX; dx++) {
        for (let dy = -1; dy <= tilesY; dy++) {
          const tx = originTile.x + dx, ty = originTile.y + dy;
          if (tx < 0 || ty < 0 || tx > maxTile || ty > maxTile) continue;
          const entry = getTile(tx, ty, zoom);
          const drawX = Math.floor(originPx + dx * TILE);
          const drawY = Math.floor(originPy + dy * TILE);
          if (entry.loaded) ctx.drawImage(entry.img, drawX, drawY, TILE, TILE);
          else { ctx.fillStyle = '#1e3040'; ctx.fillRect(drawX, drawY, TILE, TILE); }
        }
      }

      // Platser
      places.getAll().forEach(place => {
        if (!place.latitude || !place.longitude) return;
        const { px, py } = latLngToPixel(place.latitude, place.longitude, cLat, cLng, state.mapZoom, w, h);
        if (px < -30 || px > w+30 || py < -30 || py > h+30) return;
        const dist = place._distance;
        const isClose   = dist != null && dist <= CLOSE_M;
        const isNear    = dist != null && dist <= NEAR_M;
        const isVisited = placeVisited(place.id);
        const isSelected = state.selectedPlace?.id === place.id;

        if (dist != null && isNear && !isVisited) {
          const rPx = metersToPixels(place.activation_radius_meters || CLOSE_M, place.latitude, state.mapZoom);
          ctx.beginPath(); ctx.arc(px, py, rPx, 0, Math.PI*2);
          ctx.fillStyle = isClose ? 'rgba(34,197,94,.12)' : 'rgba(249,115,22,.10)'; ctx.fill();
          ctx.strokeStyle = isClose ? 'rgba(34,197,94,.4)' : 'rgba(249,115,22,.35)';
          ctx.lineWidth = 1.5; ctx.stroke();
        }

        const r = isSelected ? 14 : 11;
        const fill = isVisited ? '#22c55e' : isClose ? '#22c55e' : isNear ? '#fbbf24' : '#f97316';
        ctx.shadowColor = fill; ctx.shadowBlur = isSelected ? 14 : 8;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2);
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = isSelected ? 3 : 2; ctx.stroke();
        ctx.shadowBlur = 0;

        if (place.stop_order != null) {
          ctx.fillStyle = '#fff';
          ctx.font = `bold ${r-2}px -apple-system,sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(place.stop_order), px, py);
        }
      });

      // Användarpunkt
      if (state.userLat != null) {
        const { px, py } = latLngToPixel(state.userLat, state.userLng, cLat, cLng, state.mapZoom, w, h);
        if (state.userAccuracy) {
          const accR = metersToPixels(state.userAccuracy, state.userLat, state.mapZoom);
          ctx.beginPath(); ctx.arc(px, py, accR, 0, Math.PI*2);
          ctx.fillStyle = 'rgba(59,130,246,.12)'; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI*2);
        ctx.fillStyle = '#3b82f6'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(59,130,246,.35)'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function initInteraction() {
      const canvas = els.mapCanvas;
      if (!canvas) return;
      let isDragging = false, lastX = 0, lastY = 0;
      let pinchStartDist = null, pinchStartZoom = null;
      let tapStartX = 0, tapStartY = 0;

      function getTouchDist(e) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        return Math.sqrt(dx*dx + dy*dy);
      }

      canvas.addEventListener('mousedown', e => {
        isDragging = true; lastX = e.clientX; lastY = e.clientY;
        tapStartX = e.clientX; tapStartY = e.clientY;
      });
      canvas.addEventListener('mousemove', e => {
        if (!isDragging) return;
        panMap(e.clientX - lastX, e.clientY - lastY);
        lastX = e.clientX; lastY = e.clientY;
      });
      canvas.addEventListener('mouseup', e => {
        isDragging = false;
        if (Math.abs(e.clientX - tapStartX) < 5 && Math.abs(e.clientY - tapStartY) < 5)
          handleMapTap(e.clientX, e.clientY);
      });

      canvas.addEventListener('touchstart', e => {
        if (e.touches.length === 2) { pinchStartDist = getTouchDist(e); pinchStartZoom = state.mapZoom; return; }
        isDragging = true;
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
        tapStartX = lastX; tapStartY = lastY;
      }, { passive: true });

      canvas.addEventListener('touchmove', e => {
        if (e.touches.length === 2 && pinchStartDist) {
          const dist = getTouchDist(e);
          state.mapZoom = Math.max(3, Math.min(18, pinchStartZoom + Math.log2(dist / pinchStartDist)));
          queueMapRender(); return;
        }
        if (!isDragging) return;
        panMap(e.touches[0].clientX - lastX, e.touches[0].clientY - lastY);
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      }, { passive: true });

      canvas.addEventListener('touchend', e => {
        isDragging = false; pinchStartDist = null;
        if (e.changedTouches.length === 1) {
          const t = e.changedTouches[0];
          if (Math.abs(t.clientX - tapStartX) < 10 && Math.abs(t.clientY - tapStartY) < 10)
            handleMapTap(t.clientX, t.clientY);
        }
      }, { passive: true });

      canvas.addEventListener('wheel', e => {
        e.preventDefault();
        state.mapZoom = Math.max(3, Math.min(18, state.mapZoom + (e.deltaY < 0 ? 0.5 : -0.5)));
        queueMapRender();
      }, { passive: false });
    }

    function panMap(dx, dy) {
      const scale = 256 * Math.pow(2, state.mapZoom);
      const latRad = state.mapLat * Math.PI / 180;
      state.mapLon -= dx / scale * 360;
      const y = Math.log(Math.tan(latRad) + 1/Math.cos(latRad)) / Math.PI;
      state.mapLat = Math.atan(Math.sinh((y + dy * 2 / scale) * Math.PI)) * 180 / Math.PI;
      state.mapLat = Math.max(-85, Math.min(85, state.mapLat));
      queueMapRender();
    }

    function handleMapTap(clientX, clientY) {
      const canvas = els.mapCanvas;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left, y = clientY - rect.top;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      let bestDist = 999, bestPlace = null;
      places.getAll().forEach(place => {
        if (!place.latitude || !place.longitude) return;
        const { px, py } = latLngToPixel(place.latitude, place.longitude, state.mapLat, state.mapLon, state.mapZoom, w, h);
        const d = Math.sqrt((px-x)**2 + (py-y)**2);
        if (d < 28 && d < bestDist) { bestDist = d; bestPlace = place; }
      });
      if (bestPlace) ui.openDetail(bestPlace);
    }

    function centerOn(lat, lng) {
      state.mapLat = lat; state.mapLon = lng; queueMapRender();
    }

    function resizeCanvas() {
      const canvas = els.mapCanvas;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.style.width  = parent.offsetWidth  + 'px';
      canvas.style.height = parent.offsetHeight + 'px';
      queueMapRender();
    }

    function init() {
      if (state.mapInitialized) return;
      state.mapInitialized = true;
      initInteraction();
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
    }

    return { init, render, centerOn, latLngToPixel };
  })();

  function queueMapRender() {
    if (state.mapRenderQueued) return;
    state.mapRenderQueued = true;
    requestAnimationFrame(() => map.render());
  }


  // ═══════════════════════════════════════════════════════════
  //  PLATSER
  // ═══════════════════════════════════════════════════════════
  const places = {
    getAll() { return state.assignment?.places || []; },

    updateDistances() {
      if (state.userLat == null) return;
      this.getAll().forEach(p => {
        if (p.latitude && p.longitude)
          p._distance = haversineDistance(state.userLat, state.userLng, p.latitude, p.longitude);
      });
      this.renderList();
      updateNavBadge();
    },

    renderList() {
      const container = els.placesList;
      if (!container) return;
      const sorted = [...this.getAll()].sort((a, b) => (a.stop_order??999) - (b.stop_order??999));
      const visited = sorted.filter(p => placeVisited(p.id)).length;
      if (els.listSheetTitle) els.listSheetTitle.textContent = state.assignment?.title || 'Platser';
      if (els.listSheetSubtitle) els.listSheetSubtitle.textContent = `${visited} av ${sorted.length} besökta`;

      container.innerHTML = '';
      sorted.forEach((place, idx) => {
        const dist = place._distance;
        const isClose   = dist != null && dist <= CLOSE_M;
        const isNear    = dist != null && dist <= NEAR_M;
        const isVisited = placeVisited(place.id);
        const isSeq     = state.assignment?.unlock_mode === 'sequential';
        const prevDone  = idx === 0 || placeVisited(sorted[idx-1]?.id);
        const isLocked  = isSeq && !isVisited && !prevDone;

        const statusClass = isVisited ? 'is-visited' : isClose ? 'is-unlocked' : isLocked ? 'is-locked' : isNear ? 'is-near' : '';
        const distText = dist != null ? (dist < 1000 ? `${Math.round(dist)} m` : `${(dist/1000).toFixed(1)} km`) : '';
        const badgeClass = isVisited ? 'badge-visited' : isClose ? 'badge-unlocked' : 'badge-locked';
        const badgeText  = isVisited ? '✓ Besökt' : isClose ? '📍 På plats' : distText || 'Låst';

        const btn = document.createElement('button');
        btn.className = `place-row ${statusClass}`;
        btn.innerHTML = `
          <span class="place-row-dot"></span>
          <span class="place-row-main">
            <span class="place-row-title">${esc(place.title||'Plats')}</span>
            ${place.short_description ? `<span class="place-row-sub">${esc(place.short_description)}</span>` : ''}
          </span>
          <span class="place-row-badge ${badgeClass}">${badgeText}</span>
        `;
        btn.addEventListener('click', () => ui.openDetail(place));
        container.appendChild(btn);
      });
    },
  };

  function placeVisited(id) { return !!(state.progressByPlaceId?.[id]?.visited); }

  function updateNavBadge() {
    const n = places.getAll().filter(p => p._distance != null && p._distance <= CLOSE_M && !placeVisited(p.id)).length;
    if (els.navListBadge) { els.navListBadge.textContent = n; els.navListBadge.classList.toggle('hidden', n===0); }
  }


  // ═══════════════════════════════════════════════════════════
  //  GRUPP-FUNKTIONALITET
  // ═══════════════════════════════════════════════════════════
  function isTrailAssignment() {
    return state.assignment?.type === 'trail' || state.assignment?.type === 'quiz_walk';
  }

  function isInGroup() {
    return !!(state.activeGroup?.event_id && state.sessionToken);
  }

  function showGroupStatus(msg, type = 'info') {
    const el = els.groupStatus;
    if (!el) return;
    el.textContent = msg;
    el.className = `group-status ${type}`;
    el.classList.remove('hidden');
  }

  function clearGroupStatus() {
    if (els.groupStatus) { els.groupStatus.textContent = ''; els.groupStatus.classList.add('hidden'); }
  }

  function updateGroupUI() {
    // Grupp-sektion i intro — bara för trail
    if (els.groupSection) els.groupSection.classList.toggle('hidden', !isTrailAssignment());

    // Topplista-knapp i nav
    if (els.navLeaderboard) els.navLeaderboard.classList.toggle('hidden', !isInGroup());

    // Badge på kartan
    if (els.mapGroupBadge && els.mapGroupName) {
      const show = isInGroup();
      els.mapGroupBadge.classList.toggle('hidden', !show);
      if (show) els.mapGroupName.textContent = state.activeGroup.group_name || 'Grupp';
    }
  }

  async function handleCreateGroup() {
    if (!state.assignment?.id) { showGroupStatus('Inget uppdrag laddat.', 'error'); return; }
    if (els.createGroupBtn) els.createGroupBtn.disabled = true;
    showGroupStatus('Skapar grupp…', 'info');

    try {
      // Skapa session om den saknas
      let token = state.sessionToken;
      if (!token) token = await ensureSession();

      const nickname = (els.nicknameInput?.value || '').trim();
      const groupName = (state.assignment.title || 'Grupp').substring(0, 40);
      const resp = await apiCreateGroup(state.assignment.id, token, groupName, nickname || null);

      if (!resp.ok) throw new Error(resp.error || 'Kunde inte skapa grupp.');

      state.activeGroup = {
        event_id:   resp.event_id,
        invite_code: resp.invite_code,
        group_name:  resp.group_name,
      };
      saveGroup(state.activeGroup);

      if (els.groupInviteCode) els.groupInviteCode.textContent = resp.invite_code;
      if (els.groupCreated) els.groupCreated.classList.remove('hidden');
      clearGroupStatus();
      updateGroupUI();
    } catch (err) {
      showGroupStatus(err.message || 'Kunde inte skapa grupp.', 'error');
    } finally {
      if (els.createGroupBtn) els.createGroupBtn.disabled = false;
    }
  }

  async function handleJoinGroup() {
    const code = (els.joinGroupInput?.value || '').trim().toUpperCase();
    if (!code) { showGroupStatus('Ange en gruppkod.', 'error'); els.joinGroupInput?.focus(); return; }
    if (els.joinGroupBtn) els.joinGroupBtn.disabled = true;
    showGroupStatus('Ansluter…', 'info');

    try {
      let token = state.sessionToken;
      if (!token) token = await ensureSession();

      const nickname = (els.nicknameInput?.value || '').trim();
      const resp = await apiJoinGroup(code, token, nickname || null);

      if (!resp.ok) throw new Error(resp.error || 'Kunde inte gå med i grupp.');

      state.activeGroup = {
        event_id:   resp.event_id,
        invite_code: resp.invite_code,
        group_name:  resp.group_name,
      };
      saveGroup(state.activeGroup);

      showGroupStatus(`Du är med i "${resp.group_name}"! Starta uppdraget nedan.`, 'success');
      updateGroupUI();
    } catch (err) {
      showGroupStatus(err.message || 'Kunde inte gå med i grupp.', 'error');
    } finally {
      if (els.joinGroupBtn) els.joinGroupBtn.disabled = false;
    }
  }

  async function ensureSession() {
    const nickname = (els.nicknameInput?.value || '').trim();
    const code = (state.assignmentCode || state.assignment?.access_code || (els.codeInput?.value || '')).trim().toUpperCase();
    if (!code) throw new Error('Åtkomstkod saknas.');
    const token = await createSession(state.assignment.id, code, nickname || undefined);
    if (!token) throw new Error('Sessionen kunde inte startas.');
    state.sessionToken = token;
    saveSession(token, nickname);
    saveAssignment(state.assignment, code);
    return token;
  }

  // ── Topplista ──────────────────────────────────────────────
  async function openLeaderboard() {
    if (!isInGroup()) return;
    if (els.leaderboardTitle) els.leaderboardTitle.textContent = state.activeGroup.group_name || 'Topplista';
    if (els.leaderboardInviteCode) els.leaderboardInviteCode.textContent = `Kod: ${state.activeGroup.invite_code}`;
    if (els.leaderboardOverlay) els.leaderboardOverlay.classList.add('active');
    await fetchAndRenderLeaderboard(els.leaderboardBody);
  }

  function closeLeaderboard() {
    if (els.leaderboardOverlay) els.leaderboardOverlay.classList.remove('active');
  }

  async function fetchAndRenderLeaderboard(container) {
    if (!container) return;
    container.innerHTML = '<div class="leaderboard-empty">Hämtar…</div>';
    try {
      const resp = await apiFetchLeaderboard(state.activeGroup.event_id, state.sessionToken);
      renderLeaderboardRows(container, resp.leaderboard || []);
    } catch (err) {
      container.innerHTML = `<div class="leaderboard-empty">${esc(err.message || 'Kunde inte hämta topplista.')}</div>`;
    }
  }

  function renderLeaderboardRows(container, rows) {
    if (!rows.length) {
      container.innerHTML = '<div class="leaderboard-empty">Inga deltagare ännu.</div>';
      return;
    }
    container.innerHTML = '';
    rows.forEach(row => {
      const rankClass = row.rank <= 3 ? `rank-${row.rank}` : '';
      const meClass   = row.is_me ? 'is-me' : '';
      const div = document.createElement('div');
      div.className = `leaderboard-row ${meClass}`;
      div.innerHTML = `
        <div class="leaderboard-rank ${rankClass}">${row.rank}</div>
        <div style="flex:1;min-width:0">
          <div class="leaderboard-name">${esc(row.display_name || 'Anonym')}${row.is_me ? ' (du)' : ''}</div>
          <div class="leaderboard-meta">${row.places_visited} platser · ${row.correct_answers} rätt</div>
        </div>
        <div class="leaderboard-points">${row.total_points}p</div>
      `;
      container.appendChild(div);
    });
  }

  // ── Dela gruppkod ─────────────────────────────────────────
  function openShareGroupModal() {
    const code = state.activeGroup?.invite_code || '';
    if (els.shareGroupCode) els.shareGroupCode.textContent = code;
    els.shareGroupModal?.showModal();
  }

  async function handleShareGroupNative() {
    const code = state.activeGroup?.invite_code || '';
    const name = state.activeGroup?.group_name  || 'På plats';
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text: `Gå med i min grupp i På plats! Kod: ${code}` });
      } catch {}
    } else {
      await copyToClipboard(code);
      showToast('Kod kopierad!');
    }
  }

  async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); }
    catch { /* äldre browsers */ }
  }


  // ═══════════════════════════════════════════════════════════
  //  PLATSDETALJ
  // ═══════════════════════════════════════════════════════════
  function renderDetail(place) {
    const body = els.detailSheetBody;
    if (!body) return;
    if (els.detailSheetTitle) els.detailSheetTitle.textContent = place.title || 'Plats';
    body.innerHTML = '';

    const dist      = place._distance;
    const isClose   = dist != null && dist <= CLOSE_M;
    const isVisited = placeVisited(place.id);
    const sorted    = [...places.getAll()].sort((a,b) => (a.stop_order??999)-(b.stop_order??999));
    const idx       = sorted.findIndex(p => p.id === place.id);
    const prevDone  = idx <= 0 || placeVisited(sorted[idx-1]?.id);
    const isLocked  = state.assignment?.unlock_mode === 'sequential' && !isVisited && !prevDone;

    // Hero-bild
    const heroBlock = (place.content_blocks||[]).find(b => normalizeType(b.type)==='image' && (b.url||b.stored_path));
    if (heroBlock) {
      const img = document.createElement('img');
      img.src = resolveMediaUrl(heroBlock.url || heroBlock.stored_path);
      img.alt = heroBlock.alt_text || place.title || '';
      img.className = 'detail-hero-img'; img.loading = 'lazy';
      img.addEventListener('click', () => openLightbox(img.src));
      body.appendChild(img);
    }

    // Rubrik + meta
    const sec = document.createElement('div');
    sec.className = 'detail-section';
    sec.innerHTML = `
      <h3 class="detail-title">${esc(place.title||'Plats')}</h3>
      <div class="detail-meta-row">
        ${dist != null ? `<span class="detail-distance-badge ${isClose?'distance-close':dist<=NEAR_M?'distance-near':'distance-far'}">
          ${isClose ? '📍 På plats' : dist<1000 ? Math.round(dist)+' m bort' : (dist/1000).toFixed(1)+' km bort'}
        </span>` : ''}
        ${isVisited ? '<span class="detail-distance-badge distance-close">✓ Besökt</span>' : ''}
      </div>
      ${place.long_description||place.short_description ? `<p class="detail-description">${esc(place.long_description||place.short_description)}</p>` : ''}
    `;
    body.appendChild(sec);

    // Upplåsnings-banner
    const banner = document.createElement('div');
    banner.className = `unlock-banner${isClose||isVisited?' is-unlocked':''}`;
    if (isLocked) {
      banner.innerHTML = `<span class="unlock-icon">🔒</span><span class="unlock-text"><strong>Låst</strong>Slutför föregående plats först.</span>`;
    } else if (isVisited) {
      banner.innerHTML = `<span class="unlock-icon">✅</span><span class="unlock-text"><strong>Slutförd</strong>Du har besökt den här platsen.</span>`;
    } else if (isClose) {
      banner.innerHTML = `<span class="unlock-icon">📍</span><span class="unlock-text"><strong>Du är på plats!</strong>Utforska innehållet nedan.</span>`;
    } else {
      banner.innerHTML = `<span class="unlock-icon">🗺️</span><span class="unlock-text"><strong>Gå hit för att låsa upp</strong>Aktiveras inom ${place.activation_radius_meters||CLOSE_M} m.</span>`;
    }
    body.appendChild(banner);

    // Innehållsblock
    if (!isLocked || isVisited || isClose) renderContentBlocks(body, place, isClose||isVisited);

    if (isClose && !isVisited && state.sessionToken) markPlaceVisited(place);
  }

  function renderContentBlocks(container, place, isUnlocked) {
    const blocks = place.content_blocks || [];
    if (!blocks.length) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'content-blocks';
    blocks.forEach(block => {
      const el = createBlockEl(block, place, isUnlocked);
      if (el) wrapper.appendChild(el);
    });
    container.appendChild(wrapper);
  }

  function createBlockEl(block, place, isUnlocked) {
    const type = normalizeType(block.type);
    if (type === 'text' || type === 'note') {
      const div = document.createElement('div');
      div.className = 'content-block-text'; div.textContent = block.text || block.content || ''; return div;
    }
    if (type === 'image') {
      const url = resolveMediaUrl(block.url || block.stored_path); if (!url) return null;
      const img = document.createElement('img');
      img.src = url; img.alt = block.alt_text||''; img.loading = 'lazy';
      img.addEventListener('click', () => openLightbox(url)); return img;
    }
    if (type === 'video') {
      const url = resolveMediaUrl(block.url || block.stored_path); if (!url) return null;
      const v = document.createElement('video');
      v.src = url; v.controls = true; v.playsInline = true;
      v.style.cssText = 'width:100%;border-radius:10px;display:block'; return v;
    }
    if (type === 'audio') {
      const url = resolveMediaUrl(block.url || block.stored_path); if (!url) return null;
      const a = document.createElement('audio');
      a.src = url; a.controls = true; a.style.width = '100%'; return a;
    }
    if (type === 'clue') {
      const div = document.createElement('div');
      div.className = 'content-block content-block-clue';
      const viewed = state.viewedClues[block.id];
      div.innerHTML = `<div class="clue-header">💡 Ledtråd</div>` +
        (viewed ? `<p class="clue-text">${esc(block.text||block.content||'')}</p>`
                : `<button class="btn btn-secondary btn-sm" data-clue-id="${block.id}">Visa ledtråd</button>`);
      if (!viewed) div.querySelector('button').addEventListener('click', () => showClue(block));
      return div;
    }
    if (type === 'question') return createQuestionEl(block, place, isUnlocked);
    return null;
  }

  function createQuestionEl(block, place, isUnlocked) {
    const div = document.createElement('div');
    div.className = 'content-block content-block-question';
    const answered = state.progressByBlockId?.[block.id];
    div.innerHTML = `<div class="question-prompt">${esc(block.question||block.text||'Fråga')}</div>` +
      (answered
        ? `<div class="answer-result answer-correct">✓ Besvarad: ${esc(answered.answer||'')}</div>`
        : `<textarea class="question-input" placeholder="Ditt svar…" rows="3"></textarea>
           <button class="btn btn-primary btn-sm question-submit">Skicka svar</button>`);
    if (!answered) {
      const btn = div.querySelector('.question-submit');
      const inp = div.querySelector('.question-input');
      btn.addEventListener('click', async () => {
        const ans = inp.value.trim(); if (!ans) return;
        btn.disabled = true;
        try {
          await postProgress(state.sessionToken, { place_id: place.id, block_id: block.id, type: 'question', answer: ans });
          state.progressByBlockId[block.id] = { answer: ans };
          const res = document.createElement('div');
          res.className = 'answer-result answer-correct'; res.textContent = `✓ Besvarad: ${ans}`;
          inp.replaceWith(res); btn.replaceWith(res.cloneNode(true));
          // Uppdatera topplista efter svar om i grupp
          if (isInGroup() && els.leaderboardOverlay?.classList.contains('active'))
            await fetchAndRenderLeaderboard(els.leaderboardBody);
        } catch (err) { showToast(err.message||'Fel vid sparande.', true); btn.disabled = false; }
      });
    }
    return div;
  }

  function normalizeType(t) { return String(t||'').toLowerCase().trim(); }

  async function markPlaceVisited(place) {
    if (!state.sessionToken) return;
    try {
      await postProgress(state.sessionToken, { place_id: place.id, type: 'visit', visited: true });
      if (!state.progressByPlaceId[place.id]) state.progressByPlaceId[place.id] = {};
      state.progressByPlaceId[place.id].visited = true;
      places.renderList(); updateNavBadge(); queueMapRender(); checkAllVisited();
    } catch (err) { console.warn('markPlaceVisited:', err); }
  }

  function checkAllVisited() {
    const all = places.getAll(), done = all.filter(p => placeVisited(p.id)).length;
    if (done >= all.length && all.length > 0 && !state.allVisitedNotified) {
      state.allVisitedNotified = true;
      showToast(isTrailAssignment() ? 'Alla platser besökta! 🏆' : 'Alla platser besökta! 🎉');
    }
  }

  function showClue(block) {
    state.viewedClues[block.id] = true;
    if (els.clueModalText) els.clueModalText.textContent = block.text || block.content || '';
    els.clueModal?.showModal();
  }


  // ═══════════════════════════════════════════════════════════
  //  ANTECKNINGAR
  // ═══════════════════════════════════════════════════════════
  function loadNotesFromSession(payload) {
    const n = payload?.notes; if (!n) return;
    state.notes.suspects = n.suspects || [];
    state.notes.evidence = n.evidence || [];
    state.notes.free     = n.free_text || n.free || '';
    renderNotes();
  }

  function renderNotes() {
    const sl = els.suspectsList;
    if (sl) {
      sl.innerHTML = '';
      (state.notes.suspects.length ? state.notes.suspects : []).forEach(s => {
        const c = document.createElement('div'); c.className = 'suspect-card';
        c.innerHTML = `<div class="suspect-name">${esc(s.name||s.title||'')}</div>${s.notes?`<div class="suspect-notes">${esc(s.notes)}</div>`:''}`;
        sl.appendChild(c);
      });
      if (!state.notes.suspects.length) sl.innerHTML = '<p style="color:var(--text-2);font-size:.88rem">Inga misstänkta ännu.</p>';
    }
    const el = els.evidenceList;
    if (el) {
      el.innerHTML = '';
      (state.notes.evidence.length ? state.notes.evidence : []).forEach(e => {
        const c = document.createElement('div'); c.className = 'evidence-card';
        c.innerHTML = `<div class="evidence-title">${esc(e.title||e.name||'')}</div>${e.notes?`<div class="evidence-notes">${esc(e.notes)}</div>`:''}`;
        el.appendChild(c);
      });
      if (!state.notes.evidence.length) el.innerHTML = '<p style="color:var(--text-2);font-size:.88rem">Inga bevis ännu.</p>';
    }
    if (els.notesTextarea) els.notesTextarea.value = state.notes.free || '';
  }

  async function handleSaveNotes() {
    if (!state.sessionToken) return;
    state.notes.free = els.notesTextarea?.value || '';
    try { await putNotes(state.sessionToken, state.notes); showToast('Anteckningar sparade.'); }
    catch (err) { showToast('Fel vid sparande.', true); }
  }


  // ═══════════════════════════════════════════════════════════
  //  UI
  // ═══════════════════════════════════════════════════════════
  const ui = {
    showView(name) {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.querySelector(`.view-${name}`)?.classList.add('active');
      document.body.dataset.view = name;
      state.currentView = name;
    },
    openDetail(place) {
      state.selectedPlace = place;
      renderDetail(place);
      this.setPanel('detail');
      queueMapRender();
    },
    setPanel(panel) {
      state.activePanel = panel;
      ['map','list','detail'].forEach(p => {
        const btn = q(`#nav${p.charAt(0).toUpperCase()+p.slice(1)}`);
        btn?.classList.toggle('active', p === panel);
      });
      els.listSheet?.classList.toggle('active', panel === 'list');
      els.detailSheet?.classList.toggle('active', panel === 'detail');
    },
    showCompletion() {
      const all = places.getAll(), done = all.filter(p => placeVisited(p.id)).length;
      if (els.completionSummary) els.completionSummary.textContent = `Du besökte ${done} av ${all.length} platser.`;
      if (isInGroup() && els.completionLeaderboard && els.completionLeaderboardBody) {
        els.completionLeaderboard.classList.remove('hidden');
        fetchAndRenderLeaderboard(els.completionLeaderboardBody);
      }
      this.showView('completion');
    },
  };

  function showToast(msg, isError = false) {
    const t = els.toast; if (!t) return;
    t.textContent = msg;
    t.className = 'toast visible' + (isError ? ' is-error' : '');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('visible'), 3000);
  }

  function setCodeStatus(msg, type = '') {
    if (!els.codeStatus) return;
    els.codeStatus.textContent = msg;
    els.codeStatus.className   = 'form-status' + (type ? ` ${type}` : '');
  }

  function openLightbox(src) {
    if (!els.lightbox || !els.lightboxImg) return;
    els.lightboxImg.src = src; els.lightbox.removeAttribute('hidden');
  }

  function closeLightbox() {
    els.lightbox?.setAttribute('hidden', ''); if (els.lightboxImg) els.lightboxImg.src = '';
  }

  function esc(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }


  // ═══════════════════════════════════════════════════════════
  //  NEDRÄKNING
  // ═══════════════════════════════════════════════════════════
  function startCountdown() {
    stopCountdown();
    const a = state.assignment; if (!a) return;
    let endDate = a.activation_ends_at ? new Date(a.activation_ends_at) : null;
    if (a.time_limit_minutes && state._sessionStarted) {
      const t = new Date(state._sessionStarted.getTime() + a.time_limit_minutes * 60000);
      endDate = endDate ? (t < endDate ? t : endDate) : t;
    }
    if (!endDate) return;
    state.countdownInterval = setInterval(() => {
      const rem = endDate - Date.now();
      const badge = els.mapTimerBadge; if (!badge) return;
      if (rem <= 0) { badge.textContent = 'Tid ute!'; badge.classList.remove('hidden'); stopCountdown(); return; }
      const h = Math.floor(rem/3600000), m = Math.floor((rem%3600000)/60000), s = Math.floor((rem%60000)/1000);
      badge.textContent = h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
      badge.classList.remove('hidden');
    }, 1000);
  }

  function stopCountdown() { clearInterval(state.countdownInterval); state.countdownInterval = null; }


  // ═══════════════════════════════════════════════════════════
  //  UPPDRAGSHANTERING
  // ═══════════════════════════════════════════════════════════
  async function handleLoadAssignment() {
    const code = (els.codeInput?.value || '').trim().toUpperCase();
    if (!code) { setCodeStatus('Ange en uppdragskod.', 'error'); return; }
    const btn = els.loadBtn; btn.disabled = true; btn.textContent = 'Hämtar…'; setCodeStatus('');
    try {
      const assignment = await fetchAssignment(code);
      if (!assignment?.id) throw new Error('Uppdraget hittades inte.');
      state.assignment = normalizeAssignment(assignment, code);
      state.assignmentCode = code;
      saveAssignment(state.assignment, code);
      renderIntro(state.assignment);
      ui.showView('intro');
    } catch (err) {
      setCodeStatus(err.message || 'Kunde inte hämta uppdraget.', 'error');
    } finally { btn.disabled = false; btn.textContent = 'Hämta'; }
  }

  async function handleStartAssignment() {
    const btn = els.startBtn; btn.disabled = true; btn.textContent = 'Startar…';
    try {
      const nickname = (els.nicknameInput?.value || '').trim();
      state.nickname = nickname;
      if (!state.sessionToken) {
        const token = await ensureSession();
        state._sessionStarted = new Date();
        // Länka till grupp om skapad/ansluten utan token
        if (state.activeGroup?.event_id) {
          try {
            await apiJoinGroup(state.activeGroup.invite_code, token, nickname || null);
          } catch {}
        }
      }
      await loadProgress();
      ui.showView('map'); ui.setPanel('map');
      map.init(); startGeo(); startCountdown();
      if (els.mapAssignmentTitle) els.mapAssignmentTitle.textContent = state.assignment?.title || '';
      updateGroupUI();

      const first = places.getAll()[0];
      if (first?.latitude && state.userLat == null) map.centerOn(first.latitude, first.longitude);
      queueMapRender();
    } catch (err) {
      showToast(err.message || 'Kunde inte starta uppdraget.', true);
      btn.disabled = false; btn.textContent = 'Starta uppdrag';
    }
  }

  async function loadProgress() {
    if (!state.sessionToken) return;
    try {
      const payload = await fetchSessionProgress(state.sessionToken);
      buildProgressIndexes(payload.progress || []);
      loadNotesFromSession(payload);
    } catch (err) { if (!err.message?.includes('404')) console.warn('loadProgress:', err); }
  }

  function buildProgressIndexes(rows) {
    state.progressByPlaceId = {}; state.progressByBlockId = {};
    rows.forEach(r => {
      if (r.place_id) {
        if (!state.progressByPlaceId[r.place_id]) state.progressByPlaceId[r.place_id] = {};
        if (r.visited) state.progressByPlaceId[r.place_id].visited = true;
      }
      if (r.block_id) state.progressByBlockId[r.block_id] = r;
    });
  }

  function normalizeAssignment(a, code) {
    return { ...a, access_code: a.access_code||a.accessCode||code||'', places: Array.isArray(a.places)?a.places:[] };
  }

  function renderIntro(a) {
    if (els.introType) els.introType.textContent = humanizeType(a.type);
    if (els.introTitle) els.introTitle.textContent = a.title || 'Uppdrag';
    if (els.introSubtitle) els.introSubtitle.textContent = a.short_description || '';
    if (els.introDescription) els.introDescription.textContent = a.description || a.intro_body || '';
    if (els.introPlaceCountText) els.introPlaceCountText.textContent = `${(a.places||[]).length} platser`;
    if (a.time_limit_minutes && els.introTimelimit) {
      els.introTimelimit.classList.remove('hidden');
      if (els.introTimelimitText) els.introTimelimitText.textContent = `${a.time_limit_minutes} min tidsgräns`;
    }
    // Visa/dölj grupp-sektion
    const isTrail = a.type === 'trail' || a.type === 'quiz_walk';
    if (els.groupSection) els.groupSection.classList.toggle('hidden', !isTrail);
    // Återställ grupp-UI
    if (els.groupCreated) els.groupCreated.classList.add('hidden');
    if (els.groupInviteCode) els.groupInviteCode.textContent = '';
    if (els.joinGroupInput) els.joinGroupInput.value = '';
    clearGroupStatus();
    // Återuppta grupp om sparad
    const storedGroup = loadStoredGroup();
    if (storedGroup && isTrail) {
      state.activeGroup = storedGroup;
      if (els.groupInviteCode) els.groupInviteCode.textContent = storedGroup.invite_code;
      if (els.groupCreated) els.groupCreated.classList.remove('hidden');
    }
  }

  function humanizeType(t) {
    return { exploration:'Utforskning', trail:'Tipspromenad', mystery:'Mordgåta',
             treasure_hunt:'Skattjakt', quiz_walk:'Promenadquiz', digital:'Digital' }[t] || t || 'Uppdrag';
  }


  // ═══════════════════════════════════════════════════════════
  //  LÄMNA / AVSLUTA
  // ═══════════════════════════════════════════════════════════
  function showLeaveConfirm(callback) {
    if (!els.leaveConfirmModal) { callback(); return; }
    const all = places.getAll(), done = all.filter(p => placeVisited(p.id)).length;
    if (els.leaveConfirmText) {
      els.leaveConfirmText.textContent = done < all.length
        ? `Du har besökt ${done} av ${all.length} platser. Vill du avsluta?`
        : 'Alla platser besökta. Vill du avsluta?';
    }
    els.leaveConfirmModal.showModal();
    const ok = els.leaveConfirmOkBtn, cancel = els.leaveConfirmCancelBtn;
    function cleanup() { ok?.removeEventListener('click', doOk); cancel?.removeEventListener('click', doCancel); }
    function doOk() { cleanup(); els.leaveConfirmModal.close(); callback(); }
    function doCancel() { cleanup(); els.leaveConfirmModal.close(); }
    ok?.addEventListener('click', doOk); cancel?.addEventListener('click', doCancel);
  }

  async function handleLeave() {
    showLeaveConfirm(async () => {
      stopGeo(); stopCountdown();
      if (state.sessionToken) { try { await postComplete(state.sessionToken); } catch {} }
      ui.showCompletion();
    });
  }

  function handleCompletionDone() {
    clearSession();
    Object.assign(state, {
      assignment: null, assignmentCode: null, sessionToken: null,
      activeGroup: null, progressByPlaceId: {}, progressByBlockId: {},
      selectedPlace: null, allVisitedNotified: false, mapInitialized: false,
    });
    ui.showView('code');
    checkResume();
  }


  // ═══════════════════════════════════════════════════════════
  //  RESUME
  // ═══════════════════════════════════════════════════════════
  function checkResume() {
    const storedS = loadStoredSession(), storedA = loadStoredAssignment();
    if (!storedS?.token || !storedA?.assignment) { els.resumeCard?.classList.add('hidden'); return; }
    state.sessionToken   = storedS.token;
    state.nickname       = storedS.nickname || '';
    state.assignment     = normalizeAssignment(storedA.assignment, storedA.code);
    state.assignmentCode = storedA.code;
    const storedG = loadStoredGroup();
    if (storedG) state.activeGroup = storedG;
    if (els.resumeTitle) els.resumeTitle.textContent = state.assignment.title || 'Uppdrag';
    els.resumeCard?.classList.remove('hidden');
  }

  async function handleResume() {
    if (!state.assignment || !state.sessionToken) return;
    await loadProgress();
    ui.showView('map'); ui.setPanel('map');
    map.init(); startGeo(); startCountdown();
    if (els.mapAssignmentTitle) els.mapAssignmentTitle.textContent = state.assignment?.title || '';
    updateGroupUI();
    const first = places.getAll()[0];
    if (first?.latitude && state.userLat == null) map.centerOn(first.latitude, first.longitude);
    queueMapRender();
  }

  function handleResumeClear() {
    clearSession();
    state.assignment = null; state.sessionToken = null; state.activeGroup = null;
    els.resumeCard?.classList.add('hidden'); showToast('Session rensad.');
  }


  // ═══════════════════════════════════════════════════════════
  //  PWA INSTALL
  // ═══════════════════════════════════════════════════════════
  let deferredPrompt = null;
  function initPWA() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault(); deferredPrompt = e; els.installBtn?.classList.remove('hidden');
    });
    els.installBtn?.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const r = await deferredPrompt.userChoice;
        if (r.outcome === 'accepted') els.installBtn?.classList.add('hidden');
        deferredPrompt = null;
      } else if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone) {
        els.iosInstallModal?.showModal();
      }
    });
    els.iosInstallCloseBtn?.addEventListener('click', () => els.iosInstallModal?.close());
    els.iosInstallDoneBtn?.addEventListener('click',  () => els.iosInstallModal?.close());
  }


  // ═══════════════════════════════════════════════════════════
  //  EVENT-LYSSNARE
  // ═══════════════════════════════════════════════════════════
  function bindEvents() {
    // Kod-vy
    els.loadBtn?.addEventListener('click', handleLoadAssignment);
    els.codeInput?.addEventListener('keydown', e => { if (e.key==='Enter') handleLoadAssignment(); });
    els.resumeBtn?.addEventListener('click', handleResume);
    els.resumeClearBtn?.addEventListener('click', handleResumeClear);

    // Intro
    els.introBackBtn?.addEventListener('click', () => ui.showView('code'));
    els.startBtn?.addEventListener('click', handleStartAssignment);

    // Grupp
    els.createGroupBtn?.addEventListener('click', handleCreateGroup);
    els.joinGroupBtn?.addEventListener('click', handleJoinGroup);
    els.joinGroupInput?.addEventListener('keydown', e => { if (e.key==='Enter') handleJoinGroup(); });
    els.shareGroupCodeBtn?.addEventListener('click', openShareGroupModal);
    els.shareGroupCloseBtn?.addEventListener('click', () => els.shareGroupModal?.close());
    els.shareGroupNativeBtn?.addEventListener('click', handleShareGroupNative);
    els.copyGroupCodeBtn?.addEventListener('click', async () => {
      await copyToClipboard(state.activeGroup?.invite_code || '');
      showToast('Kod kopierad!');
    });

    // Karta
    els.mapLocateBtn?.addEventListener('click', () => {
      if (state.userLat != null) map.centerOn(state.userLat, state.userLng);
      queueMapRender();
    });
    els.mapZoomInBtn?.addEventListener('click',  () => { state.mapZoom = Math.min(18, state.mapZoom+1); queueMapRender(); });
    els.mapZoomOutBtn?.addEventListener('click', () => { state.mapZoom = Math.max(3,  state.mapZoom-1); queueMapRender(); });
    els.mapIntroCloseBtn?.addEventListener('click', () => els.mapIntroCard?.classList.add('hidden'));

    // Topplista
    els.navLeaderboard?.addEventListener('click', openLeaderboard);
    els.leaderboardCloseBtn?.addEventListener('click', closeLeaderboard);
    els.leaderboardRefreshBtn?.addEventListener('click', () => fetchAndRenderLeaderboard(els.leaderboardBody));

    // Nav
    els.navMap?.addEventListener('click', () => ui.setPanel('map'));
    els.navList?.addEventListener('click', () => { places.renderList(); ui.setPanel('list'); });
    els.navNotes?.addEventListener('click', () => {
      if (state.assignment?.type === 'mystery') { renderNotes(); ui.showView('notes'); }
      else showToast('Anteckningar finns för mordgåtor.');
    });
    els.navLeave?.addEventListener('click', handleLeave);

    // Sheets
    els.listSheetBackBtn?.addEventListener('click', () => ui.setPanel('map'));
    els.detailSheetBackBtn?.addEventListener('click', () => { ui.setPanel('list'); places.renderList(); });

    // Anteckningar
    els.notesBackBtn?.addEventListener('click', () => ui.showView('map'));
    els.saveNotesBtn?.addEventListener('click', handleSaveNotes);
    els.notesTabs?.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        els.notesTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`tab${tab.dataset.tab.charAt(0).toUpperCase()+tab.dataset.tab.slice(1)}`)?.classList.add('active');
      });
    });

    // Avslutning
    els.completionDoneBtn?.addEventListener('click', handleCompletionDone);

    // Lightbox
    els.lightboxCloseBtn?.addEventListener('click', closeLightbox);
    els.lightbox?.addEventListener('click', e => { if (e.target===els.lightbox) closeLightbox(); });

    // Modaler
    els.clueModalCloseBtn?.addEventListener('click', () => els.clueModal?.close());
    els.iosInstallModal?.addEventListener('click', e => { if (e.target===els.iosInstallModal) els.iosInstallModal.close(); });
  }


  // ═══════════════════════════════════════════════════════════
  //  UPPSTART
  // ═══════════════════════════════════════════════════════════
  function init() {
    els = cacheEls();
    bindEvents();
    initPWA();
    checkResume();
    ui.showView('code');
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

})();