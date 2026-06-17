'use strict';

const express = require('express');
const { query, queryOne } = require('../../config/database');
const { requireAdmin, requireAssignmentAccess } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

function toSlug(str) {
  return str.toLowerCase()
    .replace(/å/g,'a').replace(/ä/g,'a').replace(/ö/g,'o')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

// ─── GET /admin/places/new?assignmentId=X ─────────────────────
router.get('/new', requireAssignmentAccess, async (req, res, next) => {
  const { assignmentId } = req.query;
  const tenantId = req.session.tenantId;
  try {
    const assignment = await queryOne(
      'SELECT id, title, type FROM assignments WHERE id=? AND tenant_id=?',
      [assignmentId, tenantId]
    );
    if (!assignment) return res.redirect('/admin/assignments');

    const categories = await query(
      'SELECT * FROM categories WHERE tenant_id=? ORDER BY name', [tenantId]);

    // För linjärt läge — hämta befintliga platser att låsa upp efter
    const existingPlaces = await query(
      'SELECT id, title, stop_order FROM places WHERE assignment_id=? ORDER BY stop_order',
      [assignmentId]
    );

    res.render('admin/pages/places/form', {
      title: 'Ny plats', place: null, assignment, categories, existingPlaces,
      error: req.flash('error')[0] || null, csrfToken: req.csrfToken(),
    });
  } catch (err) { next(err); }
});

// ─── POST /admin/places ───────────────────────────────────────
router.post('/', requireAssignmentAccess, async (req, res, next) => {
  const tenantId = req.session.tenantId;
  const {
    assignment_id, title, short_description, long_description,
    latitude, longitude, activation_radius_meters = 50,
    preferred_bearing_degrees, preferred_distance_meters,
    stop_order = 0, unlocks_after_place_id,
    unlocks_at, status = 'draft', category_id,
  } = req.body;

  if (!title || !assignment_id) {
    req.flash('error', 'Titel och uppdrag krävs.');
    return res.redirect(`/admin/places/new?assignmentId=${assignment_id}`);
  }

  try {
    const slug = toSlug(title) + '-' + Date.now();
    const result = await query(
      `INSERT INTO places
         (assignment_id, tenant_id, title, slug, short_description, long_description,
          latitude, longitude, activation_radius_meters, preferred_bearing_degrees,
          preferred_distance_meters, stop_order, unlocks_after_place_id,
          unlocks_at, status, category_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        assignment_id, tenantId, title.trim(), slug,
        short_description || null, long_description || null,
        latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
        activation_radius_meters ? parseInt(activation_radius_meters) : null,
        preferred_bearing_degrees ? parseFloat(preferred_bearing_degrees) : null,
        preferred_distance_meters ? parseInt(preferred_distance_meters) : null,
        parseInt(stop_order),
        unlocks_after_place_id || null,
        unlocks_at || null,
        status,
        category_id || null,
      ]
    );
    console.log("[PLACE INSERT] result=" + JSON.stringify(result)); req.flash("success", "Platsen skapades.");
    res.redirect(`/admin/content/${result.insertId}`);
  } catch (err) { next(err); }
});

// ─── GET /admin/places/:id/edit ───────────────────────────────
router.get('/:id(\\d+)/edit', async (req, res, next) => {
  const tenantId = req.session.tenantId;
  try {
    const place = await queryOne(
      'SELECT * FROM places WHERE id=? AND tenant_id=?', [req.params.id, tenantId]);
    if (!place) return res.status(404).render('admin/pages/error',
      { title:'404', message:'Platsen hittades inte.', stack:null, detail:null });

    const [assignment, categories, existingPlaces] = await Promise.all([
      queryOne('SELECT id, title, type, unlock_mode FROM assignments WHERE id=?', [place.assignment_id]),
      query('SELECT * FROM categories WHERE tenant_id=? ORDER BY name', [tenantId]),
      query('SELECT id, title, stop_order FROM places WHERE assignment_id=? AND id != ? ORDER BY stop_order',
        [place.assignment_id, place.id]),
    ]);

    res.render('admin/pages/places/form', {
      title: `Redigera: ${place.title}`, place, assignment, categories, existingPlaces,
      error: req.flash('error')[0] || null,
      success: req.flash('success')[0] || null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) { next(err); }
});

// ─── POST /admin/places/:id/delete ────────────────────────────
router.post('/:id(\\d+)/delete', async (req, res, next) => {
  const tenantId = req.session.tenantId;
  try {
    const place = await queryOne(
      'SELECT id, assignment_id FROM places WHERE id=? AND tenant_id=?',
      [req.params.id, tenantId]);
    if (!place) return res.status(403).send('Ej tillåtet.');
    await query('DELETE FROM places WHERE id=?', [req.params.id]);
    req.flash('success', 'Platsen raderades.');
    res.redirect(`/admin/assignments/${place.assignment_id}/places`);
  } catch (err) {
    req.flash('error', 'Kunde inte radera platsen.');
    res.redirect(`/admin/assignments`);
  }
});

// ─── POST /admin/places/:id ───────────────────────────────────
router.post('/:id(\\d+)', async (req, res, next) => {
  const tenantId = req.session.tenantId;
  const { id } = req.params;
  const {
    title, short_description, long_description,
    latitude, longitude, activation_radius_meters,
    preferred_bearing_degrees, preferred_distance_meters,
    stop_order, unlocks_after_place_id, unlocks_at,
    status, category_id,
  } = req.body;

  try {
    const existing = await queryOne(
      'SELECT id, assignment_id FROM places WHERE id=? AND tenant_id=?', [id, tenantId]);
    if (!existing) return res.status(403).send('Ej tillåtet.');

    await query(
      `UPDATE places SET
         title=?, short_description=?, long_description=?,
         latitude=?, longitude=?, activation_radius_meters=?,
         preferred_bearing_degrees=?, preferred_distance_meters=?,
         stop_order=?, unlocks_after_place_id=?, unlocks_at=?,
         status=?, category_id=?
       WHERE id=? AND tenant_id=?`,
      [
        title.trim(), short_description || null, long_description || null,
        latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
        activation_radius_meters ? parseInt(activation_radius_meters) : null,
        preferred_bearing_degrees ? parseFloat(preferred_bearing_degrees) : null,
        preferred_distance_meters ? parseInt(preferred_distance_meters) : null,
        parseInt(stop_order || 0),
        unlocks_after_place_id || null,
        unlocks_at || null,
        status, category_id || null,
        id, tenantId,
      ]
    );
    req.flash('success', 'Platsen sparades.');
    res.redirect(`/admin/places/${id}/edit`);
  } catch (err) { next(err); }
});

// ─── POST /admin/places/:id/copy ──────────────────────────────
// Kopierar en plats med alla innehållsblock till ett annat uppdrag.
// Media-assets återanvänds (kopieras inte på disk).
// Kopian får status 'draft'.
router.post('/:id(\\d+)/copy', async (req, res, next) => {
  const tenantId = req.session.tenantId;
  const { id } = req.params;
  const { target_assignment_id } = req.body;

  if (!target_assignment_id) {
    req.flash('error', 'Välj ett måluppdrag.');
    return res.redirect(`/admin/content/${id}`);
  }

  try {
    // Verifiera att källplatsen tillhör tenanten
    const place = await queryOne(
      'SELECT * FROM places WHERE id=? AND tenant_id=?',
      [id, tenantId]
    );
    if (!place) return res.status(403).send('Ej tillåtet.');

    // Verifiera att måluppdraget tillhör tenanten
    const targetAssignment = await queryOne(
      'SELECT id, title FROM assignments WHERE id=? AND tenant_id=?',
      [target_assignment_id, tenantId]
    );
    if (!targetAssignment) {
      req.flash('error', 'Måluppdraget hittades inte.');
      return res.redirect(`/admin/content/${id}`);
    }

    // Räkna befintliga platser i måluppdraget för stop_order
    const { cnt } = await queryOne(
      'SELECT COUNT(*) AS cnt FROM places WHERE assignment_id=?',
      [target_assignment_id]
    );

    const newSlug = toSlug(place.title) + '-' + Date.now();

    const placeResult = await query(
      `INSERT INTO places
         (assignment_id, tenant_id, title, slug, short_description, long_description,
          category_id, latitude, longitude, activation_radius_meters,
          preferred_bearing_degrees, preferred_distance_meters,
          stop_order, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        target_assignment_id,
        tenantId,
        place.title,
        newSlug,
        place.short_description || null,
        place.long_description || null,
        place.category_id || null,
        place.latitude,
        place.longitude,
        place.activation_radius_meters,
        place.preferred_bearing_degrees || null,
        place.preferred_distance_meters || null,
        parseInt(cnt) || 0,
        'draft',
      ]
    );

    const newPlaceId = placeResult.insertId;

    // Kopiera alla innehållsblock
    const blocks = await query(
      'SELECT * FROM place_content_blocks WHERE place_id=? ORDER BY sort_order ASC',
      [id]
    );

    for (const block of blocks) {
      await query(
        `INSERT INTO place_content_blocks
           (place_id, block_type, sort_order, title, body, media_asset_id,
            opacity_default, display_rotation,
            option_a, option_b, option_c, option_d,
            correct_option, explanation, points,
            is_hidden, solution_answer, solution_hint, solution_points)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          newPlaceId,
          block.block_type,
          block.sort_order,
          block.title || null,
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
        ]
      );
    }

    req.flash('success', `Platsen kopierades till "${targetAssignment.title}".`);
    res.redirect(`/admin/content/${newPlaceId}`);
  } catch (err) {
    req.flash('error', 'Kopieringen misslyckades. Försök igen.');
    res.redirect(`/admin/content/${id}`);
    next(err);
  }
});

// ─── GET /admin/places/:id/content ────────────────────────────
// Vidarebefordra till content-routen
router.get('/:id(\\d+)/content', (req, res) => {
  res.redirect(`/admin/content/${req.params.id}`);
});

module.exports = router;