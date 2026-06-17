// =============================================================
// src/routes/admin/auth.js
// Inloggning/utloggning för tenant-admins och redaktörer.
//
// Ändringar i denna version:
// 1. Inloggning nekas om tenanten inte är aktiv.
// 2. returnTo fångas FÖRE session.regenerate() (var alltid tom
//    tidigare) och valideras mot open redirect.
// 3. Dummy-hashen är nu en äkta bcrypt-hash så att jämförelsen
//    tar lika lång tid oavsett om kontot finns eller inte.
// =============================================================

'use strict';

const express   = require('express');
const bcrypt    = require('bcryptjs');
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');
const { queryOne } = require('../../config/database');

const router = express.Router();

// Äkta hash av ett slumpvärde — genereras en gång vid uppstart.
// Gör att bcrypt.compare alltid utför fullt cost-12-arbete.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// Tillåt endast interna admin-vägar som retur-mål efter inloggning.
function safeReturnTo(value) {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/admin')) return null;   // endast admin-ytan
  if (value.startsWith('//')) return null;        // skydd mot //evil.com
  if (value.includes('\\')) return null;
  return value;
}

router.get('/login', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/pages/login', {
    title:     'Admin Login',
    error:     req.flash('error')[0] || null,
    csrfToken: req.csrfToken(),
  });
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    req.flash('error', 'Fyll i e-post och lösenord.');
    return res.redirect('/admin/login');
  }

  try {
    const admin = await queryOne(
      `SELECT a.id, a.email, a.name, a.password_hash, a.role, a.tenant_id,
              t.name AS tenant_name, t.status AS tenant_status
       FROM admins a
       LEFT JOIN tenants t ON t.id = a.tenant_id
       WHERE a.email = ? AND a.role IN ('admin','redaktor')`,
      [email.trim().toLowerCase()],
    );

    const hash    = admin ? admin.password_hash : DUMMY_HASH;
    const isValid = await bcrypt.compare(password, hash);

    if (!admin || !isValid) {
      req.flash('error', 'Fel e-post eller lösenord.');
      return res.redirect('/admin/login');
    }

    // NYTT: neka inloggning för inaktiverade tenants.
    if (admin.tenant_id && admin.tenant_status !== 'active') {
      req.flash('error', 'Kontot är inaktiverat. Kontakta support.');
      return res.redirect('/admin/login');
    }

    // Fånga returnTo INNAN sessionen regenereras — annars går värdet
    // förlorat (regenerate skapar en ny, tom session).
    const returnTo = safeReturnTo(req.session.returnTo) || '/admin/dashboard';

    req.session.regenerate((err) => {
      if (err) {
        console.error('[Auth] Session regenerate error:', err);
        req.flash('error', 'Inloggningen misslyckades.');
        return res.redirect('/admin/login');
      }
      req.session.adminId    = admin.id;
      req.session.adminName  = admin.name;
      req.session.adminEmail = admin.email;
      req.session.adminRole  = admin.role;
      req.session.tenantId   = admin.tenant_id;
      req.session.tenantName = admin.tenant_name || null;

      return res.redirect(returnTo);
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    req.flash('error', 'Ett oväntat fel inträffade.');
    return res.redirect('/admin/login');
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('[Auth] Session destroy error:', err);
    res.clearCookie('geoexp.sid');
    res.redirect('/admin/login');
  });
});

module.exports = router;
