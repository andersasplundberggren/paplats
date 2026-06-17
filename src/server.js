'use strict';

require('dotenv').config();

const { testConnection, pool } = require('./config/database');
const app  = require('./app');

const PORT = parseInt(process.env.PORT, 10) || 3000;

let server;

async function start() {
  // ── 1. Verifiera databaskoppling ──────────────────────────────
  await testConnection();

  // ── 2. Starta HTTP-server ─────────────────────────────────────
  server = app.listen(PORT, () => {
    console.log('──────────────────────────────────────────');
    console.log(`[Server] GeoExp körs på port ${PORT}`);
    console.log(`[Server] Miljö: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Server] Admin: http://localhost:${PORT}/admin/login`);
    console.log(`[Server] Superadmin: http://localhost:${PORT}/superadmin/login`);
    console.log('──────────────────────────────────────────');
  });

  // Spelarnas progress-anrop är korta — håll keep-alive rimligt
  // så att proxyn (nginx) inte får hängande sockets vid omstart.
  server.keepAliveTimeout = 65000;
  server.headersTimeout   = 66000;
}

// ── Graceful shutdown ────────────────────────────────────────
// Vid deploy/omstart: sluta ta emot nya anslutningar, låt
// pågående requests (t.ex. en spelares svar mitt i en fråga)
// bli klara, stäng sedan databas-poolen. Tvinga avslut efter
// 10 s om något hänger.
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Server] ${signal} mottagen — stänger ner...`);

  const forceExit = setTimeout(() => {
    console.error('[Server] Tvingad avstängning efter 10 s.');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('[Server] HTTP-servern stängd.');
    }
    await pool.end();
    console.log('[Server] Databas-poolen stängd.');
    process.exit(0);
  } catch (err) {
    console.error('[Server] Fel vid nedstängning:', err.message);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Logga oväntade fel i stället för tyst krasch — och stäng
// kontrollerat vid ohanterade exceptions.
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
  shutdown('uncaughtException');
});

start().catch((err) => {
  console.error('[Server] Startup misslyckades:', err.message);
  console.error(err.stack);
  process.exit(1);
});
