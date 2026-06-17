// =============================================================
// src/middleware/csrf.js  (v2)
// Sessionsbaserat CSRF-skydd (synchronizer token pattern).
//
// VIKTIG ÄNDRING mot v1: token genereras nu LAT — först när
// req.csrfToken() faktiskt anropas (admin-vyer) eller när en
// muterande admin-request ska verifieras. v1 satte token på varje
// request, vilket modifierade sessionen och fick express-session
// att spara en rad i admin_sessions för VARJE anonym besökare
// och varje PWA-API-anrop, trots saveUninitialized: false.
// Med v2 lämnas spelarnas requests helt orörda.
// =============================================================

'use strict';

const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PROTECTED_PREFIXES = ['/admin', '/superadmin'];

function timingSafeMatch(sent, expected) {
  if (typeof sent !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function ensureToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function createCsrfMiddleware() {
  return function csrf(req, res, next) {
    // Kräver att express-session körts före denna middleware.
    if (!req.session) return next();

    // LAT generering — sessionen rörs inte förrän en vy faktiskt
    // ber om en token. Publika API-anrop skapar därmed aldrig
    // sessionsrader.
    req.csrfToken = () => ensureToken(req);

    // Läsande metoder verifieras aldrig.
    if (SAFE_METHODS.has(req.method)) return next();

    // Verifiera endast skyddade prefix (admin-gränssnitten).
    // Spelets API:er (/api/v1, /live, /results) berörs inte —
    // de autentiseras med egna tokens.
    const isProtected = PROTECTED_PREFIXES.some(
      (p) => req.path === p || req.path.startsWith(p + '/')
    );
    if (!isProtected) return next();

    const sent =
      (req.body && req.body._csrf) ||
      req.get('x-csrf-token') ||
      (req.query && req.query._csrf) ||
      '';

    if (timingSafeMatch(sent, ensureToken(req))) return next();

    // Ogiltig/saknad token.
    const wantsJson =
      req.xhr ||
      (req.get('accept') || '').includes('application/json') ||
      (req.get('content-type') || '').includes('application/json');

    if (wantsJson) {
      return res.status(403).json({
        error: 'Ogiltig eller saknad CSRF-token. Ladda om sidan och försök igen.',
      });
    }

    return res.status(403).render('admin/pages/error', {
      title: 'Åtgärden blockerades',
      message:
        'Formulärets säkerhetstoken var ogiltig eller har gått ut. ' +
        'Gå tillbaka, ladda om sidan och försök igen.',
      stack: null,
      detail: null,
    });
  };
}

module.exports = { createCsrfMiddleware };
