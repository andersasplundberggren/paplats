'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const sharp   = require('sharp');
const { query, queryOne } = require('../../config/database');
const { requireAdmin }    = require('../../middleware/auth');
const {
  upload, validateFileSize, relativeStoredPath, publicUrl, getMediaType,
} = require('../../middleware/upload');

const router = express.Router();
router.use(requireAdmin);

// GET /admin/media
router.get('/', async (req, res) => {
  try {
    const tenantId = req.session.tenantId;
    const { type = '' } = req.query;

    // Räkna användningar via place_content_blocks istället för place_media
    let sql = `
      SELECT ma.*,
        COUNT(DISTINCT cb.place_id) AS place_count
      FROM media_assets ma
      LEFT JOIN place_content_blocks cb ON cb.media_asset_id = ma.id
      WHERE ma.tenant_id = ?
    `;
    const params = [tenantId];
    if (type) { sql += ' AND ma.type = ?'; params.push(type); }
    sql += ' GROUP BY ma.id ORDER BY ma.created_at DESC';

    const assets = await query(sql, params);
    assets.forEach(a => { a.url = publicUrl(a.stored_path); });

    res.render('admin/pages/media/list', {
      title: 'Media', assets, filter: type,
      mediaBaseUrl: process.env.MEDIA_BASE_URL,
      success:   req.flash('success')[0] || null,
      error:     req.flash('error')[0]   || null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error('[Media] List error:', err);
    res.status(500).render('admin/pages/error', {
      title: 'Fel', message: err.message, stack: err.stack, detail: null,
    });
  }
});

// GET /admin/media/unused — lista oanvända filer
router.get('/unused', async (req, res) => {
  const tenantId = req.session.tenantId;
  try {
    const assets = await query(
      `SELECT ma.*
       FROM media_assets ma
       LEFT JOIN place_content_blocks cb ON cb.media_asset_id = ma.id
       WHERE ma.tenant_id = ? AND cb.id IS NULL
       ORDER BY ma.created_at DESC`,
      [tenantId]
    );
    assets.forEach(a => { a.url = publicUrl(a.stored_path); });

    res.render('admin/pages/media/unused', {
      title: 'Oanvända mediafiler',
      assets,
      mediaBaseUrl: process.env.MEDIA_BASE_URL,
      success: req.flash('success')[0] || null,
      error:   req.flash('error')[0]   || null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error('[Media] Unused error:', err);
    res.status(500).render('admin/pages/error', {
      title: 'Fel', message: err.message, stack: err.stack, detail: null,
    });
  }
});

// POST /admin/media/unused/delete-all — radera alla oanvända filer
router.post('/unused/delete-all', async (req, res) => {
  const tenantId = req.session.tenantId;
  try {
    const assets = await query(
      `SELECT ma.*
       FROM media_assets ma
       LEFT JOIN place_content_blocks cb ON cb.media_asset_id = ma.id
       WHERE ma.tenant_id = ? AND cb.id IS NULL`,
      [tenantId]
    );

    let deleted = 0;
    for (const asset of assets) {
      await query('DELETE FROM media_assets WHERE id = ? AND tenant_id = ?', [asset.id, tenantId]);
      fs.unlink(path.join(process.env.UPLOADS_DIR, asset.stored_path), () => {});
      deleted++;
    }

    req.flash('success', `${deleted} fil${deleted === 1 ? '' : 'er'} raderades.`);
    res.redirect('/admin/media/unused');
  } catch (err) {
    console.error('[Media] Delete-all error:', err);
    req.flash('error', 'Kunde inte radera filerna.');
    res.redirect('/admin/media/unused');
  }
});

// GET /admin/media/upload
router.get('/upload', (req, res) => {
  res.render('admin/pages/media/upload', {
    title:     'Ladda upp media',
    success:   req.flash('success')[0] || null,
    error:     req.flash('error')[0]   || null,
    csrfToken: req.csrfToken(),
  });
});

// POST /admin/media/upload
router.post('/upload', upload.single('file'), validateFileSize, async (req, res) => {
  if (!req.file) {
    req.flash('error', 'Ingen fil mottagen.');
    return res.redirect('/admin/media/upload');
  }
  try {
    const tenantId   = req.session.tenantId;
    const { file }   = req;
    const mediaType  = getMediaType(file.mimetype);
    const storedPath = relativeStoredPath(file.path);

    let width = null, height = null;
    if (mediaType === 'image') {
      try {
        const meta = await sharp(file.path).metadata();
        width  = meta.width  || null;
        height = meta.height || null;
      } catch (e) { console.warn('[Media] sharp error:', e.message); }
    }

    const result = await query(
      `INSERT INTO media_assets
        (tenant_id, type, original_filename, stored_path, mime_type,
         file_size, width, height, alt_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, mediaType, file.originalname, storedPath,
        file.mimetype, file.size, width, height,
        req.body.alt_text || null,
      ],
    );
    req.flash('success', `Filen laddades upp (ID: ${result.insertId}).`);
    return res.redirect('/admin/media');
  } catch (err) {
    console.error('[Media] Upload error:', err);
    if (req.file) fs.unlink(req.file.path, () => {});
    req.flash('error', 'Uppladdning misslyckades: ' + err.message);
    return res.redirect('/admin/media/upload');
  }
});

// POST /admin/media/:id/delete
router.post('/:id(\\d+)/delete', async (req, res) => {
  const tenantId = req.session.tenantId;
  try {
    const asset = await queryOne(
      'SELECT * FROM media_assets WHERE id=? AND tenant_id=?',
      [req.params.id, tenantId],
    );
    if (!asset) {
      req.flash('error', 'Filen hittades inte.');
      return res.redirect('/admin/media');
    }

    // Kontrollera om filen används i innehållsblock
    const uses = await queryOne(
      'SELECT COUNT(*) AS n FROM place_content_blocks WHERE media_asset_id=?',
      [req.params.id]
    );
    if (uses && uses.n > 0 && !req.body.force) {
      req.flash('error', `Filen används i ${uses.n} innehållsblock. Ta bort blocken först.`);
      return res.redirect('/admin/media');
    }

    await query(
      'DELETE FROM media_assets WHERE id=? AND tenant_id=?',
      [req.params.id, tenantId]
    );
    fs.unlink(path.join(process.env.UPLOADS_DIR, asset.stored_path), () => {});
    req.flash('success', 'Filen raderades.');
    return res.redirect('/admin/media');
  } catch (err) {
    console.error('[Media] Delete error:', err);
    req.flash('error', 'Kunde inte radera filen.');
    return res.redirect('/admin/media');
  }
});

module.exports = router;