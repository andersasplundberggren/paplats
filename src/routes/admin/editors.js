'use strict';

const express = require('express');
const { query, queryOne } = require('../../config/database');
const { requireAdmin, requireTenantAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAdmin, requireTenantAdmin);

// ─── GET /admin/editors/:assignmentId ─────────────────────────
router.get('/:assignmentId(\\d+)', async (req, res, next) => {
  const tenantId = req.session.tenantId;
  const { assignmentId } = req.params;
  try {
    const assignment = await queryOne(
      'SELECT id, title FROM assignments WHERE id=? AND tenant_id=?',
      [assignmentId, tenantId]);
    if (!assignment) return res.redirect('/admin/assignments');

    // Redaktörer som redan är tilldelade
    const assigned = await query(
      `SELECT a.id, a.name, a.email
       FROM admins a
       JOIN assignment_editors ae ON ae.admin_id = a.id
       WHERE ae.assignment_id = ?
       ORDER BY a.name`, [assignmentId]);

    // Redaktörer som kan tilldelas (ej tilldelade)
    const assignedIds = assigned.map(a => a.id);
    let available = [];
    if (assignedIds.length > 0) {
      const ph = assignedIds.map(() => '?').join(',');
      available = await query(
        `SELECT id, name, email FROM admins
         WHERE tenant_id=? AND role='redaktor' AND id NOT IN (${ph})
         ORDER BY name`,
        [tenantId, ...assignedIds]);
    } else {
      available = await query(
        `SELECT id, name, email FROM admins
         WHERE tenant_id=? AND role='redaktor'
         ORDER BY name`, [tenantId]);
    }

    res.render('admin/pages/editors/list', {
      title: `Redaktörer: ${assignment.title}`,
      assignment, assigned, available,
      success: req.flash('success')[0] || null,
      error:   req.flash('error')[0]   || null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) { next(err); }
});

// ─── POST /admin/editors/:assignmentId/add ────────────────────
router.post('/:assignmentId(\\d+)/add', async (req, res, next) => {
  const tenantId = req.session.tenantId;
  const { assignmentId } = req.params;
  const { admin_id } = req.body;
  try {
    // Verifiera att admin tillhör tenanten
    const admin = await queryOne(
      'SELECT id FROM admins WHERE id=? AND tenant_id=? AND role=?',
      [admin_id, tenantId, 'redaktor']);
    if (!admin) { req.flash('error', 'Redaktören hittades inte.'); }
    else {
      await query(
        'INSERT IGNORE INTO assignment_editors (assignment_id, admin_id) VALUES (?,?)',
        [assignmentId, admin_id]);
      req.flash('success', 'Redaktören tilldelades uppdraget.');
    }
  } catch (err) { req.flash('error', 'Kunde inte tilldela.'); }
  res.redirect(`/admin/editors/${assignmentId}`);
});

// ─── POST /admin/editors/:assignmentId/remove/:adminId ────────
router.post('/:assignmentId(\\d+)/remove/:adminId(\\d+)', async (req, res, next) => {
  const { assignmentId, adminId } = req.params;
  try {
    await query(
      'DELETE FROM assignment_editors WHERE assignment_id=? AND admin_id=?',
      [assignmentId, adminId]);
    req.flash('success', 'Redaktören togs bort från uppdraget.');
  } catch (err) { req.flash('error', 'Kunde inte ta bort.'); }
  res.redirect(`/admin/editors/${assignmentId}`);
});

module.exports = router;