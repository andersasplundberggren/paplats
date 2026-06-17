'use strict';

const express = require('express');
const crypto  = require('crypto');
const { query, queryOne } = require('../../config/database');
const { requireAdmin, requireTenantAdmin, requireAssignmentAccess } = require('../../middleware/auth');
const sessionCleanupService = require('../../services/sessionCleanupService');

const router = express.Router();
router.use(requireAdmin);

// Hjälp, generera slug
function toSlug(str) {
  return str.toLowerCase()
    .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseRetentionMode(value) {
  return value === 'manual' ? 'manual' : 'auto';
}

function parseRetentionHoursFromDays(value, fallbackHours) {
  if (value === undefined || value === null || value === '') {
    return fallbackHours;
  }

  const days = parseInt(value, 10);

  if (Number.isNaN(days) || days < 1) {
    return fallbackHours;
  }

  return days * 24;
}

function buildRetentionFormData(source) {
  const mode = parseRetentionMode(source.session_retention_mode);
  const hoursRaw = parseInt(source.session_retention_hours, 10);
  const hours = Number.isNaN(hoursRaw) || hoursRaw < 1 ? 48 : hoursRaw;

  return {
    session_retention_mode: mode,
    session_retention_days: String(Math.max(1, Math.ceil(hours / 24)))
  };
}

// Hjälp, hämta uppdrag, med behörighetskontroll
async function getAssignment(id, tenantId, adminId, role) {
  if (role === 'admin' || role === 'systemadmin') {
    return queryOne(
      'SELECT * FROM assignments WHERE id=? AND tenant_id=?',
      [id, tenantId]
    );
  }

  return queryOne(
    `SELECT a.* FROM assignments a
     JOIN assignment_editors ae ON ae.assignment_id = a.id
     WHERE a.id=? AND a.tenant_id=? AND ae.admin_id=?`,
    [id, tenantId, adminId]
  );
}

// GET /admin/assignments
router.get('/', async (req, res, next) => {
  const { tenantId, adminId, adminRole } = req.session;

  try {
    let assignments;

    if (adminRole === 'admin' || adminRole === 'systemadmin') {
      assignments = await query(
        `SELECT a.*,
           COUNT(DISTINCT p.id) AS place_count,
           COUNT(DISTINCT us.id) AS session_count
         FROM assignments a
         LEFT JOIN places p ON p.assignment_id = a.id
         LEFT JOIN user_sessions us ON us.assignment_id = a.id
         WHERE a.tenant_id = ?
         GROUP BY a.id
         ORDER BY a.created_at DESC`,
        [tenantId]
      );
    } else {
      assignments = await query(
        `SELECT a.*,
           COUNT(DISTINCT p.id) AS place_count,
           COUNT(DISTINCT us.id) AS session_count
         FROM assignments a
         JOIN assignment_editors ae ON ae.assignment_id = a.id AND ae.admin_id = ?
         LEFT JOIN places p ON p.assignment_id = a.id
         LEFT JOIN user_sessions us ON us.assignment_id = a.id
         WHERE a.tenant_id = ?
         GROUP BY a.id
         ORDER BY a.created_at DESC`,
        [adminId, tenantId]
      );
    }

    res.render('admin/pages/assignments/list', {
      title: 'Uppdrag',
      assignments,
      success: req.flash('success')[0] || null,
      error: req.flash('error')[0] || null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/assignments/new
router.get('/new', requireTenantAdmin, (req, res) => {
  res.render('admin/pages/assignments/form', {
    title: 'Nytt uppdrag',
    assignment: null,
    formData: {
      session_retention_mode: 'auto',
      session_retention_days: '2'
    },
    cleanupPreview: null,
    error: req.flash('error')[0] || null,
    success: req.flash('success')[0] || null,
    csrfToken: req.csrfToken(),
  });
});

// POST /admin/assignments
router.post('/', requireTenantAdmin, async (req, res, next) => {
  const tenantId = req.session.tenantId;

  const {
    title,
    description,
    intro_title,
    intro_body,
    type = 'exploration',
    access_code,
    status = 'draft',
    activation_starts_at,
    activation_ends_at,
    max_participants,
    max_clues,
    time_limit_minutes,
    single_attempt,
    // ─── NYTT: show_place_numbers (2025-04-25) ───────────────────
    show_place_numbers,
    // ─────────────────────────────────────────────────────────────
    unlock_mode = 'free',
    grading_mode = 'auto',
    difficulty = 'medium',
    estimated_minutes,
    session_retention_mode,
    session_retention_days,
  } = req.body;

  if (!title || !access_code) {
    req.flash('error', 'Titel och åtkomstkod krävs.');
    return res.redirect('/admin/assignments/new');
  }

  try {
    const slug = toSlug(title) + '-' + Date.now();
    const results_token = crypto.randomBytes(24).toString('hex');
    const retentionMode = parseRetentionMode(session_retention_mode);
    const retentionHours = retentionMode === 'manual'
      ? null
      : parseRetentionHoursFromDays(session_retention_days, 48);

    const result = await query(
      // ─── NYTT: show_place_numbers tillagt i kolumnlistan (2025-04-25) ───
      `INSERT INTO assignments
         (tenant_id, title, slug, description, intro_title, intro_body, type, access_code, status,
          activation_starts_at, activation_ends_at, max_participants, max_clues, time_limit_minutes,
          single_attempt, show_place_numbers, unlock_mode, grading_mode, difficulty, estimated_minutes,
          results_token, session_retention_mode, session_retention_hours)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      // ────────────────────────────────────────────────────────────────────
      [
        tenantId,
        title.trim(),
        slug,
        description || null,
        intro_title || null,
        intro_body || null,
        type,
        access_code.trim().toUpperCase(),
        status,
        activation_starts_at || null,
        activation_ends_at || null,
        max_participants ? parseInt(max_participants, 10) : null,
        max_clues ? parseInt(max_clues, 10) : null,
        time_limit_minutes ? parseInt(time_limit_minutes, 10) : null,
        single_attempt ? 1 : 0,
        // ─── NYTT: show_place_numbers i värdelistan (2025-04-25) ───
        show_place_numbers ? 1 : 0,
        // ───────────────────────────────────────────────────────────
        unlock_mode,
        grading_mode,
        difficulty,
        estimated_minutes ? parseInt(estimated_minutes, 10) : null,
        results_token,
        retentionMode,
        retentionHours,
      ]
    );

    req.flash('success', 'Uppdraget skapades.');
    res.redirect(`/admin/assignments/${result.insertId}/places`);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      req.flash('error', 'Åtkomstkoden används redan.');
      return res.redirect('/admin/assignments/new');
    }
    next(err);
  }
});

// GET /admin/assignments/:id/edit
router.get('/:id(\\d+)/edit', requireAssignmentAccess, async (req, res, next) => {
  const { tenantId, adminId, adminRole } = req.session;

  try {
    const assignment = await getAssignment(req.params.id, tenantId, adminId, adminRole);

    if (!assignment) {
      return res.status(404).render('admin/pages/error', {
        title: '404',
        message: 'Uppdraget hittades inte.',
        stack: null,
        detail: null
      });
    }

    res.render('admin/pages/assignments/form', {
      title: `Redigera: ${assignment.title}`,
      assignment,
      formData: buildRetentionFormData(assignment),
      cleanupPreview: null,
      error: req.flash('error')[0] || null,
      success: req.flash('success')[0] || null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/assignments/:id
router.post('/:id(\\d+)', requireAssignmentAccess, async (req, res, next) => {
  const { tenantId, adminId, adminRole } = req.session;
  const { id } = req.params;

  const {
    title,
    description,
    intro_title,
    intro_body,
    type,
    access_code,
    status,
    activation_starts_at,
    activation_ends_at,
    max_participants,
    max_clues,
    time_limit_minutes,
    single_attempt,
    // ─── NYTT: show_place_numbers (2025-04-25) ───────────────────
    show_place_numbers,
    // ─────────────────────────────────────────────────────────────
    unlock_mode,
    grading_mode,
    difficulty,
    estimated_minutes,
    session_retention_mode,
    session_retention_days,
  } = req.body;

  try {
    const existing = await getAssignment(id, tenantId, adminId, adminRole);

    if (!existing) {
      return res.status(403).send('Ej tillåtet.');
    }

    const retentionMode = parseRetentionMode(session_retention_mode);
    const fallbackHours = existing.session_retention_hours || 48;
    const retentionHours = retentionMode === 'manual'
      ? null
      : parseRetentionHoursFromDays(session_retention_days, fallbackHours);

    await query(
      // ─── NYTT: show_place_numbers tillagt i SET-listan (2025-04-25) ─────
      `UPDATE assignments SET
         title=?, description=?, intro_title=?, intro_body=?, type=?, access_code=?, status=?,
         activation_starts_at=?, activation_ends_at=?, max_participants=?, max_clues=?,
         time_limit_minutes=?, single_attempt=?, show_place_numbers=?,
         unlock_mode=?, grading_mode=?, difficulty=?, estimated_minutes=?,
         session_retention_mode=?, session_retention_hours=?
       WHERE id=? AND tenant_id=?`,
      // ────────────────────────────────────────────────────────────────────
      [
        title.trim(),
        description || null,
        intro_title || null,
        intro_body || null,
        type,
        access_code.trim().toUpperCase(),
        status,
        activation_starts_at || null,
        activation_ends_at || null,
        max_participants ? parseInt(max_participants, 10) : null,
        max_clues ? parseInt(max_clues, 10) : null,
        time_limit_minutes ? parseInt(time_limit_minutes, 10) : null,
        single_attempt ? 1 : 0,
        // ─── NYTT: show_place_numbers i värdelistan (2025-04-25) ───
        show_place_numbers ? 1 : 0,
        // ───────────────────────────────────────────────────────────
        unlock_mode,
        grading_mode,
        difficulty,
        estimated_minutes ? parseInt(estimated_minutes, 10) : null,
        retentionMode,
        retentionHours,
        id,
        tenantId,
      ]
    );

    req.flash('success', 'Uppdraget sparades.');
    res.redirect(`/admin/assignments/${id}/edit`);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      req.flash('error', 'Åtkomstkoden används redan.');
      return res.redirect(`/admin/assignments/${id}/edit`);
    }
    next(err);
  }
});

// POST /admin/assignments/:id/cleanup/preview
router.post('/:id(\\d+)/cleanup/preview', requireAssignmentAccess, async (req, res, next) => {
  const { tenantId, adminId, adminRole } = req.session;
  const { id } = req.params;

  try {
    const assignment = await getAssignment(id, tenantId, adminId, adminRole);

    if (!assignment) {
      return res.status(403).send('Ej tillåtet.');
    }

    const cleanupPreview = await sessionCleanupService.previewAssignmentSessions(parseInt(id, 10));

    res.render('admin/pages/assignments/form', {
      title: `Redigera: ${assignment.title}`,
      assignment,
      formData: buildRetentionFormData(assignment),
      cleanupPreview,
      error: null,
      success: null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/assignments/:id/cleanup/apply
router.post('/:id(\\d+)/cleanup/apply', requireAssignmentAccess, async (req, res, next) => {
  const { tenantId, adminId, adminRole } = req.session;
  const { id } = req.params;

  try {
    const assignment = await getAssignment(id, tenantId, adminId, adminRole);

    if (!assignment) {
      return res.status(403).send('Ej tillåtet.');
    }

    const result = await sessionCleanupService.applyAssignmentSessions(parseInt(id, 10));
    const deletedCount = result ? result.deletedCount : 0;

    req.flash('success', 'Manuell gallring genomfördes. Raderade sessioner: ' + deletedCount);
    res.redirect(`/admin/assignments/${id}/edit`);
  } catch (err) {
    next(err);
  }
});

// GET /admin/assignments/:id/results
router.get('/:id(\\d+)/results', requireAssignmentAccess, async (req, res, next) => {
  const { tenantId, adminId, adminRole } = req.session;
  const { id } = req.params;

  try {
    const assignment = await getAssignment(id, tenantId, adminId, adminRole);

    if (!assignment) {
      return res.status(404).render('admin/pages/error', {
        title: '404',
        message: 'Uppdraget hittades inte.',
        stack: null,
        detail: null
      });
    }

    const sessions = await query(
      `SELECT
         us.id,
         us.nickname,
         us.contact,
         us.started_at,
         us.completed_at,
         COUNT(up.id) AS progress_count,
         COALESCE(SUM(up.points_earned), 0) AS total_score,
         SUM(CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END) AS correct_count
       FROM user_sessions us
       LEFT JOIN user_progress up ON up.session_id = us.id
       WHERE us.assignment_id = ?
       GROUP BY us.id, us.nickname, us.contact, us.started_at, us.completed_at
       ORDER BY us.started_at DESC`,
      [id]
    );

    const progressRows = await query(
      `SELECT
         us.id AS session_id,
         p.title AS place_title,
         pcb.block_type,
         pcb.title AS block_title,
         pcb.body AS block_body,
         up.chosen_option,
         up.solution_text,
         up.is_correct,
         up.points_earned,
         up.visited_at
       FROM user_sessions us
       JOIN user_progress up ON up.session_id = us.id
       LEFT JOIN places p ON p.id = up.place_id
       LEFT JOIN place_content_blocks pcb ON pcb.id = up.block_id
       WHERE us.assignment_id = ?
       ORDER BY us.started_at DESC, up.visited_at ASC`,
      [id]
    );

    const notesRows = await query(
      `SELECT
         un.session_id,
         un.content
       FROM user_notes un
       JOIN user_sessions us ON us.id = un.session_id
       WHERE us.assignment_id = ?`,
      [id]
    );

    const progressBySession = {};
    progressRows.forEach((row) => {
      if (!progressBySession[row.session_id]) {
        progressBySession[row.session_id] = [];
      }
      progressBySession[row.session_id].push(row);
    });

    const notesBySession = {};
    notesRows.forEach((row) => {
      notesBySession[row.session_id] = row.content || '';
    });

    const sessionItems = sessions.map((session) => {
      return {
        ...session,
        progress: progressBySession[session.id] || [],
        note: notesBySession[session.id] || ''
      };
    });

    const summary = {
      sessionCount: sessionItems.length,
      completedCount: sessionItems.filter((item) => !!item.completed_at).length,
      activeCount: sessionItems.filter((item) => !item.completed_at).length,
      totalScore: sessionItems.reduce((sum, item) => sum + (parseInt(item.total_score, 10) || 0), 0),
      totalAnswers: sessionItems.reduce((sum, item) => sum + (parseInt(item.progress_count, 10) || 0), 0)
    };

    res.render('admin/pages/assignments/results', {
      title: `Resultat: ${assignment.title}`,
      assignment,
      summary,
      sessionItems,
      success: req.flash('success')[0] || null,
      error: req.flash('error')[0] || null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/assignments/:id/results/export
// Ladda ned alla sessioner och svar som CSV-fil.
router.get('/:id(\\d+)/results/export', requireAssignmentAccess, async (req, res, next) => {
  const { tenantId, adminId, adminRole } = req.session;
  const { id } = req.params;

  try {
    const assignment = await getAssignment(id, tenantId, adminId, adminRole);

    if (!assignment) {
      return res.status(404).send('Uppdraget hittades inte.');
    }

    const sessions = await query(
      `SELECT
         us.id,
         us.nickname,
         us.contact,
         us.started_at,
         us.completed_at,
         COALESCE(SUM(up.points_earned), 0) AS total_score,
         SUM(CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
         COUNT(up.id) AS answer_count
       FROM user_sessions us
       LEFT JOIN user_progress up ON up.session_id = us.id
       WHERE us.assignment_id = ?
       GROUP BY us.id, us.nickname, us.contact, us.started_at, us.completed_at
       ORDER BY us.started_at DESC`,
      [id]
    );

    const progressRows = await query(
      `SELECT
         us.id AS session_id,
         p.title AS place_title,
         pcb.block_type,
         pcb.title AS block_title,
         pcb.body AS block_body,
         up.chosen_option,
         up.solution_text,
         up.is_correct,
         up.points_earned,
         up.visited_at
       FROM user_sessions us
       JOIN user_progress up ON up.session_id = us.id
       LEFT JOIN places p ON p.id = up.place_id
       LEFT JOIN place_content_blocks pcb ON pcb.id = up.block_id
       WHERE us.assignment_id = ?
       ORDER BY us.started_at DESC, up.visited_at ASC`,
      [id]
    );

    const notesRows = await query(
      `SELECT un.session_id, un.content
       FROM user_notes un
       JOIN user_sessions us ON us.id = un.session_id
       WHERE us.assignment_id = ?`,
      [id]
    );

    const notesBySession = {};
    notesRows.forEach((row) => {
      notesBySession[row.session_id] = row.content || '';
    });

    const progressBySession = {};
    progressRows.forEach((row) => {
      if (!progressBySession[row.session_id]) {
        progressBySession[row.session_id] = [];
      }
      progressBySession[row.session_id].push(row);
    });

    // Hjälpfunktion: escapar ett CSV-värde
    function csvCell(value) {
      if (value === null || value === undefined) return '';
      const str = String(value).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    }

    function csvRow(...values) {
      return values.map(csvCell).join(',') + '\r\n';
    }

    const BOM = '\uFEFF'; // Gör att Excel hanterar UTF-8 korrekt
    let csv = BOM;

    // Rubrikrad för sessioner
    csv += csvRow(
      'Session ID', 'Namn', 'Kontakt',
      'Startad', 'Avslutad', 'Poäng', 'Rätta svar', 'Antal svar', 'Anteckningar'
    );

    for (const session of sessions) {
      const note = notesBySession[session.id] || '';
      csv += csvRow(
        session.id,
        session.nickname || '',
        session.contact || '',
        session.started_at ? new Date(session.started_at).toISOString().replace('T', ' ').substring(0, 19) : '',
        session.completed_at ? new Date(session.completed_at).toISOString().replace('T', ' ').substring(0, 19) : '',
        session.total_score || 0,
        session.correct_count || 0,
        session.answer_count || 0,
        note
      );

      // Detaljrader per svar under varje session
      const answers = progressBySession[session.id] || [];
      if (answers.length > 0) {
        csv += csvRow(
          '', 'Plats', 'Blocktyp', 'Block', 'Fråga/text',
          'Svar', 'Fritext', 'Rätt', 'Poäng', 'Tid'
        );
        for (const row of answers) {
          if (!row.block_type) continue; // Rent platsbesök utan block
          csv += csvRow(
            '',
            row.place_title || '',
            row.block_type || '',
            row.block_title || '',
            row.block_body ? row.block_body.substring(0, 100) : '',
            row.chosen_option ? row.chosen_option.toUpperCase() : '',
            row.solution_text || '',
            row.is_correct === 1 ? 'Ja' : row.is_correct === 0 ? 'Nej' : '',
            row.points_earned || 0,
            row.visited_at ? new Date(row.visited_at).toISOString().replace('T', ' ').substring(0, 19) : ''
          );
        }
      }
    }

    const filename = `spoton-resultat-${assignment.access_code}-${new Date().toISOString().substring(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});


router.post('/:id(\\d+)/publish', requireAssignmentAccess, async (req, res, next) => {
  const { tenantId, adminId, adminRole } = req.session;
  const { id } = req.params;

  try {
    const a = await getAssignment(id, tenantId, adminId, adminRole);

    if (!a) {
      return res.status(403).send('Ej tillåtet.');
    }

    const newStatus = a.status === 'published' ? 'draft' : 'published';
    await query('UPDATE assignments SET status=? WHERE id=?', [newStatus, id]);
    req.flash('success', newStatus === 'published' ? 'Publicerat.' : 'Avpublicerat.');
  } catch (err) {
    req.flash('error', 'Kunde inte ändra status.');
  }

  res.redirect(`/admin/assignments/${id}/places`);
});

// POST /admin/assignments/:id/copy
// (Resten av copy-routen är oförändrad — truncated i original men bevarad här)
router.post('/:id(\\d+)/copy', requireTenantAdmin, async (req, res, next) => {
  const { tenantId, adminId, adminRole } = req.session;
  const { id } = req.params;

  try {
    const source = await getAssignment(id, tenantId, adminId, adminRole);

    if (!source) {
      return res.status(403).send('Ej tillåtet.');
    }

    const newCode = source.access_code + '_KOPIA_' + Date.now().toString().slice(-4);
    const newSlug = toSlug(source.title) + '-kopia-' + Date.now();
    const results_token = crypto.randomBytes(24).toString('hex');

    const result = await query(
      // ─── NYTT: show_place_numbers med i kopieringen (2025-04-25) ────────
      `INSERT INTO assignments
         (tenant_id, title, slug, description, intro_title, intro_body, type, access_code, status,
          max_participants, max_clues, time_limit_minutes, single_attempt, show_place_numbers,
          unlock_mode, grading_mode, difficulty, estimated_minutes, results_token,
          session_retention_mode, session_retention_hours)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      // ────────────────────────────────────────────────────────────────────
      [
        tenantId,
        source.title + ' (kopia)',
        newSlug,
        source.description || null,
        source.intro_title || null,
        source.intro_body || null,
        source.type,
        newCode,
        'draft',
        source.max_participants || null,
        source.max_clues || null,
        source.time_limit_minutes || null,
        source.single_attempt ? 1 : 0,
        // ─── NYTT: kopiera show_place_numbers (2025-04-25) ───
        source.show_place_numbers ? 1 : 0,
        // ─────────────────────────────────────────────────────
        source.unlock_mode || 'free',
        source.grading_mode || 'auto',
        source.difficulty || 'medium',
        source.estimated_minutes || null,
        results_token,
        source.session_retention_mode || 'auto',
        source.session_retention_hours || 48,
      ]
    );

    const newAssignmentId = result.insertId;

    const places = await query(
      'SELECT * FROM places WHERE assignment_id = ? ORDER BY stop_order ASC, id ASC',
      [id]
    );

    for (const place of places) {
      const placeResult = await query(
        `INSERT INTO places
           (tenant_id, assignment_id, title, description, latitude, longitude,
            unlock_distance, stop_order, status, image_id)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          tenantId,
          newAssignmentId,
          place.title,
          place.description || null,
          place.latitude,
          place.longitude,
          place.unlock_distance || 30,
          place.stop_order || 0,
          place.status || 'published',
          place.image_id || null,
        ]
      );

      const newPlaceId = placeResult.insertId;

      const blocks = await query(
        'SELECT * FROM place_content_blocks WHERE place_id = ? ORDER BY sort_order ASC, id ASC',
        [place.id]
      );

      for (const block of blocks) {
        await query(
          `INSERT INTO place_content_blocks
             (place_id, tenant_id, block_type, title, body, media_id, sort_order,
              option_a, option_b, option_c, option_d, correct_option, explanation, points,
              is_hidden, solution_answer, solution_hint, solution_points)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            newPlaceId,
            tenantId,
            block.block_type,
            block.title || null,
            block.body || null,
            block.media_id || null,
            block.sort_order || 0,
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
    }

    req.flash('success', `Uppdraget kopierades. Kopian är sparad som utkast med koden ${newCode}.`);
    res.redirect(`/admin/assignments/${newAssignmentId}/places`);
  } catch (err) {
    req.flash('error', 'Kopieringen misslyckades. Försök igen.');
    res.redirect('/admin/assignments');
    next(err);
  }
});

// POST /admin/assignments/:id/delete
router.post('/:id(\\d+)/delete', requireTenantAdmin, async (req, res, next) => {
  const { tenantId, adminId, adminRole } = req.session;

  try {
    const a = await getAssignment(req.params.id, tenantId, adminId, adminRole);

    if (!a) {
      return res.status(403).send('Ej tillåtet.');
    }

    await query(
      'DELETE FROM assignments WHERE id=? AND tenant_id=?',
      [req.params.id, tenantId]
    );

    req.flash('success', 'Uppdraget raderades.');
  } catch (err) {
    req.flash('error', 'Kunde inte radera.');
  }

  res.redirect('/admin/assignments');
});

// POST /admin/assignments/:id/places/reorder
// Tar emot [{id, stop_order}] och uppdaterar ordningen för platserna.
router.post('/:id(\\d+)/places/reorder', requireAssignmentAccess, async (req, res) => {
  const { tenantId, adminId, adminRole } = req.session;
  const { id } = req.params;

  try {
    const assignment = await getAssignment(id, tenantId, adminId, adminRole);
    if (!assignment) {
      return res.status(403).json({ error: 'Ej tillåtet.' });
    }

    const items = req.body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Ogiltig data.' });
    }

    // Uppdatera stop_order för varje plats — verifiera att platsen tillhör uppdraget
    for (const item of items) {
      const placeId    = parseInt(item.id, 10);
      const stop_order = parseInt(item.stop_order, 10);
      if (!isFinite(placeId) || !isFinite(stop_order)) continue;

      await query(
        'UPDATE places SET stop_order = ? WHERE id = ? AND assignment_id = ? AND tenant_id = ?',
        [stop_order, placeId, id, tenantId]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[Reorder]', err);
    res.status(500).json({ error: 'Serverfel.' });
  }
});

// GET /admin/assignments/:id/places
router.get('/:id(\\d+)/places', requireAssignmentAccess, async (req, res, next) => {
  const { tenantId, adminId, adminRole } = req.session;

  try {
    const assignment = await getAssignment(req.params.id, tenantId, adminId, adminRole);

    if (!assignment) {
      return res.status(404).render('admin/pages/error', {
        title: '404',
        message: 'Uppdraget hittades inte.',
        stack: null,
        detail: null
      });
    }

    const places = await query(
      `SELECT
         p.*,
         COALESCE(cb.block_count, 0) AS block_count
       FROM places p
       LEFT JOIN (
         SELECT place_id, COUNT(*) AS block_count
         FROM place_content_blocks
         GROUP BY place_id
       ) cb ON cb.place_id = p.id
       WHERE p.assignment_id = ?
       ORDER BY p.stop_order ASC, p.id ASC`,
      [assignment.id]
    );

    res.render('admin/pages/assignments/places', {
      title: `Platser: ${assignment.title}`,
      assignment,
      places,
      mediaBaseUrl: process.env.MEDIA_BASE_URL || '',
      success: req.flash('success')[0] || null,
      error: req.flash('error')[0] || null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── Hjälpfunktion: hämta live-data för ett uppdrag ──────────
async function getLiveData(assignmentId, filters = {}) {
  const { status = 'all', q = '' } = filters;

  let sql = `
    SELECT
      us.id, us.nickname, us.contact,
      us.started_at, us.completed_at,
      COALESCE(SUM(up.points_earned), 0) AS total_score,
      SUM(CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
      COUNT(DISTINCT CASE WHEN up.block_id IS NULL THEN up.place_id END) AS visited_places,
      MAX(up.visited_at) AS last_activity
    FROM user_sessions us
    LEFT JOIN user_progress up ON up.session_id = us.id
    WHERE us.assignment_id = ?
  `;
  const params = [assignmentId];

  if (status === 'active') {
    sql += ' AND us.completed_at IS NULL';
  } else if (status === 'completed') {
    sql += ' AND us.completed_at IS NOT NULL';
  }

  if (q) {
    sql += ' AND (us.nickname LIKE ? OR us.contact LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  sql += ' GROUP BY us.id, us.nickname, us.contact, us.started_at, us.completed_at ORDER BY us.started_at DESC';

  const sessions = await query(sql, params);

  // Totalt antal platser i uppdraget
  const { place_count } = await query(
    'SELECT COUNT(*) AS place_count FROM places WHERE assignment_id = ? AND status = ?',
    [assignmentId, 'published']
  ).then(rows => rows[0] || { place_count: 0 });

  return { sessions, place_count };
}

// GET /admin/assignments/:id/live — live-vy (kräver inloggning)
router.get('/:id(\\d+)/live', requireAssignmentAccess, async (req, res, next) => {
  const { tenantId, adminId, adminRole } = req.session;
  const { id } = req.params;
  const { status = 'all', q = '' } = req.query;

  try {
    const assignment = await getAssignment(id, tenantId, adminId, adminRole);

    if (!assignment) {
      return res.status(404).render('admin/pages/error', {
        title: '404', message: 'Uppdraget hittades inte.', stack: null, detail: null
      });
    }

    const { sessions, place_count } = await getLiveData(id, { status, q });
    const publicUrl = `${req.protocol}://${req.get('host')}/live/${assignment.results_token}`;

    res.render('admin/pages/assignments/live', {
      title: `Live: ${assignment.title}`,
      assignment,
      sessions,
      place_count,
      filters: { status, q },
      publicUrl,
      isPublic: false,
      csrfToken: req.csrfToken(),
      success: req.flash('success')[0] || null,
      error: req.flash('error')[0] || null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/assignments/live-data/:id — JSON-endpoint för polling (kräver inloggning)
router.get('/:id(\\d+)/live-data', requireAssignmentAccess, async (req, res, next) => {
  const { tenantId, adminId, adminRole } = req.session;
  const { id } = req.params;
  const { status = 'all', q = '' } = req.query;

  try {
    const assignment = await getAssignment(id, tenantId, adminId, adminRole);
    if (!assignment) return res.status(404).json({ error: 'Hittades inte.' });

    const { sessions, place_count } = await getLiveData(id, { status, q });
    res.json({ sessions, place_count, updated_at: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// POST /admin/assignments/:id/places/publish-all
// Publicerar alla utkast-platser i ett uppdrag.
router.post('/:id(\\d+)/places/publish-all', requireAssignmentAccess, async (req, res, next) => {
  const { tenantId, adminId, adminRole } = req.session;
  const { id } = req.params;

  try {
    const assignment = await getAssignment(id, tenantId, adminId, adminRole);
    if (!assignment) return res.status(403).send('Ej tillåtet.');

    const result = await query(
      `UPDATE places SET status = 'published'
       WHERE assignment_id = ? AND tenant_id = ? AND status = 'draft'`,
      [id, tenantId]
    );

    const count = result.affectedRows || 0;
    req.flash('success', count > 0
      ? `${count} plats${count === 1 ? '' : 'er'} publicerades.`
      : 'Alla platser var redan publicerade.'
    );
    res.redirect(`/admin/assignments/${id}/places`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;