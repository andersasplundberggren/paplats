'use strict';

const express = require('express');
const { query, queryOne } = require('../../../config/database');

const router = express.Router();

// ─── Hjälp: kontrollera om uppdrag är aktivt ─────────────────
function isAssignmentActive(assignment) {
  const now = new Date();
  if (assignment.activation_starts_at && new Date(assignment.activation_starts_at) > now) {
    return { active: false, reason: 'not_started' };
  }
  if (assignment.activation_ends_at && new Date(assignment.activation_ends_at) < now) {
    return { active: false, reason: 'ended' };
  }
  return { active: true };
}

// ─── GET /api/v1/assignments/:code ────────────────────────────
// Hämtar ett uppdrag med åtkomstkod.
// Returnerar uppdraget och dess platser med innehållsblock.
// Ingen geografisk sökning — allt är bakom kod.
// ─── GET /api/v1/assignments/preview/:token ───────────────────
// Förhandsgranskningsläge för inloggade admins.
// Returnerar samma data som /:code men:
//   - Kräver preview_token istället för access_code
//   - Kräver ingen aktiveringskontroll
//   - Inkluderar solution_answer för att frågor ska kunna besvaras
//   - Markerar svaret som preview: true
router.get('/preview/:token', async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!token) {
    return res.status(400).json({ error: 'Token saknas.' });
  }

  try {
    const assignment = await queryOne(
      `SELECT id, title, description, intro_title, intro_body, type, access_code,
              activation_starts_at, activation_ends_at,
              unlock_mode, grading_mode, difficulty, estimated_minutes, max_clues,
              time_limit_minutes, single_attempt, show_place_numbers
       FROM assignments
       WHERE preview_token = ?`,
      [token]
    );

    if (!assignment) {
      return res.status(404).json({ error: 'Ingen förhandsgranskning hittades.' });
    }

    const places = await query(
      `SELECT p.id, p.title, p.slug, p.short_description, p.long_description,
              p.latitude, p.longitude, p.activation_radius_meters,
              p.preferred_bearing_degrees, p.preferred_distance_meters,
              p.stop_order, p.unlocks_after_place_id, p.unlocks_at,
              cat.name AS category_name
       FROM places p
       LEFT JOIN categories cat ON cat.id = p.category_id
       WHERE p.assignment_id = ? AND p.status = 'published'
       ORDER BY p.stop_order ASC, p.id ASC`,
      [assignment.id]
    );

    const placeIds = places.map(p => p.id);
    let blocks = [];
    if (placeIds.length > 0) {
      const ph = placeIds.map(() => '?').join(',');
      blocks = await query(
        `SELECT cb.id, cb.place_id, cb.block_type, cb.sort_order,
                cb.title, cb.body,
                cb.opacity_default, cb.display_rotation,
                cb.option_a, cb.option_b, cb.option_c, cb.option_d,
                cb.correct_option, cb.explanation, cb.points,
                cb.is_hidden, cb.solution_answer, cb.solution_hint, cb.solution_points,
                cb.cta_url, cb.cta_label,
                cb.witness_name, cb.witness_role, cb.witness_statement,
                cb.witness_reliability, cb.evidence_label, cb.evidence_detail,
                cb.evidence_image_id,
                cb.suspect_name, cb.suspect_role, cb.suspect_motive,
                cb.suspect_alibi, CAST(cb.is_culprit AS UNSIGNED) AS is_culprit, cb.culprit_explanation,
                ma.type AS media_type,
                ma.mime_type, ma.width, ma.height,
                ma.duration_seconds, ma.alt_text,
                wm.stored_path AS witness_image_path,
                sm.stored_path AS suspect_image_path,
                em.stored_path AS evidence_image_path
         FROM place_content_blocks cb
         LEFT JOIN media_assets ma ON ma.id = cb.media_asset_id
         LEFT JOIN media_assets wm ON wm.id = cb.witness_image_id
         LEFT JOIN media_assets sm ON sm.id = cb.suspect_image_id
         LEFT JOIN media_assets em ON em.id = cb.evidence_image_id
         WHERE cb.place_id IN (${ph})
         ORDER BY cb.sort_order ASC`,
        placeIds
      );
    }

    const mediaBase = process.env.MEDIA_BASE_URL || '';

    const placesWithBlocks = places.map(place => ({
      ...place,
      latitude:  parseFloat(place.latitude),
      longitude: parseFloat(place.longitude),
      content_blocks: blocks
        .filter(b => b.place_id === place.id)
        .map(b => ({
          id:               b.id,
          type:             b.block_type,
          sort_order:       b.sort_order,
          title:            b.title,
          body:             b.body,
          media_url:        b.media_path ? `${mediaBase}/${b.media_path}` : null,
          media_type:       b.media_type,
          mime_type:        b.mime_type,
          width:            b.width,
          height:           b.height,
          duration_seconds: b.duration_seconds,
          alt_text:         b.alt_text,
          opacity_default:  b.opacity_default,
          display_rotation: b.display_rotation,
          option_a:         b.option_a,
          option_b:         b.option_b,
          option_c:         b.option_c,
          option_d:         b.option_d,
          correct_option:   b.correct_option,
          explanation:      b.explanation,
          points:           b.points,
          is_hidden:        b.is_hidden === 1,
          solution_answer:  b.solution_answer,
          solution_hint:    b.solution_hint,
          solution_points:  b.solution_points,
          cta_url:          b.cta_url || null,
          cta_label:        b.cta_label || null,
          witness_name:      b.witness_name || null,
          witness_role:      b.witness_role || null,
          witness_statement: b.witness_statement || null,
          witness_reliability: b.witness_reliability || null,
          witness_image_url: b.witness_image_path ? `${mediaBase}/${b.witness_image_path}` : null,
          evidence_label:   b.evidence_label || null,
          evidence_image_url: b.evidence_image_path ? `${mediaBase}/${b.evidence_image_path}` : null,
          evidence_detail:  b.evidence_detail || null,
          suspect_name:     b.suspect_name || null,
          suspect_role:     b.suspect_role || null,
          suspect_motive:   b.suspect_motive || null,
          suspect_alibi:    b.suspect_alibi || null,
          suspect_image_url: b.suspect_image_path ? `${mediaBase}/${b.suspect_image_path}` : null,
          is_culprit:          b.is_culprit === 1,
          culprit_explanation: b.culprit_explanation || null,
        })),
    }));

    res.json({
      preview: true,
      data: {
        id:                assignment.id,
        title:             assignment.title,
        description:       assignment.description,
        intro_title:       assignment.intro_title,
        intro_body:        assignment.intro_body,
        type:              assignment.type,
        access_code:       assignment.access_code,
        unlock_mode:       assignment.unlock_mode,
        grading_mode:      assignment.grading_mode,
        difficulty:        assignment.difficulty,
        estimated_minutes: assignment.estimated_minutes,
        max_clues:         assignment.max_clues ?? null,
        activation_ends_at:  null,
        time_limit_minutes:  assignment.time_limit_minutes ?? null,
        single_attempt:      false,
        show_place_numbers:  false,
        places:              placesWithBlocks,
      }
    });
  } catch (err) {
    console.error('[API] Preview error:', err);
    res.status(500).json({ error: 'Serverfel.' });
  }
});

router.get('/:code', async (req, res) => {
  const code = req.params.code.toUpperCase().trim();
  try {
    const assignment = await queryOne(
      `SELECT id, title, description, intro_title, intro_body, type, access_code,
              activation_starts_at, activation_ends_at,
              unlock_mode, grading_mode, difficulty, estimated_minutes, max_clues,
              time_limit_minutes, single_attempt, show_place_numbers
       FROM assignments
       WHERE access_code=? AND status='published'`,
      [code]
    );

    if (!assignment) {
      return res.status(404).json({ error: 'Inget uppdrag hittades med den koden.' });
    }

    // Kontrollera aktiveringsfönster
    const { active, reason } = isAssignmentActive(assignment);
    if (!active) {
      const messages = {
        not_started: 'Uppdraget har inte börjat ännu.',
        ended:       'Uppdraget är avslutat.',
      };
      return res.status(403).json({ error: messages[reason] || 'Uppdraget är inte aktivt.' });
    }

    // Hämta platser med innehållsblock
    const places = await query(
      `SELECT p.id, p.title, p.slug, p.short_description, p.long_description,
              p.latitude, p.longitude, p.activation_radius_meters,
              p.preferred_bearing_degrees, p.preferred_distance_meters,
              p.stop_order, p.unlocks_after_place_id, p.unlocks_at,
              cat.name AS category_name
       FROM places p
       LEFT JOIN categories cat ON cat.id = p.category_id
       WHERE p.assignment_id=? AND p.status='published'
       ORDER BY p.stop_order ASC, p.id ASC`,
      [assignment.id]
    );

    // Hämta innehållsblock per plats
    const placeIds = places.map(p => p.id);
    let blocks = [];
    if (placeIds.length > 0) {
      const ph = placeIds.map(() => '?').join(',');
      blocks = await query(
        `SELECT cb.id, cb.place_id, cb.block_type, cb.sort_order,
                cb.title, cb.body,
                cb.opacity_default, cb.display_rotation,
                cb.option_a, cb.option_b, cb.option_c, cb.option_d,
                cb.correct_option, cb.explanation, cb.points,
                cb.is_hidden, cb.solution_hint, cb.solution_points,
                cb.cta_url, cb.cta_label,
                -- Inkludera INTE solution_answer i publikt API
                cb.witness_name, cb.witness_role, cb.witness_statement,
                cb.witness_reliability,
                cb.evidence_label, cb.evidence_detail,
                cb.evidence_image_id,
                cb.suspect_name, cb.suspect_role, cb.suspect_motive,
                cb.suspect_alibi, CAST(cb.is_culprit AS UNSIGNED) AS is_culprit, cb.culprit_explanation,
                ma.stored_path AS media_path,
                ma.type AS media_type,
                ma.mime_type, ma.width, ma.height,
                ma.duration_seconds, ma.alt_text,
                wm.stored_path AS witness_image_path,
                sm.stored_path AS suspect_image_path,
                em.stored_path AS evidence_image_path
         FROM place_content_blocks cb
         LEFT JOIN media_assets ma ON ma.id = cb.media_asset_id
         LEFT JOIN media_assets wm ON wm.id = cb.witness_image_id
         LEFT JOIN media_assets sm ON sm.id = cb.suspect_image_id
         LEFT JOIN media_assets em ON em.id = cb.evidence_image_id
         WHERE cb.place_id IN (${ph})
         ORDER BY cb.sort_order ASC`,
        placeIds
      );
    }

    const mediaBase = process.env.MEDIA_BASE_URL || '';

    // Bygg svar
    const placesWithBlocks = places.map(place => ({
      ...place,
      latitude:   parseFloat(place.latitude),
      longitude:  parseFloat(place.longitude),
      content_blocks: blocks
        .filter(b => b.place_id === place.id)
        .map(b => ({
          id:               b.id,
          type:             b.block_type,
          sort_order:       b.sort_order,
          title:            b.title,
          body:             b.body,
          media_url:        b.media_path ? `${mediaBase}/${b.media_path}` : null,
          media_type:       b.media_type,
          mime_type:        b.mime_type,
          width:            b.width,
          height:           b.height,
          duration_seconds: b.duration_seconds,
          alt_text:         b.alt_text,
          opacity_default:  b.opacity_default,
          display_rotation: b.display_rotation,
          // Fråga
          option_a:         b.option_a,
          option_b:         b.option_b,
          option_c:         b.option_c,
          option_d:         b.option_d,
          correct_option:   b.block_type === 'question' ? b.correct_option : undefined,
          explanation:      b.explanation,
          points:           b.points,
          // Ledtråd
          is_hidden:        b.is_hidden === 1,
          // Lösning (hint men inte svar)
          solution_hint:    b.solution_hint,
          solution_points:  b.solution_points,
          cta_url:          b.cta_url || null,
          cta_label:        b.cta_label || null,
          // Vittne
          witness_name:        b.witness_name || null,
          witness_role:        b.witness_role || null,
          witness_statement:   b.witness_statement || null,
          witness_reliability: b.witness_reliability || null,
          witness_image_url:   b.witness_image_path ? `${mediaBase}/${b.witness_image_path}` : null,
          // Bevis
          evidence_label:  b.evidence_label || null,
          evidence_image_url: b.evidence_image_path ? `${mediaBase}/${b.evidence_image_path}` : null,
          evidence_detail: b.evidence_detail || null,
          // Misstänkt
          suspect_name:    b.suspect_name || null,
          suspect_role:    b.suspect_role || null,
          suspect_motive:  b.suspect_motive || null,
          suspect_alibi:   b.suspect_alibi || null,
          suspect_image_url: b.suspect_image_path ? `${mediaBase}/${b.suspect_image_path}` : null,
          is_culprit:          b.is_culprit === 1,
          culprit_explanation: b.culprit_explanation || null,
        })),
    }));

    res.set("Cache-Control", "no-store"); res.json({
      data: {
        id:                  assignment.id,
        title:               assignment.title,
        description:         assignment.description,
        intro_title:         assignment.intro_title,
        intro_body:          assignment.intro_body,
        type:                assignment.type,
        access_code:         assignment.access_code,
        unlock_mode:         assignment.unlock_mode,
        grading_mode:        assignment.grading_mode,
        difficulty:          assignment.difficulty,
        estimated_minutes:   assignment.estimated_minutes,
        max_clues:           assignment.max_clues ?? null,
        activation_ends_at:    assignment.activation_ends_at || null,
        time_limit_minutes:    assignment.time_limit_minutes ?? null,
        single_attempt:        assignment.single_attempt === 1,
        show_place_numbers:    assignment.show_place_numbers === true || assignment.show_place_numbers === 1,
        places:                placesWithBlocks,
      }
    });
  } catch (err) {
    console.error('[API] Assignment error:', err);
    res.status(500).json({ error: 'Serverfel.' });
  }
});

module.exports = router;