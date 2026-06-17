'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const { query, queryOne } = require('../../config/database');

const router = express.Router();

// GET /superadmin/admins
router.get('/', async (req, res) => {
  try {
    const [admins, tenants] = await Promise.all([
      query(
        `SELECT a.id, a.email, a.name, a.role, a.tenant_id,
                a.created_at, t.name AS tenant_name
         FROM admins a
         LEFT JOIN tenants t ON t.id = a.tenant_id
         ORDER BY a.role ASC, a.created_at DESC`,
      ),
      query('SELECT id, name FROM tenants WHERE status="active" ORDER BY name'),
    ]);

    res.render('superadmin/pages/admins/list', {
      title:   'Administratörer',
      admins,
      tenants,
      success: req.flash('success')[0] || null,
      error:   req.flash('error')[0]   || null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error('[SA Admins] List error:', err);
    res.status(500).render('admin/pages/error', {
      title: 'Fel', message: err.message, stack: err.stack, detail: null,
    });
  }
});

// POST /superadmin/admins — skapa ny admin
router.post('/', async (req, res) => {
  const { email, name, password, role = 'redaktor', tenant_id } = req.body;

  if (!email || !name || !password) {
    req.flash('error', 'E-post, namn och lösenord krävs.');
    return res.redirect('/superadmin/admins');
  }
  if (password.length < 10) {
    req.flash('error', 'Lösenordet måste vara minst 10 tecken.');
    return res.redirect('/superadmin/admins');
  }

  try {
    const existing = await queryOne(
      'SELECT id FROM admins WHERE email=?', [email.trim().toLowerCase()]);
    if (existing) {
      req.flash('error', 'En admin med den e-posten finns redan.');
      return res.redirect('/superadmin/admins');
    }

    const hash = await bcrypt.hash(password, 12);

    await query(
      `INSERT INTO admins (email, name, password_hash, role, tenant_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        email.trim().toLowerCase(),
        name.trim(),
        hash,
        role,
        role === 'superadmin' ? null : (tenant_id || null),
      ],
    );
    req.flash('success', `Admin "${name}" skapad.`);
  } catch (err) {
    req.flash('error', 'Kunde inte skapa admin: ' + err.message);
  }
  res.redirect('/superadmin/admins');
});

// POST /superadmin/admins/:id/update — uppdatera roll och tenant
router.post('/:id(\\d+)/update', async (req, res) => {
  const { role, tenant_id } = req.body;
  try {
    await query(
      'UPDATE admins SET role=?, tenant_id=? WHERE id=?',
      [
        role,
        role === 'superadmin' ? null : (tenant_id || null),
        req.params.id,
      ],
    );
    req.flash('success', 'Admin uppdaterad.');
  } catch (err) {
    req.flash('error', 'Kunde inte uppdatera: ' + err.message);
  }
  res.redirect('/superadmin/admins');
});

// POST /superadmin/admins/:id/reset-password
router.post('/:id(\\d+)/reset-password', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 10) {
    req.flash('error', 'Lösenordet måste vara minst 10 tecken.');
    return res.redirect('/superadmin/admins');
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    await query('UPDATE admins SET password_hash=? WHERE id=?', [hash, req.params.id]);
    req.flash('success', 'Lösenord uppdaterat.');
  } catch (err) {
    req.flash('error', 'Kunde inte uppdatera lösenord: ' + err.message);
  }
  res.redirect('/superadmin/admins');
});

// POST /superadmin/admins/:id/delete
router.post('/:id(\\d+)/delete', async (req, res) => {
  try {
    const admin = await queryOne(
      'SELECT id, name, role FROM admins WHERE id=?', [req.params.id]);
    if (!admin) {
      req.flash('error', 'Admin hittades inte.');
      return res.redirect('/superadmin/admins');
    }
    if (admin.role === 'superadmin') {
      req.flash('error', 'Superadmins kan inte raderas härifrån.');
      return res.redirect('/superadmin/admins');
    }
    await query('DELETE FROM admins WHERE id=?', [req.params.id]);
    req.flash('success', `Admin "${admin.name}" raderad.`);
  } catch (err) {
    req.flash('error', 'Kunde inte radera: ' + err.message);
  }
  res.redirect('/superadmin/admins');
});

module.exports = router;