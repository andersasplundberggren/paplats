'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const sharp   = require('sharp');
const { query, queryOne } = require('../../config/database');
const { requireAdmin } = require('../../middleware/auth');
const {
  upload, validateFileSize, relativeStoredPath, getMediaType,
} = require('../../middleware/upload');

const router = express.Router();
router.use(requireAdmin);

function toInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return isNaN(n) ? fallback : n;
}

function toFloat(value, fallback = 1.0) {
  const n = parseFloat(value);
  return isNaN(n) ? fallback : n;
}

function toNullable(value) {
  return (value === undefined || value === null || value === '') ? null : value;
}

function firstVal(value) {
  if (Array.isArray(value)) return value[0] !== undefined ? value[0] : null;
  return value;
}

// ─── GET /admin/content/:placeId ──────────────────────────────
router.get('/:placeId(\\d+)', async (req, res, next) => {
  const tenantId = req.session.tenantId;
  const placeId = req.params.placeId;

  try {
    const place = await queryOne(
      `SELECT p.*, a.title AS assignment_title, a.type AS assignment_type, a.id AS assignment_id
       FROM places p
       JOIN assignments a ON a.id = p.assignment_id
       WHERE p.id = ? AND p.tenant_id = ?`,
      [placeId, tenantId]
    );

    if (!place) {
      return res.status(404).render('admin/pages/error', {
        title: '404',
        message: 'Platsen hittades inte.',
        stack: null,
        detail: null,
      });
    }

    const blocks = await query(
      `SELECT cb.*,
              ma.original_filename, ma.stored_path, ma.type AS media_type,
              wm.stored_path AS witness_image_path, wm.original_filename AS witness_image_filename,
              sm.stored_path AS suspect_image_path
       FROM place_content_blocks cb
       LEFT JOIN media_assets ma ON ma.id = cb.media_asset_id
       LEFT JOIN media_assets wm ON wm.id = cb.witness_image_id
       LEFT JOIN media_assets sm ON sm.id = cb.suspect_image_id
       WHERE cb.place_id = ?
       ORDER BY cb.sort_order ASC, cb.id ASC`,
      [placeId]
    );

    const mediaAssets = await query(
      `SELECT id, type, original_filename, stored_path, alt_text
       FROM media_assets
       WHERE tenant_id = ?
       ORDER BY created_at DESC`,
      [tenantId]
    );

    const assignments = await query(
      `SELECT id, title, access_code
       FROM assignments
       WHERE tenant_id = ? AND id != ?
       ORDER BY title ASC`,
      [tenantId, place.assignment_id]
    );

    res.render('admin/pages/places/content', {
      title: 'Innehåll: ' + place.title,
      place,
      blocks,
      mediaAssets,
      assignments,
      mediaBaseUrl: process.env.MEDIA_BASE_URL || '',
      success: req.flash('success')[0] || null,
      error: req.flash('error')[0] || null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /admin/content/:placeId/upload ──────────────────────
router.post('/:placeId(\\d+)/upload', upload.single('file'), validateFileSize, async (req, res, next) => {
  const tenantId = req.session.tenantId;
  const placeId = toInt(req.params.placeId);

  if (!req.file) {
    req.flash('error', 'Ingen fil mottagen.');
    return res.redirect('/admin/content/' + placeId);
  }

  try {
    const place = await queryOne(
      'SELECT id FROM places WHERE id = ? AND tenant_id = ?',
      [placeId, tenantId]
    );

    if (!place) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(403).send('Ej tillåtet.');
    }

    const { file } = req;
    const mediaType  = getMediaType(file.mimetype);
    const storedPath = relativeStoredPath(file.path);

    let width = null, height = null;
    if (mediaType === 'image') {
      try {
        const meta = await sharp(file.path).metadata();
        width  = meta.width  || null;
        height = meta.height || null;
      } catch (e) {
        console.warn('[Content] sharp error:', e.message);
      }
    }

    await query(
      `INSERT INTO media_assets
         (tenant_id, type, original_filename, stored_path, mime_type,
          file_size, width, height, alt_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, mediaType, file.originalname, storedPath,
        file.mimetype, file.size, width, height,
        req.body.alt_text || null,
      ]
    );

    req.flash('success', `"${file.originalname}" laddades upp och är nu tillgänglig i mediabiblioteket.`);
    res.redirect('/admin/content/' + placeId);
  } catch (err) {
    console.error('[Content] Upload error:', err);
    if (req.file) fs.unlink(req.file.path, () => {});
    req.flash('error', 'Uppladdning misslyckades: ' + err.message);
    res.redirect('/admin/content/' + placeId);
  }
});

// ─── POST /admin/content/:placeId — lägg till nytt block ──────
router.post('/:placeId(\\d+)', async (req, res, next) => {
  const tenantId = req.session.tenantId;
  const placeId = toInt(req.params.placeId);
  const b = req.body;

  try {
    const place = await queryOne(
      'SELECT id FROM places WHERE id = ? AND tenant_id = ?',
      [placeId, tenantId]
    );

    if (!place) {
      return res.status(403).send('Ej tillåtet.');
    }

    const reliabilityValues = ['reliable', 'uncertain', 'suspicious'];
    const witnessReliability = reliabilityValues.includes(b.witness_reliability)
      ? b.witness_reliability : null;

    await query(
      `INSERT INTO place_content_blocks
         (place_id, block_type, sort_order, title, body, media_asset_id,
          opacity_default, display_rotation, option_a, option_b, option_c, option_d,
          correct_option, explanation, points, is_hidden,
          solution_answer, solution_hint, solution_points,
          cta_url, cta_label,
          witness_name, witness_role, witness_statement, witness_reliability, witness_image_id,
          evidence_label, evidence_detail, evidence_image_id,
          suspect_name, suspect_role, suspect_motive, suspect_alibi, suspect_image_id,
          is_culprit, culprit_explanation)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        placeId,
        toNullable(b.block_type) || 'text',
        toInt(b.sort_order, 0),
        toNullable(firstVal(b.title)),
        toNullable(firstVal(b.question_body) || firstVal(b.body)),
        firstVal(b.media_asset_id) ? toInt(firstVal(b.media_asset_id)) : null,
        toFloat(b.opacity_default, 1.0),
        toInt(b.display_rotation, 0),
        toNullable(b.option_a),
        toNullable(b.option_b),
        toNullable(b.option_c),
        toNullable(b.option_d),
        toNullable(b.correct_option),
        toNullable(b.explanation),
        toInt(b.points, 10),
        b.is_hidden ? 1 : 0,
        toNullable(b.solution_answer),
        toNullable(b.solution_hint),
        toInt(b.solution_points, 0),
        toNullable(b.cta_url),
        toNullable(b.cta_label),
        toNullable(b.witness_name),
        toNullable(b.witness_role),
        toNullable(b.witness_statement),
        witnessReliability,
        b.witness_image_id ? toInt(b.witness_image_id) : null,
        toNullable(b.evidence_label),
        toNullable(b.evidence_detail),
        b.evidence_image_id ? toInt(b.evidence_image_id) : null,
        toNullable(b.suspect_name),
        toNullable(b.suspect_role),
        toNullable(b.suspect_motive),
        toNullable(b.suspect_alibi),
        b.suspect_image_id ? toInt(b.suspect_image_id) : null,
        b.is_culprit ? 1 : 0,
        toNullable(b.culprit_explanation)
      ]
    );

    req.flash('success', 'Blocket lades till.');
    res.redirect('/admin/content/' + placeId);
  } catch (err) {
    next(err);
  }
});

// ─── POST /admin/content/:placeId/blocks/:blockId — redigera block ──
router.post('/:placeId(\\d+)/blocks/:blockId(\\d+)', async (req, res, next) => {
  const tenantId = req.session.tenantId;
  const placeId = toInt(req.params.placeId);
  const blockId = toInt(req.params.blockId);
  const b = req.body;

  try {
    const place = await queryOne(
      'SELECT id FROM places WHERE id = ? AND tenant_id = ?',
      [placeId, tenantId]
    );

    if (!place) {
      return res.status(403).send('Ej tillåtet.');
    }

    const reliabilityValues = ['reliable', 'uncertain', 'suspicious'];
    const witnessReliability = reliabilityValues.includes(b.witness_reliability)
      ? b.witness_reliability : null;

    await query(
      `UPDATE place_content_blocks SET
         sort_order = ?, title = ?, body = ?, media_asset_id = ?,
         opacity_default = ?, display_rotation = ?,
         option_a = ?, option_b = ?, option_c = ?, option_d = ?,
         correct_option = ?, explanation = ?, points = ?,
         is_hidden = ?, solution_answer = ?, solution_hint = ?, solution_points = ?,
         cta_url = ?, cta_label = ?,
         witness_name = ?, witness_role = ?, witness_statement = ?,
         witness_reliability = ?, witness_image_id = ?,
         evidence_label = ?, evidence_detail = ?, evidence_image_id = ?,
         suspect_name = ?, suspect_role = ?, suspect_motive = ?,
         suspect_alibi = ?, suspect_image_id = ?,
         is_culprit = ?, culprit_explanation = ?
       WHERE id = ? AND place_id = ?`,
      [
        toInt(b.sort_order, 0),
        toNullable(firstVal(b.title)),
        toNullable(firstVal(b.question_body) || firstVal(b.body)),
        firstVal(b.media_asset_id) ? toInt(firstVal(b.media_asset_id)) : null,
        toFloat(b.opacity_default, 1.0),
        toInt(b.display_rotation, 0),
        toNullable(b.option_a),
        toNullable(b.option_b),
        toNullable(b.option_c),
        toNullable(b.option_d),
        toNullable(b.correct_option),
        toNullable(b.explanation),
        toInt(b.points, 10),
        b.is_hidden ? 1 : 0,
        toNullable(b.solution_answer),
        toNullable(b.solution_hint),
        toInt(b.solution_points, 0),
        toNullable(b.cta_url),
        toNullable(b.cta_label),
        toNullable(b.witness_name),
        toNullable(b.witness_role),
        toNullable(b.witness_statement),
        witnessReliability,
        b.witness_image_id ? toInt(b.witness_image_id) : null,
        toNullable(b.evidence_label),
        toNullable(b.evidence_detail),
        b.evidence_image_id ? toInt(b.evidence_image_id) : null,
        toNullable(b.suspect_name),
        toNullable(b.suspect_role),
        toNullable(b.suspect_motive),
        toNullable(b.suspect_alibi),
        b.suspect_image_id ? toInt(b.suspect_image_id) : null,
        b.is_culprit ? 1 : 0,
        toNullable(b.culprit_explanation),
        blockId,
        placeId
      ]
    );

    req.flash('success', 'Blocket sparades.');
    res.redirect('/admin/content/' + placeId);
  } catch (err) {
    next(err);
  }
});

// ─── POST /admin/content/:placeId/blocks/:blockId/copy ────────
router.post('/:placeId(\\d+)/blocks/:blockId(\\d+)/copy', async (req, res, next) => {
  const tenantId = req.session.tenantId;
  const placeId  = toInt(req.params.placeId);
  const blockId  = toInt(req.params.blockId);

  try {
    const place = await queryOne(
      'SELECT id FROM places WHERE id = ? AND tenant_id = ?',
      [placeId, tenantId]
    );
    if (!place) return res.status(403).send('Ej tillåtet.');

    const block = await queryOne(
      'SELECT * FROM place_content_blocks WHERE id = ? AND place_id = ?',
      [blockId, placeId]
    );
    if (!block) {
      req.flash('error', 'Blocket hittades inte.');
      return res.redirect('/admin/content/' + placeId);
    }

    const newSortOrder = (block.sort_order || 0) + 1;

    await queryOne(
      `UPDATE place_content_blocks
       SET sort_order = sort_order + 1
       WHERE place_id = ? AND sort_order >= ? AND id != ?`,
      [placeId, newSortOrder, blockId]
    );

    await query(
      `INSERT INTO place_content_blocks
         (place_id, block_type, sort_order, title, body, media_asset_id,
          opacity_default, display_rotation, option_a, option_b, option_c, option_d,
          correct_option, explanation, points, is_hidden,
          solution_answer, solution_hint, solution_points,
          cta_url, cta_label,
          witness_name, witness_role, witness_statement, witness_reliability, witness_image_id,
          evidence_label, evidence_detail, evidence_image_id,
          suspect_name, suspect_role, suspect_motive, suspect_alibi, suspect_image_id,
          is_culprit, culprit_explanation)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        placeId,
        block.block_type,
        newSortOrder,
        block.title ? `${block.title} (kopia)` : null,
        block.body || null,
        block.media_asset_id || null,
        block.opacity_default,
        block.display_rotation,
        block.option_a || null,
        block.option_b || null,
        block.option_c || null,
        block.option_d || null,
        block.correct_option || null,
        block.explanation || null,
        block.points,
        block.is_hidden,
        block.solution_answer || null,
        block.solution_hint || null,
        block.solution_points,
        block.cta_url || null,
        block.cta_label || null,
        block.witness_name || null,
        block.witness_role || null,
        block.witness_statement || null,
        block.witness_reliability || null,
        block.witness_image_id || null,
        block.evidence_label || null,
        block.evidence_detail || null,
        block.evidence_image_id || null,
        block.suspect_name || null,
        block.suspect_role || null,
        block.suspect_motive || null,
        block.suspect_alibi || null,
        block.suspect_image_id || null,
        block.is_culprit || 0,
        block.culprit_explanation || null
      ]
    );

    req.flash('success', 'Blocket kopierades.');
    res.redirect('/admin/content/' + placeId);
  } catch (err) {
    next(err);
  }
});

// ─── POST /admin/content/:placeId/blocks/:blockId/delete ──────
router.post('/:placeId(\\d+)/blocks/:blockId(\\d+)/delete', async (req, res, next) => {
  const tenantId = req.session.tenantId;
  const placeId = toInt(req.params.placeId);
  const blockId = toInt(req.params.blockId);

  try {
    const place = await queryOne(
      'SELECT id FROM places WHERE id = ? AND tenant_id = ?',
      [placeId, tenantId]
    );

    if (!place) {
      return res.status(403).send('Ej tillåtet.');
    }

    await query(
      'DELETE FROM place_content_blocks WHERE id = ? AND place_id = ?',
      [blockId, placeId]
    );

    req.flash('success', 'Blocket togs bort.');
  } catch (err) {
    req.flash('error', 'Kunde inte ta bort blocket.');
  }

  res.redirect('/admin/content/' + placeId);
});

// ─── POST /admin/content/:placeId/reorder ─────────────────────
router.post('/:placeId(\\d+)/reorder', async (req, res, next) => {
  const tenantId = req.session.tenantId;
  const placeId  = toInt(req.params.placeId);

  try {
    const place = await queryOne(
      'SELECT id FROM places WHERE id = ? AND tenant_id = ?',
      [placeId, tenantId]
    );
    if (!place) return res.status(403).json({ error: 'Ej tillåtet.' });

    const order = req.body.order;
    if (!Array.isArray(order) || !order.length) {
      return res.status(400).json({ error: 'Ogiltig ordningslista.' });
    }

    for (let i = 0; i < order.length; i++) {
      const blockId = toInt(order[i]);
      if (!blockId) continue;
      await query(
        'UPDATE place_content_blocks SET sort_order = ? WHERE id = ? AND place_id = ?',
        [i, blockId, placeId]
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;