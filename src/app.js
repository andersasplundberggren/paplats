'use strict';

require('dotenv').config();

const express      = require('express');
const path         = require('path');
const helmet       = require('helmet');
const session      = require('express-session');
const MySQLStore   = require('express-mysql-session')(session);
const cookieParser = require('cookie-parser');
const flash        = require('connect-flash');
const rateLimit    = require('express-rate-limit');
const { createCsrfMiddleware } = require('./middleware/csrf');

const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Fail fast: SESSION_SECRET måste finnas ──────────────────
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error('[App] SESSION_SECRET saknas eller är kortare än 32 tecken.');
  console.error('[App] Generera en med:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}

const app = express();

// ─── Säkerhetsheaders (helmet) ───────────────────────────────
// Globalt: alla headers UTOM CSP. PWA:n har en kartvy som laddar
// tiles/resurser från externa källor — en global CSP med
// img-src 'self' skulle blockera kartan.
app.use(helmet({
  contentSecurityPolicy: false,
  // /media och /app konsumeras från PWA-domänerna — tillåt
  // cross-origin-läsning av resurser.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Strikt CSP endast på admin-ytorna och live-vyn (de laddar bara
// egna resurser). Spelet (/app, /api, /results) lämnas utan CSP.
const adminCsp = helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    // Admin-vyerna innehåller inline-script/-style; tillåts tills
    // de flyttats till externa filer. Strama åt när det är gjort.
    scriptSrc:  ["'self'", "'unsafe-inline'"],
    styleSrc:   ["'self'", "'unsafe-inline'"],
    imgSrc:     ["'self'", 'data:', 'blob:'],
    mediaSrc:   ["'self'", 'blob:'],
    connectSrc: ["'self'"],
    frameAncestors: ["'self'"],
  },
});
app.use(['/admin', '/superadmin', '/live'], adminCsp);

// ─── CORS — endast spelets publika vägar, utan cookies ───────
// PWA:n (plats/paplats.pixelworks.se) autentiserar med
// session_token, inte cookies. Credentials skickas därför inte,
// och admin-/superadmin-vägarna omfattas inte alls.
const allowedOrigins = [
  'https://api.pixelworks.se',
  'https://plats.pixelworks.se',
  'https://paplats.pixelworks.se',
];
const corsPaths = ['/api/v1', '/live', '/results', '/media'];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const corsEligible = corsPaths.some(
    (p) => req.path === p || req.path.startsWith(p + '/')
  );
  if (origin && allowedOrigins.includes(origin) && corsEligible) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
// ─────────────────────────────────────────────────────────────
const webappPath = path.join(__dirname, '..', 'webapp');

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Styr om felsidan får visa stack traces (endast utanför produktion).
app.locals.showStack = !IS_PROD;

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
// OBS spel-API:t: deltagare på t.ex. skol-/event-WiFi delar ofta
// EN publik IP. Med polling av grupp + topplista var 5–10:e sekund
// plus progress-anrop slår en hel klass lätt i taket på 60/min.
// Gränsen är därför höjd och kompletterad med en separat, snäv
// limiter på just sessionsstart (skydd mot spam som fyller
// max_participants).

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'För många inloggningsförsök. Försök igen om 15 minuter.' },
});

app.use('/admin/login', loginLimiter);

app.use('/superadmin/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'För många inloggningsförsök. Försök igen om 15 minuter.' },
}));

// Snäv limiter: att STARTA sessioner är ovanligt (en gång per spelare).
app.post('/api/v1/sessions', rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_SESSION_START, 10) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'För många nya sessioner. Vänta en stund och försök igen.' },
}), (req, res, next) => next());

// Generös limiter för spelets löpande trafik (NAT-delade IP:n).
app.use('/api/v1', rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_API_PER_MIN, 10) || 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'För många förfrågningar.' },
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
  secret:            process.env.SESSION_SECRET,
  store:             sessionStore,
  resave:            false,
  saveUninitialized: false,
  rolling:           true,
  cookie: {
    secure:   IS_PROD,
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   parseInt(process.env.SESSION_MAX_AGE_MS, 10) || 24 * 60 * 60 * 1000,
  },
}));

app.use(flash());
app.use(createCsrfMiddleware());

// Globala locals.
// OBS: res.locals.csrfToken sätts endast för admin-ytorna —
// att anropa req.csrfToken() skapar en session (lat generering),
// och det ska inte ske för spelares API-anrop.
app.use((req, res, next) => {
  const isAdminArea =
    req.path === '/admin' || req.path.startsWith('/admin/') ||
    req.path === '/superadmin' || req.path.startsWith('/superadmin/');

  res.locals.csrfToken       = isAdminArea && req.csrfToken ? req.csrfToken() : '';
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
    if (IS_PROD) {
      console.error(`[App] FATAL: Route "${mountPoint}" kunde inte laddas: ${err.message}`);
      process.exit(1);
    }
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

// ─── På plats PWA (/app/pwa/) ────────────────────────────────
app.use('/app/pwa', express.static(path.join(webappPath, 'pwa'), { index: false }));
app.get(['/app/pwa', '/app/pwa/'], (req, res) => {
  res.sendFile(path.join(webappPath, 'pwa', 'index.html'));
});
app.get(/^\/app\/pwa\/(?!.*\.[a-zA-Z0-9]+$).*/, (req, res) => {
  res.sendFile(path.join(webappPath, 'pwa', 'index.html'));
});
// ─────────────────────────────────────────────────────────────

// ─── TEST-miljö för nytt UI (/app/test/) ─────────────────────
app.use('/app/test', express.static(path.join(webappPath, 'test'), { index: false }));
app.get(['/app/test', '/app/test/'], (req, res) => {
  res.sendFile(path.join(webappPath, 'test', 'index.html'));
});
app.get(/^\/app\/test\/(?!.*\.[a-zA-Z0-9]+$).*/, (req, res) => {
  res.sendFile(path.join(webappPath, 'test', 'index.html'));
});
// ─────────────────────────────────────────────────────────────

// Befintlig PWA entry — ORÖRD
app.get(['/app', '/app/'], (req, res) => {
  res.sendFile(path.join(webappPath, 'index.html'));
});

// SPA fallback för /app/* — ORÖRD
app.get(/^\/app\/(?!.*\.[a-zA-Z0-9]+$).*/, (req, res) => {
  res.sendFile(path.join(webappPath, 'index.html'));
});

app.get('/', (req, res) => res.redirect('/admin/login'));

app.use((req, res) => {
  // API-vägar ska få JSON, inte en HTML-sida.
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Hittades inte.' });
  }
  res.status(404).render('admin/pages/error', {
    title: '404',
    message: 'Sidan hittades inte.',
    stack: null,
    detail: null,
  });
});

app.use((err, req, res, next) => {
  console.error('[App]', err);
  const status = err.status || 500;

  // API-vägar ska få JSON även vid fel.
  if (req.path.startsWith('/api/')) {
    return res.status(status).json({
      error: IS_PROD ? 'Serverfel.' : (err.message || 'Serverfel.'),
    });
  }

  try {
    res.status(status).render('admin/pages/error', {
      title: 'Fel',
      message: IS_PROD
        ? 'Ett oväntat fel inträffade. Försök igen eller kontakta support.'
        : (err.message || 'Ett oväntat fel inträffade.'),
      stack: IS_PROD ? null : (err.stack || null),
      detail: null,
    });
  } catch (e) {
    res.status(500).send(IS_PROD
      ? 'Ett oväntat fel inträffade.'
      : `<pre>${err.message}\n${err.stack}</pre>`);
  }
});

module.exports = app;
