'use strict';

const express = require('express');
const { query } = require('../../config/database');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

router.get('/dashboard', async (req, res) => {
  try {
    const tenantId = req.session.tenantId;

    const [published, draft, images, videos, audios] = await Promise.all([
      query('SELECT COUNT(*) AS n FROM places WHERE tenant_id = ? AND status = "published"', [tenantId]),
      query('SELECT COUNT(*) AS n FROM places WHERE tenant_id = ? AND status = "draft"', [tenantId]),
      query('SELECT COUNT(*) AS n FROM media_assets WHERE tenant_id = ? AND type = "image"', [tenantId]),
      query('SELECT COUNT(*) AS n FROM media_assets WHERE tenant_id = ? AND type = "video"', [tenantId]),
      query('SELECT COUNT(*) AS n FROM media_assets WHERE tenant_id = ? AND type = "audio"', [tenantId]),
    ]);

    res.render('admin/pages/dashboard', {
      title:           'Dashboard',
      adminName:       req.session.adminName,
      tenantName:      req.session.tenantName,
      isImpersonating: req.session.isImpersonating || false,
      stats: {
        published: published[0].n,
        draft:     draft[0].n,
        images:    images[0].n,
        videos:    videos[0].n,
        audios:    audios[0].n,
      },
      success:   req.flash('success')[0] || null,
      error:     req.flash('error')[0]   || null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error('[Dashboard] Error:', err);
    res.status(500).render('admin/pages/error', { title: 'Fel', message: err.message });
  }
});

module.exports = router;