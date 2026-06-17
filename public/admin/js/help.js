// =============================================================
// public/admin/js/help.js
// Hjälptexter för admin — visas som tooltip vid hover på ?-ikoner
// Injiceras på alla sidor via script-tag i footer
// Ingen befintlig funktionalitet påverkas
// =============================================================

(function() {

  // ── Tooltip-stil ──────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .help-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #94a3b8;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      cursor: help;
      margin-left: 5px;
      position: relative;
      vertical-align: middle;
      flex-shrink: 0;
      user-select: none;
    }
    .help-icon:hover { background: #3b82f6; }
    .help-tooltip {
      display: none;
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #f1f5f9;
      font-size: 12px;
      font-weight: 400;
      line-height: 1.5;
      padding: 8px 12px;
      border-radius: 8px;
      width: 240px;
      white-space: normal;
      z-index: 9999;
      box-shadow: 0 4px 20px rgba(0,0,0,.35);
      pointer-events: none;
    }
    .help-tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: #0f172a;
    }
    .help-icon:hover .help-tooltip { display: block; }
  `;
  document.head.appendChild(style);

  // ── Skapa hjälpikon ───────────────────────────────────────
  function helpIcon(text) {
    const span = document.createElement('span');
    span.className = 'help-icon';
    span.textContent = '?';
    const tip = document.createElement('span');
    tip.className = 'help-tooltip';
    tip.textContent = text;
    span.appendChild(tip);
    return span;
  }

  // ── Lägg till hjälpikon efter ett element ─────────────────
  function addHelp(selector, text) {
    document.querySelectorAll(selector).forEach(el => {
      // Undvik dubbletter
      if (el.parentNode.querySelector('.help-icon')) return;
      el.parentNode.insertBefore(helpIcon(text), el.nextSibling);
    });
  }

  // ── Lägg till hjälpikon efter label-text ─────────────────
  function addHelpToLabel(labelText, helpText) {
    document.querySelectorAll('label').forEach(label => {
      if (label.querySelector('.help-icon')) return;
      if (label.textContent.trim().startsWith(labelText)) {
        label.appendChild(helpIcon(helpText));
      }
    });
  }

  // ── Kör efter att DOM är klar ─────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {

    const path = window.location.pathname;

    // ── Uppdragsformulär (/admin/assignments/new eller /edit) ─
    if (path.includes('/assignments') && (path.includes('/edit') || path.endsWith('/new'))) {

      addHelpToLabel('Titel', 'Uppdragets namn som visas för användaren i appen.');

      addHelpToLabel('Beskrivning', 'Kort beskrivning av uppdraget. Visas på startskärmen i appen innan användaren börjar.');

      addHelpToLabel('Typ', [
        'Utforskning: Användaren utforskar platser och tar del av information — inga frågor.',
        'Tipspromenad: Platser har frågor och poängsättning.',
        'Gåta: Mordgåta eller skattjakt med ledtrådar och lösningar.'
      ].join(' '));

      addHelpToLabel('Åtkomstkod', 'Den kod användaren skriver in i appen för att starta uppdraget. Måste vara unik. Kan också skannas via QR-kod.');

      addHelpToLabel('Svårighetsgrad', 'Visas som information i appen. Påverkar inte funktionaliteten.');

      addHelpToLabel('Uppskattad tid', 'Ungefär hur lång tid uppdraget tar i minuter. Visas i appen.');

      addHelpToLabel('Ordning', 'Fri: Användaren kan besöka platser i valfri ordning. Linjär: Platser måste besökas i den ordning du anger.');

      addHelpToLabel('Poängsättning', 'Auto: Rätt svar visas direkt efter varje fråga. Insamlad: Alla svar samlas och visas i slutet.');

      addHelpToLabel('Max antal deltagare', 'Begränsa hur många som kan starta uppdraget. Lämna tomt för obegränsat antal.');

      addHelpToLabel('Startar', 'Datum och tid när uppdraget blir tillgängligt. Lämna tomt om det ska vara tillgängligt direkt.');

      addHelpToLabel('Slutar', 'Datum och tid när uppdraget stängs. Lämna tomt om det aldrig ska stängas.');

      addHelpToLabel('Status', 'Utkast: Syns inte i appen. Publicerat: Kan nås med åtkomstkoden.');
    }

    // ── Uppdragslista (/admin/assignments) ───────────────────
    if (path === '/admin/assignments') {
      // Hjälp vid rubriken
      const h1 = document.querySelector('.page-header h1');
      if (h1 && !h1.querySelector('.help-icon')) {
        h1.appendChild(helpIcon('Här hanterar du alla uppdrag. Klicka på "Platser →" för att lägga till platser i ett uppdrag. Klicka på "Redigera" för att ändra inställningar.'));
      }
    }

    // ── Platslista (/admin/assignments/:id/places) ────────────
    if (path.includes('/assignments/') && path.endsWith('/places')) {
      const h1 = document.querySelector('.page-header h1');
      if (h1 && !h1.querySelector('.help-icon')) {
        h1.appendChild(helpIcon('Här ser du alla platser i uppdraget. Klicka på "Innehåll" för att lägga till text, bilder, video, ljud eller AR. Klicka på "Redigera" för att ändra platsens koordinater och inställningar.'));
      }

      // QR-knappen
      document.querySelectorAll('button').forEach(btn => {
        if (btn.textContent.includes('QR-kod') && !btn.parentNode.querySelector('.help-icon')) {
          btn.insertAdjacentElement('afterend', helpIcon('Genererar en QR-kod för uppdraget. Användaren skannar koden med SpotOn-appen och startar uppdraget direkt — utan att behöva skriva koden manuellt.'));
        }
      });
    }

    // ── Innehållsblock (/admin/content/:id) ──────────────────
    if (path.startsWith('/admin/content/')) {

      // Typ-väljaren
      const typeSelect = document.getElementById('block-type-select');
      if (typeSelect && !typeSelect.parentNode.querySelector('.help-icon')) {
        typeSelect.insertAdjacentElement('afterend', helpIcon(
          'Text: Ren information. ' +
          'Bild: Visa en bild. ' +
          'Video: Spela upp en video. ' +
          'Ljud: Spela upp ett ljudklipp. ' +
          'AR-overlay: Visar en bild i AR-kameran när användaren är på platsen. ' +
          'Fråga: Flervalsfråga för tipspromenader. ' +
          'Ledtråd: Dold ledtråd för gåtor. ' +
          'Lösning: Fritextsvar för gåtor.'
        ));
      }

      // Ordning
      addHelpToLabel('Ordning', 'Bestämmer i vilken ordning blocken visas. Lägre siffra visas först. Första blocket visas alltid — även när platsen är låst.');

      // AR-inställningar
      addHelpToLabel('Opacitet', 'Hur genomskinlig AR-bilden ska vara. 1.0 = helt opak, 0.05 = nästan osynlig. Användaren kan justera detta i appen.');

      addHelpToLabel('Rotation', 'Rotera bilden om den laddades upp i fel orientering.');

      addHelpToLabel('Dold', 'Om ikryssad visas ledtråden inte direkt — användaren måste trycka "Visa ledtråd" för att se den.');

      addHelpToLabel('Rätt svar', 'Det svar användaren måste ange för att få poäng. Jämförelsen är inte skiftlägeskänslig.');

      // Redigera-knapparna
      document.querySelectorAll('.btn-ghost.btn-sm').forEach(btn => {
        if (btn.textContent.trim() === 'Redigera' && btn.onclick === null) {
          if (!btn.nextElementSibling || !btn.nextElementSibling.classList.contains('help-icon')) {
            btn.insertAdjacentElement('afterend', helpIcon('Öppnar ett redigeringsformulär direkt under blocket. Ändra ordning, text eller inställningar och klicka Spara.'));
          }
        }
      });
    }

  });

})();