'use strict';

require('dotenv').config();

const express      = require('express');
const path         = require('path');
const session      = require('express-session');
const MySQLStore   = require('express-mysql-session')(session);
const cookieParser = require('cookie-parser');
const flash        = require('connect-flash');
const { createCsrfMiddleware } = require('./middleware/noCSRF');

const app = express();

// ─── CORS ────────────────────────────────────────────────────
const allowedOrigins = [
  'https://api.pixelworks.se',
  'https://plats.pixelworks.se',
  'https://paplats.pixelworks.se',
];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
// ─────────────────────────────────────────────────────────────
const webappPath = path.join(__dirname, '..', 'webapp');

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/static', express.static(path.join(__dirname, '..', 'public')));
app.use('/media',  express.static(process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads')));

/*
  PWA under /app
  index:false gör att vi själva styr när index.html ska returneras.
*/
app.use('/app', express.static(webappPath, { index: false }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// ─── Rate limiting ────────────────────────────────────────────
const rateLimit = require('express-rate-limit');

app.use('/admin/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'För många inloggningsförsök. Försök igen om 15 minuter.' }
}));

app.use('/api/v1', rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'För många förfrågningar.' }
}));
// ─────────────────────────────────────────────────────────────

app.use(cookieParser());

const sessionStore = new MySQLStore({
  host:                    process.env.DB_HOST || '127.0.0.1',
  port:                    parseInt(process.env.DB_PORT, 10) || 3306,
  user:                    process.env.DB_USER,
  password:                process.env.DB_PASSWORD,
  database:                process.env.DB_NAME,
  clearExpired:            true,
  checkExpirationInterval: 900000,
  expiration:              86400000,
  createDatabaseTable:     true,
  schema: { tableName: 'admin_sessions' },
});

sessionStore.on('error', (err) => console.error('[SessionStore]', err.message));

app.use(session({
  key:               'geoexp.sid',
  secret:            process.env.SESSION_SECRET || 'change-me',
  store:             sessionStore,
  resave:            true,
  saveUninitialized: false,
  rolling:           true,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   parseInt(process.env.SESSION_MAX_AGE_MS, 10) || 24 * 60 * 60 * 1000,
  },
}));

app.use(flash());
app.use(createCsrfMiddleware());

// Globala locals
app.use((req, res, next) => {
  res.locals.csrfToken       = req.csrfToken ? req.csrfToken() : '';
  res.locals.isImpersonating = req.session.isImpersonating || false;
  res.locals.tenantName      = req.session.tenantName || null;
  res.locals.superAdminName  = req.session.superAdminName || null;
  res.locals.adminRole       = req.session.adminRole || null;
  res.locals.adminName       = req.session.adminName || null;
  next();
});

function safeRequire(routePath, mountPoint) {
  try {
    return require(routePath);
  } catch (err) {
    console.error(`[App] Route saknas "${mountPoint}": ${err.message}`);
    const stub = express.Router();
    stub.use((req, res) => res.status(503).render('admin/pages/error', {
      title: 'Route saknas',
      message: `"${mountPoint}" kunde inte laddas.`,
      stack: err.message,
      detail: null,
    }));
    return stub;
  }
}

// Publika API v1
app.use('/api/v1/assignments', safeRequire('./routes/api/v1/assignments', '/api/v1/assignments'));
app.use('/api/v1/sessions',    safeRequire('./routes/api/v1/sessions', '/api/v1/sessions'));
app.use('/api/v1/events',      safeRequire('./routes/api/v1/events', '/api/v1/events'));
app.use('/api/v1/groups',      safeRequire('./routes/api/v1/groups', '/api/v1/groups'));

// Publik resultatsida
app.use('/results', safeRequire('./routes/public/results', '/results'));

// Publik live-vy (ingen inloggning — token i URL)
app.use('/live', safeRequire('./routes/public/live', '/live'));

// Systemadmin
const { requireSuperAdmin } = require('./middleware/superadmin');
app.use('/superadmin', safeRequire('./routes/superadmin/auth', '/superadmin/login'));
app.use('/superadmin', requireSuperAdmin, safeRequire('./routes/superadmin/dashboard', '/superadmin/dashboard'));
app.use('/superadmin/tenants', requireSuperAdmin, safeRequire('./routes/superadmin/tenants', '/superadmin/tenants'));
app.use('/superadmin/admins', requireSuperAdmin, safeRequire('./routes/superadmin/admins', '/superadmin/admins'));

// Admin
app.use('/admin',             safeRequire('./routes/admin/auth', '/admin/login'));
app.use('/admin',             safeRequire('./routes/admin/dashboard', '/admin/dashboard'));
app.use('/admin/assignments', safeRequire('./routes/admin/assignments', '/admin/assignments'));
app.use('/admin/places',      safeRequire('./routes/admin/places', '/admin/places'));
app.use('/admin/content',     safeRequire('./routes/admin/content', '/admin/content'));
app.use('/admin/media',       safeRequire('./routes/admin/media', '/admin/media'));
app.use('/admin/editors',     safeRequire('./routes/admin/editors', '/admin/editors'));
app.use('/admin/categories',  safeRequire('./routes/admin/categories', '/admin/categories'));
app.use('/admin/events',      safeRequire('./routes/admin/events', '/admin/events'));

// Preview-sida för admin — orörd
app.get(['/app/preview', '/app/preview/'], (req, res) => {
  res.sendFile(path.join(webappPath, 'preview', 'index.html'));
});

// ─── NY: På plats PWA (/app/pwa/) ────────────────────────────────────────────
app.use('/app/pwa', express.static(path.join(webappPath, 'pwa'), { index: false }));
app.get(['/app/pwa', '/app/pwa/'], (req, res) => {
  res.sendFile(path.join(webappPath, 'pwa', 'index.html'));
});
app.get(/^\/app\/pwa\/(?!.*\.[a-zA-Z0-9]+$).*/, (req, res) => {
  res.sendFile(path.join(webappPath, 'pwa', 'index.html'));
});
// ─────────────────────────────────────────────────────────────────────────────

// ─── TEST-miljö för nytt UI (/app/test/) ─────────────────────────────────────
app.use('/app/test', express.static(path.join(webappPath, 'test'), { index: false }));
app.get(['/app/test', '/app/test/'], (req, res) => {
  res.sendFile(path.join(webappPath, 'test', 'index.html'));
});
app.get(/^\/app\/test\/(?!.*\.[a-zA-Z0-9]+$).*/, (req, res) => {
  res.sendFile(path.join(webappPath, 'test', 'index.html'));
});
// ─────────────────────────────────────────────────────────────────────────────

// Befintlig PWA entry — ORÖRD
// /app och /app/ returnerar webapp/index.html (den gamla appen)
app.get(['/app', '/app/'], (req, res) => {
  res.sendFile(path.join(webappPath, 'index.html'));
});

// SPA fallback för /app/* — ORÖRD
// Fångar bara vägar utan filändelse, så riktiga statiska filer serveras normalt.
app.get(/^\/app\/(?!.*\.[a-zA-Z0-9]+$).*/, (req, res) => {
  res.sendFile(path.join(webappPath, 'index.html'));
});

app.get('/', (req, res) => res.redirect('/admin/login'));

app.use((req, res) => res.status(404).render('admin/pages/error', {
  title: '404',
  message: `Sidan hittades inte: ${req.path}`,
  stack: null,
  detail: null,
}));

app.use((err, req, res, next) => {
  console.error('[App]', err);
  try {
    res.status(err.status || 500).render('admin/pages/error', {
      title: 'Fel',
      message: err.message || 'Ett oväntat fel inträffade.',
      stack: err.stack || null,
      detail: null,
    });
  } catch (e) {
    res.status(500).send(`<pre>${err.message}\n${err.stack}</pre>`);
  }
});

module.exports = app;