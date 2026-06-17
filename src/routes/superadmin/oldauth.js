'use strict';

const express   = require('express');
const bcrypt    = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { queryOne } = require('../../config/database');

const router = express.Router();

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

    const hash    = admin ? admin.password_hash : '$2a$12$invalidsaltinvalidsalt.invalidsalt';
    const isValid = await bcrypt.compare(password, hash);

    if (!admin || !isValid) {
      req.flash('error', 'Fel e-post eller lösenord.');
      return res.redirect('/superadmin/login');
    }

    req.session.regenerate((err) => {
      if (err) {
        req.flash('error', 'Inloggningen misslyckades. Försök igen.');
        return res.redirect('/superadmin/login');
      }
      req.session.superAdminId   = admin.id;
      req.session.superAdminName = admin.name;
      req.session.superAdminEmail = admin.email;
      req.session.isSuperAdmin   = true;
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
  req.session.destroy(() => {
    res.clearCookie('geoexp.sid');
    res.redirect('/superadmin/login');
  });
});

// POST /superadmin/impersonate/:adminId
router.post('/impersonate/:adminId', async (req, res) => {
  if (!req.session.isSuperAdmin) {
    return res.status(403).send('Ej behörig.');
  }
  const { adminId } = req.params;
  try {
    const admin = await queryOne(
      `SELECT a.id, a.email, a.name, a.tenant_id, t.name AS tenant_name
       FROM admins a
       LEFT JOIN tenants t ON t.id = a.tenant_id
       WHERE a.id = ? AND a.role = 'admin'`,
      [adminId],
    );
    if (!admin) return res.status(404).send('Admin hittades inte.');

    // Spara superadmin-info och sätt impersonering
    req.session.adminId          = admin.id;
    req.session.adminName        = admin.name;
    req.session.adminEmail       = admin.email;
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
  // Rensa tenant-admin data men behåll superadmin-data
  req.session.adminId         = undefined;
  req.session.adminName       = undefined;
  req.session.adminEmail      = undefined;
  req.session.tenantId        = undefined;
  req.session.tenantName      = undefined;
  req.session.isImpersonating = undefined;
  return res.redirect('/superadmin/dashboard');
});

module.exports = router;
