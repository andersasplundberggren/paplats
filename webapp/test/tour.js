/* ─────────────────────────────────────────────────────────────
   På Plats — tour.js (test-UI version)
   Onscreen spotlight guide system.

   Placera filen i:  webapp/test/tour.js
   Lägg till i index.html (före </body>):
     <script src="/app/test/tour.js"></script>

   Starta en tour manuellt:
     window.SpotOnTour.start('map');
   ─────────────────────────────────────────────────────────────*/

(function () {
  'use strict';

  /* ── Konstanter ───────────────────────────────────────────── */
  const STORAGE_PREFIX = 'spoton.tour.';
  const OVERLAY_ID     = 'spoton-tour-overlay';
  const SPOTLIGHT_ID   = 'spoton-tour-spotlight';
  const BUBBLE_ID      = 'spoton-tour-bubble';
  const ARROW_ID       = 'spoton-tour-arrow';

  /* ── Gemensamma steg för alla kartlägen ──────────────────── */
  const MAP_STEPS_BASE = [
    {
      targetId : 'mapCanvas',
      title    : 'Kartan',
      text     : 'Visar din position (blå prick) och uppdragets platser (orangea markörer). Nyp för att zooma, dra för att panorera.',
      position : 'bottom'
    },
    {
      targetId : 'mapStatusText',
      title    : 'Nästa plats',
      text     : 'Visar närmaste plats och hur långt bort den är. När du är tillräckligt nära låses platsen upp.',
      position : 'bottom'
    },
    {
      targetId : 'hudProgressTrack',
      title    : 'Framsteg',
      text     : 'Visar hur många platser du besökt av totalt antal i uppdraget.',
      position : 'bottom'
    },
    {
      targetId : 'locateMeBtn',
      title    : 'Min position',
      text     : 'Centrerar kartan på din nuvarande GPS-position. Kräver att du tillåtit platsåtkomst.',
      position : 'left'
    },
    {
      targetId : 'zoomInBtn',
      title    : 'Zooma in',
      text     : 'Zoomar in ett steg på kartan.',
      position : 'left'
    },
    {
      targetId : 'zoomOutBtn',
      title    : 'Zooma ut',
      text     : 'Zoomar ut ett steg på kartan.',
      position : 'left'
    },
    {
      targetId : 'fitAllBtn',
      title    : 'Visa alla platser',
      text     : 'Zoomar ut kartan så att alla platser i uppdraget syns på skärmen.',
      position : 'left'
    },
    {
      targetId : 'infoFabBtn',
      title    : 'Uppdragsinformation',
      text     : 'Öppnar uppdragets introduktionstext.',
      position : 'left',
      waitFor  : () => !document.getElementById('infoFabBtn')?.classList.contains('hidden')
    },
    {
      targetId : 'leaveAssignmentBtn',
      title    : 'Avsluta uppdrag',
      text     : 'Avslutar och sparar dina framsteg. Du ser din sammanfattning och eventuell poäng efteråt.',
      position : 'top'
    }
  ];

  /* ── Extra steg för mordgåteläge ─────────────────────────── */
  const MAP_STEPS_MYSTERY_EXTRA = [
    {
      targetId : 'bottomNav',
      title    : 'Utredning',
      text     : 'I mordgåtor finns fliken Utredning i menyn längst ned. Där hittar du anteckningar, bevis och misstänkta.',
      position : 'top'
    }
  ];

  /* ── Hjälp: hämta aktuellt uppdragsläge från app.js state ── */
  function getMode() {
    const type = String(window._spotOnState?.assignment?.type || '').trim().toLowerCase();
    if (type === 'mystery' || type === 'treasure_hunt') return 'mystery';
    if (type === 'trail'   || type === 'quiz_walk')     return 'trail';
    return 'exploration';
  }

  /* ── Turdefinitioner ─────────────────────────────────────── */
  const TOURS = {

    /* ── Startskärmen – codeView ─────────────────────────────── */
    code: {
      storageKey: STORAGE_PREFIX + 'code.v2',
      steps: [
        {
          targetId : 'codeInput',
          title    : 'Åtkomstkod',
          text     : 'Skriv in koden du fått av arrangören. Den finns på inbjudningskortet eller QR-skylten.',
          position : 'bottom'
        },
        {
          targetId : 'nicknameInput',
          title    : 'Ditt namn',
          text     : 'Valfritt. Visas för arrangören i resultatvyn så de vet vem som deltar.',
          position : 'bottom'
        },
        {
          targetId : 'loadAssignmentBtn',
          title    : 'Öppna uppdrag',
          text     : 'Tryck här för att hämta uppdraget och komma igång.',
          position : 'top'
        },
        {
          targetId : 'openStartGuideBtn',
          title    : 'Så fungerar det',
          text     : 'Öppnar en genomgång av hur appen fungerar steg för steg.',
          position : 'top'
        },
        {
          targetId : 'installHintBtn',
          title    : 'Installera appen',
          text     : 'Lägg till På Plats på hemskärmen för snabbare åtkomst – fungerar som en app utan att ta lagringsutrymme.',
          position : 'top',
          waitFor  : () => !document.getElementById('installHintBtn')?.classList.contains('hidden')
        },
        {
          targetId : 'resetSessionBtn',
          title    : 'Nollställ lokal session',
          text     : 'Rensar sparad data på den här enheten. Använd om appen fastnat eller om du vill börja om.',
          position : 'top'
        }
      ]
    },

    /* ── Kartvyn – anpassas dynamiskt vid start ──────────────── */
    map: {
      storageKey: STORAGE_PREFIX + 'map.v3',
      steps: MAP_STEPS_BASE   // byts ut dynamiskt i start() beroende på läge
    },

    /* ── Utredning (mordgåta) – startas manuellt ─────────────── */
    notes: {
      storageKey: STORAGE_PREFIX + 'notes.v3',
      steps: [
        {
          targetId : 'notesTabBtn',
          title    : 'Anteckningar',
          text     : 'Skriv ledtrådar, lösningsförslag eller vad du vill komma ihåg. Sparas automatiskt på din enhet.',
          position : 'bottom'
        },
        {
          targetId : 'evidenceTabBtn',
          title    : 'Bevis',
          text     : 'Visar alla bevis du samlat på dig. Varje gång du besöker en plats med bevis läggs de automatiskt till här.',
          position : 'bottom'
        },
        {
          targetId : 'suspectTabBtn',
          title    : 'Misstänkta',
          text     : 'Visar de misstänkta personerna i mordgåtan med bakgrund, motiv och alibi.',
          position : 'bottom'
        }
      ]
    }
  };

  /* ── Tillstånd ────────────────────────────────────────────── */
  let active         = false;
  let currentTourId  = null;
  let currentStepIdx = 0;
  let resizeTimer    = null;
  let waitTimer      = null;

  /* ── DOM-element (skapas vid start) ──────────────────────── */
  let overlayEl   = null;
  let spotlightEl = null;
  let bubbleEl    = null;
  let arrowEl     = null;

  /* ── Hjälpfunktioner ─────────────────────────────────────── */
  function markSeen(key) {
    try { localStorage.setItem(key, '1'); } catch (_) {}
  }

  function hasSeen(key) {
    try { return !!localStorage.getItem(key); } catch (_) { return false; }
  }

  function getStep() {
    const tour = TOURS[currentTourId];
    return tour ? tour.steps[currentStepIdx] : null;
  }

  function getTotalSteps() {
    return TOURS[currentTourId]?.steps.length ?? 0;
  }

  /* ── DOM-byggare ─────────────────────────────────────────── */
  function buildDOM() {
    if (document.getElementById(OVERLAY_ID)) {
      overlayEl   = document.getElementById(OVERLAY_ID);
      spotlightEl = document.getElementById(SPOTLIGHT_ID);
      bubbleEl    = document.getElementById(BUBBLE_ID);
      arrowEl     = document.getElementById(ARROW_ID);
      return;
    }

    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    overlayEl.setAttribute('role', 'dialog');
    overlayEl.setAttribute('aria-modal', 'true');
    overlayEl.setAttribute('aria-label', 'Guidad genomgång');

    spotlightEl = document.createElement('div');
    spotlightEl.id = SPOTLIGHT_ID;

    bubbleEl = document.createElement('div');
    bubbleEl.id = BUBBLE_ID;

    arrowEl = document.createElement('div');
    arrowEl.id = ARROW_ID;

    overlayEl.appendChild(spotlightEl);
    overlayEl.appendChild(arrowEl);
    overlayEl.appendChild(bubbleEl);

    document.body.appendChild(overlayEl);

    overlayEl.addEventListener('click', function (e) {
      if (e.target === overlayEl) next();
    });

    document.addEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) {
    if (!active) return;
    if (e.key === 'Escape')                          end();
    if (e.key === 'ArrowRight' || e.key === 'Enter') next();
    if (e.key === 'ArrowLeft')                       prev();
  }

  /* ── Spotlight-positionering ─────────────────────────────── */
  const PAD = 8;

  function getRect(el) {
    const r = el.getBoundingClientRect();
    return {
      top    : r.top    - PAD,
      left   : r.left   - PAD,
      width  : r.width  + PAD * 2,
      height : r.height + PAD * 2,
      centerX: r.left + r.width  / 2,
      centerY: r.top  + r.height / 2,
      right  : r.right  + PAD,
      bottom : r.bottom + PAD
    };
  }

  function positionSpotlight(rect) {
    spotlightEl.style.top    = rect.top    + 'px';
    spotlightEl.style.left   = rect.left   + 'px';
    spotlightEl.style.width  = rect.width  + 'px';
    spotlightEl.style.height = rect.height + 'px';
  }

  const BUBBLE_W      = 300;
  const BUBBLE_OFFSET = 16;

  function positionBubble(rect, position) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bW = Math.min(BUBBLE_W, vw - 32);
    const bH = bubbleEl.offsetHeight || 160;
    let top, left;

    switch (position) {
      case 'bottom':
        top  = rect.bottom + BUBBLE_OFFSET;
        left = rect.centerX - bW / 2;
        break;
      case 'top':
        top  = rect.top - bH - BUBBLE_OFFSET;
        left = rect.centerX - bW / 2;
        break;
      case 'left':
        top  = rect.centerY - bH / 2;
        left = rect.left - bW - BUBBLE_OFFSET;
        break;
      case 'right':
        top  = rect.centerY - bH / 2;
        left = rect.right + BUBBLE_OFFSET;
        break;
      default:
        top  = rect.bottom + BUBBLE_OFFSET;
        left = rect.centerX - bW / 2;
    }

    left = Math.max(16, Math.min(left, vw - bW - 16));
    top  = Math.max(16, Math.min(top,  vh - bH - 16));

    bubbleEl.style.top   = top  + 'px';
    bubbleEl.style.left  = left + 'px';
    bubbleEl.style.width = bW   + 'px';

    positionArrow(rect, position, top, left, bW, bH);
  }

  function positionArrow(rect, position, bubTop, bubLeft, bW, bH) {
    const AH = 10;
    const AW = 16;
    let at, al, rotate;

    switch (position) {
      case 'bottom':
        at     = bubTop - AH;
        al     = rect.centerX - AW / 2;
        rotate = '0deg';
        break;
      case 'top':
        at     = bubTop + bH;
        al     = rect.centerX - AW / 2;
        rotate = '180deg';
        break;
      case 'left':
        at     = rect.centerY - AH / 2;
        al     = bubLeft + bW;
        rotate = '90deg';
        break;
      case 'right':
        at     = rect.centerY - AH / 2;
        al     = bubLeft - AW;
        rotate = '-90deg';
        break;
      default:
        arrowEl.style.display = 'none';
        return;
    }

    arrowEl.style.display   = 'block';
    arrowEl.style.top       = Math.max(0, at) + 'px';
    arrowEl.style.left      = Math.max(0, al) + 'px';
    arrowEl.style.transform = 'rotate(' + rotate + ')';
  }

  /* ── Bubbelinnehåll ──────────────────────────────────────── */
  function renderBubble(step) {
    const total   = getTotalSteps();
    const current = currentStepIdx + 1;

    bubbleEl.innerHTML =
      '<div class="tour-progress">' +
        '<span class="tour-step-counter">' + current + ' / ' + total + '</span>' +
        '<button class="tour-skip" aria-label="Stäng guiden">Hoppa över</button>' +
      '</div>' +
      '<div class="tour-title">' + escHtml(step.title) + '</div>' +
      '<div class="tour-text">'  + escHtml(step.text)  + '</div>' +
      '<div class="tour-actions">' +
        (currentStepIdx > 0
          ? '<button class="tour-btn tour-btn-prev">Föregående</button>'
          : '<div></div>'
        ) +
        '<button class="tour-btn tour-btn-next">' +
          (currentStepIdx < total - 1 ? 'Nästa →' : 'Klar ✓') +
        '</button>' +
      '</div>';

    bubbleEl.querySelector('.tour-skip')?.addEventListener('click', end);
    bubbleEl.querySelector('.tour-btn-next')?.addEventListener('click', next);
    bubbleEl.querySelector('.tour-btn-prev')?.addEventListener('click', prev);
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Rendera ett steg ────────────────────────────────────── */
  function renderStep() {
    clearWaitTimer();
    const step = getStep();
    if (!step) { end(); return; }

    if (typeof step.waitFor === 'function' && !step.waitFor()) {
      overlayEl.classList.add('tour-waiting');
      waitTimer = setInterval(function () {
        if (step.waitFor()) {
          clearWaitTimer();
          overlayEl.classList.remove('tour-waiting');
          renderStep();
        }
      }, 300);
      return;
    }

    const targetEl = document.getElementById(step.targetId);
    if (!targetEl) {
      currentStepIdx++;
      if (currentStepIdx >= getTotalSteps()) { end(); return; }
      renderStep();
      return;
    }

    targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    requestAnimationFrame(function () {
      const rect = getRect(targetEl);
      positionSpotlight(rect);
      renderBubble(step);
      overlayEl.classList.add('tour-active');
      requestAnimationFrame(function () {
        positionBubble(rect, step.position || 'bottom');
      });

      if (typeof step.onEnter === 'function') step.onEnter(targetEl);
    });
  }

  function clearWaitTimer() {
    if (waitTimer) { clearInterval(waitTimer); waitTimer = null; }
  }

  /* ── Navigering ──────────────────────────────────────────── */
  function next() {
    currentStepIdx++;
    if (currentStepIdx >= getTotalSteps()) {
      end();
    } else {
      renderStep();
    }
  }

  function prev() {
    if (currentStepIdx > 0) {
      currentStepIdx--;
      renderStep();
    }
  }

  /* ── Start / slut ────────────────────────────────────────── */
  function start(tourId) {
    const tour = TOURS[tourId];
    if (!tour) { console.warn('[SpotOnTour] Okänd tour:', tourId); return; }

    if (active) end();

    // ── Anpassa kart-touren efter uppdragsläge ───────────────
    if (tourId === 'map') {
      const mode = getMode();
      if (mode === 'mystery') {
        // Mordgåta: basssteg + extra steg om Utredning-fliken
        TOURS.map.steps = MAP_STEPS_BASE.concat(MAP_STEPS_MYSTERY_EXTRA);
      } else {
        // Tipspromenad + fritt utforskande: bara basstegen
        TOURS.map.steps = MAP_STEPS_BASE;
      }
    }

    buildDOM();

    currentTourId  = tourId;
    currentStepIdx = 0;
    active         = true;

    overlayEl.classList.remove('tour-active');
    overlayEl.style.display = 'block';

    renderStep();
  }

  function end() {
    clearWaitTimer();
    active = false;
    if (overlayEl) {
      overlayEl.classList.remove('tour-active', 'tour-waiting');
      overlayEl.style.display = 'none';
    }
    const tour = TOURS[currentTourId];
    if (tour) markSeen(tour.storageKey);
    currentTourId  = null;
    currentStepIdx = 0;
    document.removeEventListener('keydown', onKeyDown);
  }

  /* ── Responsiv omritning ─────────────────────────────────── */
  window.addEventListener('resize', function () {
    if (!active) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderStep, 150);
  });

  /* ── Auto-start vid vybyte ───────────────────────────────── */
  const bodyObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.attributeName === 'data-view') {
        handleViewChange(document.body.getAttribute('data-view'));
      }
    });
  });
  bodyObserver.observe(document.body, { attributes: true });

  function handleViewChange(view) {
    setTimeout(function () {
      if (view === 'map'  && !hasSeen(TOURS.map.storageKey))  start('map');
      if (view === 'code' && !hasSeen(TOURS.code.storageKey)) start('code');
    }, 800);
  }

  /* ── Publik API ──────────────────────────────────────────── */
  window.SpotOnTour = {
    start : start,
    end   : end,
    next  : next,
    prev  : prev,
    reset : function (tourId) {
      if (tourId) {
        const t = TOURS[tourId];
        if (t) { try { localStorage.removeItem(t.storageKey); } catch (_) {} }
      } else {
        Object.values(TOURS).forEach(function (t) {
          try { localStorage.removeItem(t.storageKey); } catch (_) {}
        });
      }
    },
    tours : Object.keys(TOURS)
  };

}());