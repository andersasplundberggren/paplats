'use strict';

const express = require('express');
const { query } = require('../../config/database');
const { requireSuperAdmin } = require('../../middleware/superadmin');

const router = express.Router();
router.use(requireSuperAdmin);

router.get('/dashboard', async (req, res) => {
  try {
    const [[tenantRow], [adminRow], [placeRow], [assignmentRow], tenants] = await Promise.all([
      query('SELECT COUNT(*) AS n FROM tenants'),
      query('SELECT COUNT(*) AS n FROM admins WHERE role = "admin"'),
      query('SELECT COUNT(*) AS n FROM places'),
      query('SELECT COUNT(*) AS n FROM assignments'),
      query(
        `SELECT t.*,
           COUNT(DISTINCT a.id)  AS admin_count,
           COUNT(DISTINCT p.id)  AS place_count,
           COUNT(DISTINCT asgn.id) AS assignment_count
         FROM tenants t
         LEFT JOIN admins      a    ON a.tenant_id    = t.id
         LEFT JOIN places      p    ON p.tenant_id    = t.id
         LEFT JOIN assignments asgn ON asgn.tenant_id = t.id
         GROUP BY t.id
         ORDER BY t.created_at DESC`
      ),
    ]);

    res.render('superadmin/pages/dashboard', {
      title:          'Dashboard',
      superAdminName: req.session.superAdminName,
      stats: {
        tenants:     tenantRow.n,
        admins:      adminRow.n,
        places:      placeRow.n,
        assignments: assignmentRow.n,
      },
      tenants,
      success:   req.flash('success')[0] || null,
      error:     req.flash('error')[0]   || null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error('[SA Dashboard] Error:', err);
    res.status(500).render('admin/pages/error', {
      title: 'Fel', message: err.message, stack: err.stack, detail: null,
    });
  }
});

module.exports = router;