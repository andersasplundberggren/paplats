/**
 * Lägg till dessa rader i src/app.js (backend), direkt efter den befintliga /app-raden.
 * Befintlig app rörs INTE.
 *
 * Hitta: app.use('/app', express.static(webappPath, { index: false }));
 * Lägg till EFTER:
 */

// Ny PWA "På plats" — serveras från /app/pwa/
app.use('/app/pwa', express.static(path.join(__dirname, '..', 'webapp', 'pwa'), { index: false }));

app.get(['/app/pwa', '/app/pwa/'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'webapp', 'pwa', 'index.html'));
});

// SPA fallback för /app/pwa/* (inga filändelser)
app.get(/^\/app\/pwa\/(?!.*\.[a-zA-Z0-9]+$).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'webapp', 'pwa', 'index.html'));
});

/**
 * Mapp på servern att skapa:
 *   mkdir -p /home/pixelwor/api.pixelworks.se/geoexp/webapp/pwa
 *
 * Filer att ladda upp till webapp/pwa/:
 *   index.html
 *   app.js
 *   app.css
 *   config.js
 *   sw.js
 *   manifest.webmanifest
 *
 * Starta om Node efter ändringen i src/app.js:
 *   touch /home/pixelwor/api.pixelworks.se/geoexp/tmp/restart.txt
 *
 * URL: https://api.pixelworks.se/app/pwa/
 */
