// =============================================================
// src/routes/superadmin/auth.js
// Inloggning/utloggning och impersonering för superadmins.
//
// Ändringar i denna version:
// 1. Äkta dummy-hash (fullt bcrypt-arbete även för okända konton).
// 2. Impersonering sätter nu adminRole — utan den blockerades
//    superadmin av requireTenantAdmin och behandlades som
//    redaktör i uppdragslistningen.
// 3. Impersonering nekas för inaktiva tenants.
// 4. stop-impersonating rensar nu ALLA admin-fält (även
//    adminRole och adminEmail som tidigare låg kvar).
// =============================================================

'use strict';

const express   = require('express');
const bcrypt    = require('bcryptjs');
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');
const { queryOne } = require('../../config/database');

const router = express.Router();

const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /superadmin/login
router.get('/login', (req, res) => {
  if (req.session && req.session.superAdminId) {
    return res.redirect('/superadmin/dashboard');
  }
  res.render('superadmin/pages/login', {
    title:     'Superadmin — Logga in',
    error:     req.flash('error')[0] || null,
    csrfToken: req.csrfToken(),
  });
});

// POST /superadmin/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    req.flash('error', 'Fyll i e-post och lösenord.');
    return res.redirect('/superadmin/login');
  }

  try {
    const admin = await queryOne(
      `SELECT id, email, name, password_hash, role
       FROM admins WHERE email = ? AND role = 'superadmin'`,
      [email.trim().toLowerCase()],
    );

    const hash    = admin ? admin.password_hash : DUMMY_HASH;
    const isValid = await bcrypt.compare(password, hash);

    if (!admin || !isValid) {
      req.flash('error', 'Fel e-post eller lösenord.');
      return res.redirect('/superadmin/login');
    }

    req.session.regenerate((err) => {
      if (err) {
        console.error('[SuperAdmin] Session regenerate error:', err);
        req.flash('error', 'Inloggningen misslyckades. Försök igen.');
        return res.redirect('/superadmin/login');
      }
      req.session.superAdminId    = admin.id;
      req.session.superAdminName  = admin.name;
      req.session.superAdminEmail = admin.email;
      req.session.isSuperAdmin    = true;
      return res.redirect('/superadmin/dashboard');
    });
  } catch (err) {
    console.error('[SuperAdmin] Login error:', err);
    req.flash('error', 'Ett oväntat fel inträffade.');
    return res.redirect('/superadmin/login');
  }
});

// POST /superadmin/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('[SuperAdmin] Session destroy error:', err);
    res.clearCookie('geoexp.sid');
    res.redirect('/superadmin/login');
  });
});

// POST /superadmin/impersonate/:adminId
router.post('/impersonate/:adminId(\\d+)', async (req, res) => {
  if (!req.session.isSuperAdmin) {
    return res.status(403).send('Ej behörig.');
  }
  const { adminId } = req.params;
  try {
    const admin = await queryOne(
      `SELECT a.id, a.email, a.name, a.role, a.tenant_id,
              t.name AS tenant_name, t.status AS tenant_status
       FROM admins a
       LEFT JOIN tenants t ON t.id = a.tenant_id
       WHERE a.id = ? AND a.role = 'admin'`,
      [adminId],
    );
    if (!admin) return res.status(404).send('Admin hittades inte.');

    // NYTT: impersonera inte konton i inaktiva tenants.
    if (admin.tenant_id && admin.tenant_status !== 'active') {
      req.flash('error', 'Tenanten är inaktiv — impersonering nekad.');
      return res.redirect('/superadmin/admins');
    }

    // Spara superadmin-info och sätt impersonering
    req.session.adminId          = admin.id;
    req.session.adminName        = admin.name;
    req.session.adminEmail       = admin.email;
    req.session.adminRole        = admin.role;   // NYTT — krävs av admin-routes
    req.session.tenantId         = admin.tenant_id;
    req.session.tenantName       = admin.tenant_name;
    req.session.isImpersonating  = true;
    req.session.realSuperAdminId = req.session.superAdminId;

    return res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('[SuperAdmin] Impersonate error:', err);
    return res.redirect('/superadmin/admins');
  }
});

// POST /superadmin/stop-impersonating
router.post('/stop-impersonating', (req, res) => {
  if (!req.session.isImpersonating) {
    return res.redirect('/superadmin/dashboard');
  }
  // Rensa ALLA tenant-admin-fält men behåll superadmin-data
  delete req.session.adminId;
  delete req.session.adminName;
  delete req.session.adminEmail;
  delete req.session.adminRole;
  delete req.session.tenantId;
  delete req.session.tenantName;
  delete req.session.isImpersonating;
  delete req.session.realSuperAdminId;
  return res.redirect('/superadmin/dashboard');
});

module.exports = router;
