'use strict';

const express  = require('express');
const slugify  = require('slugify');
const { query, queryOne } = require('../../config/database');
const { requireAdmin }    = require('../../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

router.get('/', async (req, res) => {
  try {
    const tenantId = req.session.tenantId;
    const categories = await query(
      `SELECT c.*, COUNT(DISTINCT p.id) AS place_count
       FROM categories c
       LEFT JOIN places p ON p.category_id = c.id AND p.tenant_id = c.tenant_id
       WHERE c.tenant_id = ?
       GROUP BY c.id ORDER BY c.name ASC`,
      [tenantId],
    );
    res.render('admin/pages/categories/list', {
      title: 'Categories', categories,
      success:   req.flash('success')[0] || null,
      error:     req.flash('error')[0]   || null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error('[Categories] List error:', err);
    res.status(500).render('admin/pages/error', { title: 'Error', message: err.message });
  }
});

router.post('/', async (req, res) => {
  const tenantId = req.session.tenantId;
  const { name } = req.body;
  if (!name) {
    req.flash('error', 'Name is required.');
    return res.redirect('/admin/categories');
  }
  try {
    const slug = slugify(name, { lower: true, strict: true });
    await query(
      'INSERT INTO categories (tenant_id, name, slug) VALUES (?, ?, ?)',
      [tenantId, name.trim(), slug],
    );
    req.flash('success', `Category "${name}" created.`);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      req.flash('error', 'A category with that name already exists.');
    } else {
      req.flash('error', 'Failed to create category: ' + err.message);
    }
  }
  res.redirect('/admin/categories');
});

router.post('/:id(\\d+)/delete', async (req, res) => {
  const tenantId = req.session.tenantId;
  try {
    const cat = await queryOne(
      'SELECT id FROM categories WHERE id = ? AND tenant_id = ?',
      [req.params.id, tenantId],
    );
    if (!cat) return res.status(403).send('Not allowed.');
    await query('DELETE FROM categories WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);
    req.flash('success', 'Category deleted.');
  } catch (err) {
    req.flash('error', 'Failed to delete category.');
  }
  res.redirect('/admin/categories');
});

module.exports = router;