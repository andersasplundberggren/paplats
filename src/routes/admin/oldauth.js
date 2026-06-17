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
      `SELECT id, email, name, password_hash, role, tenant_id
       FROM admins
       WHERE email = ? AND role IN ('admin','redaktor')`,
      [email.trim().toLowerCase()],
    );

    const hash    = admin ? admin.password_hash : '$2a$12$invalidsaltinvalidsalt.invalidsalt';
    const isValid = await bcrypt.compare(password, hash);

    if (!admin || !isValid) {
      req.flash('error', 'Fel e-post eller lösenord.');
      return res.redirect('/admin/login');
    }

    let tenantName = null;
    if (admin.tenant_id) {
      const tenant = await queryOne('SELECT name FROM tenants WHERE id = ?', [admin.tenant_id]);
      tenantName = tenant ? tenant.name : null;
    }

    req.session.regenerate((err) => {
      if (err) {
        req.flash('error', 'Inloggningen misslyckades.');
        return res.redirect('/admin/login');
      }
      req.session.adminId    = admin.id;
      req.session.adminName  = admin.name;
      req.session.adminEmail = admin.email;
      req.session.adminRole  = admin.role;
      req.session.tenantId   = admin.tenant_id;
      req.session.tenantName = tenantName;

      const returnTo = req.session.returnTo || '/admin/dashboard';
      delete req.session.returnTo;
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