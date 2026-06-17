/* ─────────────────────────────────────────────────────────────
   SpotOn — tour.js
   Onscreen spotlight guide system.

   Placera filen i:  webapp/tour.js
   Lägg till i index.html (före </body>):
     <script src="/app/tour.js"></script>

   Starta en tour manuellt (valfritt):
     window.SpotOnTour.start('map');

   Tourerna startas automatiskt när rätt vy visas om
   localStorage-nyckeln för den touren saknas.
   ─────────────────────────────────────────────────────────────*/

(function () {
  'use strict';

  /* ── Konstanter ───────────────────────────────────────────── */
  const STORAGE_PREFIX = 'spoton.tour.';
  const OVERLAY_ID     = 'spoton-tour-overlay';
  const SPOTLIGHT_ID   = 'spoton-tour-spotlight';
  const BUBBLE_ID      = 'spoton-tour-bubble';
  const ARROW_ID       = 'spoton-tour-arrow';

  /* ── Turdefinitioner ─────────────────────────────────────── */
  /*
    Varje steg:
      targetId   – ID på det element som ska lyftas fram
      title      – Rubrik i bubblan
      text       – Förklarande text
      position   – 'top' | 'bottom' | 'left' | 'right' (var bubblan placeras)
      waitFor    – (valfritt) funktion som returnerar true när steget är redo
      onEnter    – (valfritt) callback när steget visas
  */
  const TOURS = {

    /* Startskärmen – codeView */
    code: {
      storageKey: STORAGE_PREFIX + 'code.v1',
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
          text     : 'Lägg till SpotOn på hemskärmen för snabbare åtkomst – fungerar som en app utan att ta lagringsutrymme.',
          position : 'top'
        },
        {
          targetId : 'resetSessionBtn',
          title    : 'Nollställ lokal session',
          text     : 'Rensar sparad data på den här enheten. Använd om appen fastnat eller om du vill börja om.',
          position : 'top'
        }
      ]
    },

    /* Kartvyn – mapView — v2 uppdaterad med nya kompakta knappar */
    map: {
      storageKey: STORAGE_PREFIX + 'map.v2',
      steps: [
        {
          targetId : 'mapCanvas',
          title    : 'Kartan',
          text     : 'Visar din position (blå prick) och uppdragets platser (orangea markörer). Nyp för att zooma, dra för att panorera.',
          position : 'bottom'
        },
        {
          targetId : 'fitAllBtn',
          title    : 'Visa alla platser',
          text     : 'Zoomar ut kartan så att alla platser i uppdraget syns på skärmen.',
          position : 'bottom'
        },
        {
          targetId : 'zoomOutBtn',
          title    : 'Zooma ut',
          text     : 'Zoomar ut ett steg på kartan.',
          position : 'bottom'
        },
        {
          targetId : 'zoomInBtn',
          title    : 'Zooma in',
          text     : 'Zoomar in ett steg på kartan.',
          position : 'bottom'
        },
        {
          targetId : 'locateMeBtn',
          title    : 'Min position',
          text     : 'Centrerar kartan på din nuvarande GPS-position. Kräver att du tillåtit platsåtkomst.',
          position : 'left'
        },
        {
          targetId : 'infoFabBtn',
          title    : 'Info',
          text     : 'Öppnar uppdragets informationstext. Visas bara om uppdraget har en introduktionstext.',
          position : 'left',
          waitFor  : () => !document.getElementById('infoFabBtn')?.classList.contains('hidden')
        },
        {
          targetId : 'toggleListBtn',
          title    : 'Platslista',
          text     : 'Öppnar en lista med alla platser i uppdraget. Tryck på en plats för att öppna dess innehåll.',
          position : 'left'
        },
        {
          targetId : 'notesFabBtn',
          title    : 'Anteckna',
          text     : 'Öppnar anteckningsblocket. Skriv ledtrådar eller vad du vill komma ihåg – sparas automatiskt. Visas bara i mordgåtor.',
          position : 'left',
          waitFor  : () => !document.getElementById('notesFabBtn')?.classList.contains('hidden')
        },
        {
          targetId : 'evidenceFabBtn',
          title    : 'Bevissamling',
          text     : 'Visar alla bevis du hittat under uppdraget. Nya bevis dyker upp här när du besöker platser. Visas bara i mordgåtor.',
          position : 'left',
          waitFor  : () => !document.getElementById('evidenceFabBtn')?.classList.contains('hidden')
        },
        {
          targetId : 'mapStatusText',
          title    : 'Statusrad',
          text     : 'Visar närmaste plats, hur långt bort den är och om du är tillräckligt nära för att låsa upp.',
          position : 'bottom'
        },
        {
          targetId : 'mapCountdown',
          title    : 'Nedräkning',
          text     : 'Visar återstående tid om uppdraget har en tidsgräns.',
          position : 'bottom',
          waitFor  : () => !document.getElementById('mapCountdown')?.classList.contains('hidden')
        },
        {
          targetId : 'leaveAssignmentBtn',
          title    : 'Avsluta uppdrag',
          text     : 'Avslutar och sparar dina framsteg. Du ser din sammanfattning och eventuell poäng.',
          position : 'top'
        }
      ]
    },

    /* Anteckningar och bevis – notesFabBtn */
    notes: {
      storageKey: STORAGE_PREFIX + 'notes.v2',
      steps: [
        {
          targetId : 'notesFabBtn',
          title    : 'Anteckna',
          text     : 'Öppnar ett anteckningsblock. Skriv ledtrådar, lösningsförslag eller vad du vill komma ihåg. Sparas automatiskt.',
          position : 'left'
        },
        {
          targetId : 'evidenceFabBtn',
          title    : 'Bevissamling',
          text     : 'Visar alla bevis du samlat på dig. Varje gång du besöker en plats med bevis läggs de automatiskt till här.',
          position : 'left'
        }
      ]
    }

  };

  /* ── Tillstånd ────────────────────────────────────────────── */
  let active = false;
  let currentTourId  = null;
  let currentStepIdx = 0;
  let resizeTimer    = null;
  let waitTimer      = null;

  /* ── DOM-element (skapas vid start) ─────────────────────── */
  let overlayEl    = null;
  let spotlightEl  = null;
  let bubbleEl     = null;
  let arrowEl      = null;

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
    if (document.getElementById(OVERLAY_ID)) return;

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
    if (e.key === 'Escape') end();
    if (e.key === 'ArrowRight' || e.key === 'Enter') next();
    if (e.key === 'ArrowLeft') prev();
  }

  /* ── Spotlight-positionering ─────────────────────────────── */
  const PAD = 8;

  function getRect(el) {
    const r = el.getBoundingClientRect();
    return {
      top   : r.top    - PAD,
      left  : r.left   - PAD,
      width : r.width  + PAD * 2,
      height: r.height + PAD * 2,
      centerX: r.left + r.width  / 2,
      centerY: r.top  + r.height / 2,
      right : r.right  + PAD,
      bottom: r.bottom + PAD
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
  function start(tourId, opts) {
    opts = opts || {};
    const tour = TOURS[tourId];
    if (!tour) { console.warn('[SpotOnTour] Okänd tour:', tourId); return; }

    if (active) end();

    buildDOM();

    currentTourId  = tourId;
    currentStepIdx = 0;
    active = true;

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
        const view = document.body.getAttribute('data-view');
        handleViewChange(view);
      }
    });
  });
  bodyObserver.observe(document.body, { attributes: true });

  function handleViewChange(view) {
    // Auto-start borttagen — guiden startas enbart manuellt via ?-knappen
  }

  /* ── Publik API ──────────────────────────────────────────── */
  window.SpotOnTour = {
    start   : start,
    end     : end,
    next    : next,
    prev    : prev,
    reset   : function (tourId) {
      if (tourId) {
        const t = TOURS[tourId];
        if (t) { try { localStorage.removeItem(t.storageKey); } catch (_) {} }
      } else {
        Object.values(TOURS).forEach(function (t) {
          try { localStorage.removeItem(t.storageKey); } catch (_) {}
        });
      }
    },
    tours   : Object.keys(TOURS)
  };

}());