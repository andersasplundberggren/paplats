'use strict';

const express  = require('express');
const slugify  = require('slugify');
const { query, queryOne } = require('../../config/database');

const router = express.Router();

// GET /superadmin/tenants
router.get('/', async (req, res) => {
  try {
    const tenants = await query(
      `SELECT t.*,
         COUNT(DISTINCT a.id)    AS admin_count,
         COUNT(DISTINCT p.id)    AS place_count,
         COUNT(DISTINCT asgn.id) AS assignment_count
       FROM tenants t
       LEFT JOIN admins      a    ON a.tenant_id    = t.id
       LEFT JOIN places      p    ON p.tenant_id    = t.id
       LEFT JOIN assignments asgn ON asgn.tenant_id = t.id
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
    );
    res.render('superadmin/pages/tenants/list', {
      title:   'Klienter',
      tenants,
      success: req.flash('success')[0] || null,
      error:   req.flash('error')[0]   || null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error('[SA Tenants] List error:', err);
    res.status(500).render('admin/pages/error', {
      title: 'Fel', message: err.message, stack: err.stack, detail: null,
    });
  }
});

// POST /superadmin/tenants — skapa
router.post('/', async (req, res) => {
  const { name, contact_email, status = 'active' } = req.body;
  if (!name) {
    req.flash('error', 'Namn krävs.');
    return res.redirect('/superadmin/tenants');
  }
  try {
    const slug = slugify(name, { lower: true, strict: true });
    await query(
      'INSERT INTO tenants (name, slug, status, contact_email) VALUES (?, ?, ?, ?)',
      [name.trim(), slug, status, contact_email || null],
    );
    req.flash('success', `Klient "${name}" skapad.`);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      req.flash('error', 'En klient med det namnet finns redan.');
    } else {
      req.flash('error', 'Kunde inte skapa klient: ' + err.message);
    }
  }
  res.redirect('/superadmin/tenants');
});

// POST /superadmin/tenants/:id — uppdatera
router.post('/:id(\\d+)', async (req, res) => {
  const { name, contact_email, status } = req.body;
  try {
    await query(
      'UPDATE tenants SET name=?, contact_email=?, status=? WHERE id=?',
      [name.trim(), contact_email || null, status, req.params.id],
    );
    req.flash('success', 'Klient uppdaterad.');
  } catch (err) {
    req.flash('error', 'Kunde inte uppdatera: ' + err.message);
  }
  res.redirect('/superadmin/tenants');
});

// POST /superadmin/tenants/:id/delete
router.post('/:id(\\d+)/delete', async (req, res) => {
  try {
    const tenant = await queryOne('SELECT id, name FROM tenants WHERE id=?', [req.params.id]);
    if (!tenant) {
      req.flash('error', 'Klient hittades inte.');
      return res.redirect('/superadmin/tenants');
    }
    await query('DELETE FROM tenants WHERE id=?', [req.params.id]);
    req.flash('success', `Klient "${tenant.name}" raderad.`);
  } catch (err) {
    req.flash('error', 'Kunde inte radera: ' + err.message);
  }
  res.redirect('/superadmin/tenants');
});

module.exports = router;