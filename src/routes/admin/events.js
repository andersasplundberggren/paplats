'use strict';

const express = require('express');
const { query } = require('../../config/database');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

const TTL_HOURS = 24;
const TTL_MS    = TTL_HOURS * 60 * 60 * 1000;

// GET /admin/events — lista aktiva och nyligen avslutade events
router.get('/', async (req, res, next) => {
  const tenantId = req.session.tenantId;

  try {
    const events = await query(
      `SELECT
         e.id,
         e.name,
         e.invite_code,
         e.created_at,
         a.title AS assignment_title,
         a.access_code AS assignment_code,
         COUNT(em.id) AS member_count
       FROM events e
       JOIN assignments a ON a.id = e.assignment_id
       LEFT JOIN event_members em ON em.event_id = e.id
       WHERE e.tenant_id = ?
       AND e.created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)
       GROUP BY e.id
       ORDER BY e.created_at DESC`,
      [tenantId]
    );

    // Markera om eventet är aktivt eller utgånget
    const now = Date.now();
    const enriched = events.map(e => ({
      ...e,
      is_active: (now - new Date(e.created_at).getTime()) < TTL_MS,
      expires_at: new Date(new Date(e.created_at).getTime() + TTL_MS)
    }));

    res.render('admin/pages/events/index', {
      title: 'Gruppsessioner',
      events: enriched,
      success: req.flash('success')[0] || null,
      error:   req.flash('error')[0]   || null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
