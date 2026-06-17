'use strict';

require('dotenv').config();

const { testConnection } = require('./config/database');
const app  = require('./app');

const PORT = parseInt(process.env.PORT, 10) || 3000;

async function start() {
  // ── 1. Verifiera databaskoppling ──────────────────────────────
  // Om DB inte svarar loggas exakt felmeddelande och processen avslutas.
  await testConnection();

  // ── 2. Starta HTTP-server ─────────────────────────────────────
  app.listen(PORT, () => {
    console.log('──────────────────────────────────────────');
    console.log(`[Server] GeoExp körs på port ${PORT}`);
    console.log(`[Server] Miljö: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Server] Admin: http://localhost:${PORT}/admin/login`);
    console.log(`[Server] Superadmin: http://localhost:${PORT}/superadmin/login`);
    console.log('──────────────────────────────────────────');
  });
}

start().catch((err) => {
  console.error('[Server] Startup misslyckades:', err.message);
  console.error(err.stack);
  process.exit(1);
});
