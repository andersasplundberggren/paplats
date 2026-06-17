'use strict';

const express = require('express');
const { query, queryOne } = require('../../../config/database');

const router = express.Router();

const MAX_MEMBERS   = 15;
const TTL_HOURS     = 24;
const TTL_MS        = TTL_HOURS * 60 * 60 * 1000;

// ─── Hjälp: generera slumpmässig inbjudningskod ──────────────
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ─── Hjälp: kontrollera att uppdraget är av typ trail ────────
async function isTrailAssignment(assignmentId) {
  const row = await queryOne(
    'SELECT type FROM assignments WHERE id = ? AND status = "published"',
    [assignmentId]
  );
  return row && row.type === 'trail';
}

// ─── Hjälp: kontrollera att event är aktivt (< 24h) ─────────
function isEventActive(createdAt) {
  return Date.now() - new Date(createdAt).getTime() < TTL_MS;
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/events/create
// Skapar ett nytt event för ett trail-uppdrag.
// Body: { assignment_id, group_name, session_token, display_name }
// ─────────────────────────────────────────────────────────────
router.post('/create', async (req, res) => {
  const { assignment_id, group_name, session_token, display_name } = req.body;

  if (!assignment_id || !session_token) {
    return res.status(400).json({ error: 'assignment_id och session_token krävs.' });
  }

  if (!group_name || !group_name.trim()) {
    return res.status(400).json({ error: 'Gruppnamn krävs.' });
  }

  try {
    // Kontrollera att uppdraget är en trail
    const isTrail = await isTrailAssignment(assignment_id);
    if (!isTrail) {
      return res.status(400).json({ error: 'Grupper kan bara skapas för tipspromenader.' });
    }

    // Kontrollera att sessionen existerar
    const session = await queryOne(
      'SELECT id FROM user_sessions WHERE session_token = ? AND assignment_id = ?',
      [session_token, assignment_id]
    );
    if (!session) {
      return res.status(404).json({ error: 'Sessionen hittades inte.' });
    }

    // Generera unik inbjudningskod
    let invite_code;
    let attempts = 0;
    do {
      invite_code = generateInviteCode();
      const existing = await queryOne(
        'SELECT id FROM events WHERE invite_code = ?',
        [invite_code]
      );
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return res.status(500).json({ error: 'Kunde inte generera unik kod. Försök igen.' });
    }

    // Hämta tenant_id från uppdraget
    const assignment = await queryOne(
      'SELECT tenant_id FROM assignments WHERE id = ?',
      [assignment_id]
    );

    // Skapa event
    const result = await query(
      `INSERT INTO events (tenant_id, assignment_id, name, invite_code)
       VALUES (?, ?, ?, ?)`,
      [assignment.tenant_id, assignment_id, group_name.trim().substring(0, 255), invite_code]
    );
    const event_id = result.insertId;

    // Lägg till skaparen som första medlem
    await query(
      `INSERT INTO event_members (event_id, session_token, display_name)
       VALUES (?, ?, ?)`,
      [event_id, session_token, display_name ? display_name.trim().substring(0, 100) : null]
    );

    // Uppdatera sessionen med event_id
    await query(
      'UPDATE user_sessions SET event_id = ? WHERE session_token = ?',
      [event_id, session_token]
    );

    return res.json({
      ok: true,
      event_id,
      invite_code,
      group_name: group_name.trim(),
      expires_at: new Date(Date.now() + TTL_MS).toISOString()
    });

  } catch (err) {
    console.error('[Events/create]', err);
    return res.status(500).json({ error: 'Serverfel. Försök igen.' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/events/join
// Ansluter en spelare till ett befintligt event.
// Body: { invite_code, session_token, display_name }
// ─────────────────────────────────────────────────────────────
router.post('/join', async (req, res) => {
  const { invite_code, session_token, display_name } = req.body;

  if (!invite_code || !session_token) {
    return res.status(400).json({ error: 'invite_code och session_token krävs.' });
  }

  try {
    // Hitta event
    const event = await queryOne(
      'SELECT * FROM events WHERE invite_code = ?',
      [invite_code.trim().toUpperCase()]
    );

    if (!event) {
      return res.status(404).json({ error: 'Ingen grupp hittades med den koden.' });
    }

    // Kontrollera att event är aktivt
    if (!isEventActive(event.created_at)) {
      return res.status(410).json({ error: 'Den här gruppen har gått ut (24 timmar har passerat).' });
    }

    // Kontrollera att sessionen existerar och tillhör samma uppdrag
    const session = await queryOne(
      'SELECT id FROM user_sessions WHERE session_token = ? AND assignment_id = ?',
      [session_token, event.assignment_id]
    );
    if (!session) {
      return res.status(400).json({ error: 'Din session tillhör inte samma uppdrag som gruppen.' });
    }

    // Kontrollera max-antal medlemmar
    const memberCount = await queryOne(
      'SELECT COUNT(*) as cnt FROM event_members WHERE event_id = ?',
      [event.id]
    );
    if (memberCount.cnt >= MAX_MEMBERS) {
      return res.status(409).json({ error: `Gruppen är full (max ${MAX_MEMBERS} deltagare).` });
    }

    // Kontrollera om spelaren redan är med
    const existing = await queryOne(
      'SELECT id FROM event_members WHERE event_id = ? AND session_token = ?',
      [event.id, session_token]
    );
    if (existing) {
      // Redan med — returnera info utan fel
      await query(
        'UPDATE user_sessions SET event_id = ? WHERE session_token = ?',
        [event.id, session_token]
      );
      return res.json({
        ok: true,
        already_member: true,
        event_id: event.id,
        group_name: event.name,
        invite_code: event.invite_code,
        expires_at: new Date(new Date(event.created_at).getTime() + TTL_MS).toISOString()
      });
    }

    // Lägg till som ny medlem
    await query(
      `INSERT INTO event_members (event_id, session_token, display_name)
       VALUES (?, ?, ?)`,
      [event.id, session_token, display_name ? display_name.trim().substring(0, 100) : null]
    );

    // Uppdatera sessionen
    await query(
      'UPDATE user_sessions SET event_id = ? WHERE session_token = ?',
      [event.id, session_token]
    );

    return res.json({
      ok: true,
      event_id: event.id,
      group_name: event.name,
      invite_code: event.invite_code,
      expires_at: new Date(new Date(event.created_at).getTime() + TTL_MS).toISOString()
    });

  } catch (err) {
    console.error('[Events/join]', err);
    return res.status(500).json({ error: 'Serverfel. Försök igen.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/events/:eventId/leaderboard
// Hämtar topplistan för ett event.
// Query: ?session_token=...
// ─────────────────────────────────────────────────────────────
router.get('/:eventId/leaderboard', async (req, res) => {
  const event_id     = parseInt(req.params.eventId, 10);
  const session_token = req.query.session_token;

  if (!event_id || !session_token) {
    return res.status(400).json({ error: 'event_id och session_token krävs.' });
  }

  try {
    // Hämta event
    const event = await queryOne(
      'SELECT * FROM events WHERE id = ?',
      [event_id]
    );

    if (!event) {
      return res.status(404).json({ error: 'Gruppen hittades inte.' });
    }

    // Kontrollera att event är aktivt
    if (!isEventActive(event.created_at)) {
      return res.status(410).json({ error: 'Den här gruppen har gått ut.' });
    }

    // Verifiera att spelaren är med i eventet
    const member = await queryOne(
      'SELECT id FROM event_members WHERE event_id = ? AND session_token = ?',
      [event_id, session_token]
    );
    if (!member) {
      return res.status(403).json({ error: 'Du är inte med i den här gruppen.' });
    }

    // Hämta topplista — summera poäng per session
  const rows = await query(
  `SELECT
     em.display_name,
     em.session_token,
     COALESCE(SUM(up.points_earned), 0) AS total_points,
     COUNT(DISTINCT up.place_id) AS places_visited,
     COUNT(DISTINCT CASE
       WHEN up.block_id IS NOT NULL
        AND (up.chosen_option IS NOT NULL OR up.solution_text IS NOT NULL)
       THEN up.id
     END) AS answers_given,
     SUM(CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END) AS correct_answers
   FROM event_members em
   LEFT JOIN user_sessions us
     ON us.session_token COLLATE utf8mb4_unicode_ci = em.session_token COLLATE utf8mb4_unicode_ci
    AND us.assignment_id = ?
   LEFT JOIN user_progress up
     ON up.session_id = us.id
   WHERE em.event_id = ?
   GROUP BY em.session_token, em.display_name
   ORDER BY total_points DESC, places_visited DESC`,
  [event.assignment_id, event_id]
);

    const leaderboard = rows.map((row, index) => ({
      rank:            index + 1,
      display_name:    row.display_name || 'Anonym',
      is_me:           row.session_token === session_token,
      total_points:    Number(row.total_points),
      places_visited:  Number(row.places_visited),
      answers_given:   Number(row.answers_given),
      correct_answers: Number(row.correct_answers)
    }));

    return res.json({
      ok: true,
      event_id,
      group_name:  event.name,
      invite_code: event.invite_code,
      member_count: rows.length,
      expires_at:  new Date(new Date(event.created_at).getTime() + TTL_MS).toISOString(),
      leaderboard
    });

  } catch (err) {
    console.error('[Events/leaderboard]', err);
    return res.status(500).json({ error: 'Serverfel.' });
  }
});

module.exports = router;