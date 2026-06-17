/**
 * På plats — PWA konfiguration
 * Placeras i: webapp/pwa/config.js
 *
 * Läses in före app.js i index.html.
 * Ändra aldrig API-nycklar eller hemligheter här — filen är publik.
 */
window.PAPLATS_CONFIG = {
  appName: 'På plats',
  version: '1.0.0',

  // Samma backend som befintlig app
  apiBaseUrl: '/api/v1',
  mediaBaseUrl: '',           // tom = relativ till domänen, t.ex. /media/…

  map: {
    tileUrlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    defaultZoom: 15,
    minZoom: 3,
    maxZoom: 18,
    // Avståndsgränser (meter)
    nearDistanceMeters: 120,   // "nära" — markör lyser upp
    closeDistanceMeters: 40,   // "på plats" — innehåll låses upp
  },

  // Geolocation
  geo: {
    highAccuracy: true,
    timeout: 12000,
    maximumAge: 5000,
    watchInterval: 4000,       // ms mellan manuella poll (fallback)
  },

  // Lokal cache (localStorage-nycklar)
  storage: {
    sessionKey:    'paplats_session',
    assignmentKey: 'paplats_assignment',
    progressKey:   'paplats_progress',
    notesKey:      'paplats_notes',
    cluesKey:      'paplats_clues',
  },
};