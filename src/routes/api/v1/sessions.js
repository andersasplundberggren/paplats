'use strict';

const express = require('express');
const crypto = require('crypto');
const { query, queryOne } = require('../../../config/database');

const router = express.Router();

// POST /api/v1/sessions
// Starta en session för ett uppdrag.
router.post('/', async (req, res) => {
  const { access_code, nickname, contact } = req.body;

  if (!access_code) {
    return res.status(400).json({ error: 'access_code krävs.' });
  }

  try {
    const assignment = await queryOne(
      `SELECT id, max_participants
       FROM assignments
       WHERE access_code=? AND status='published'`,
      [access_code.toUpperCase().trim()]
    );

    if (!assignment) {
      return res.status(404).json({ error: 'Inget aktivt uppdrag hittades.' });
    }

    if (assignment.max_participants) {
      const { count } = await queryOne(
        'SELECT COUNT(*) AS count FROM user_sessions WHERE assignment_id=?',
        [assignment.id]
      );

      if (count >= assignment.max_participants) {
        return res.status(403).json({ error: 'Max antal deltagare har uppnåtts.' });
      }
    }

    const token = crypto.randomBytes(32).toString('hex');

    await query(
      'INSERT INTO user_sessions (assignment_id, session_token, nickname, contact) VALUES (?,?,?,?)',
      [assignment.id, token, nickname || null, contact || null]
    );

    res.json({ data: { session_token: token } });
  } catch (err) {
    console.error('[API] Session error:', err);
    res.status(500).json({ error: 'Serverfel.' });
  }
});

// POST /api/v1/sessions/:token/progress
// Registrera besök, svar på fråga eller lösning.
router.post('/:token/progress', async (req, res) => {
  const { token } = req.params;
  const { place_id, block_id, chosen_option, solution_text } = req.body;

  if (!place_id) {
    return res.status(400).json({ error: 'place_id krävs.' });
  }

  try {
    const session = await queryOne(
      'SELECT id, assignment_id FROM user_sessions WHERE session_token=?',
      [token]
    );

    if (!session) {
      return res.status(404).json({ error: 'Session hittades inte.' });
    }

    // Rent platsbesök utan block — förhindra dubbletter
    if (!block_id) {
      const existing = await queryOne(
        `SELECT id FROM user_progress
         WHERE session_id=? AND place_id=? AND block_id IS NULL`,
        [session.id, place_id]
      );

      if (existing) {
        // Redan registrerat — returnera OK utan att skriva igen
        return res.json({ data: { is_correct: null, points_earned: 0 } });
      }

      await query(
        `INSERT INTO user_progress
           (session_id, place_id, block_id, chosen_option, is_correct, points_earned, solution_text)
         VALUES (?,?,NULL,NULL,NULL,0,NULL)`,
        [session.id, place_id]
      );

      return res.json({ data: { is_correct: null, points_earned: 0 } });
    }

    // Block med svar — lås redan sparade svar eller lösningar
    if (chosen_option || solution_text) {
      const existing = await queryOne(
        `SELECT chosen_option, solution_text, is_correct, points_earned
         FROM user_progress
         WHERE session_id=? AND place_id=? AND block_id=?`,
        [session.id, place_id, block_id]
      );

      const hasLockedAnswer = existing && (
        existing.chosen_option !== null ||
        existing.solution_text !== null
      );

      if (hasLockedAnswer) {
        return res.status(409).json({
          error: 'Svar är redan registrerat för detta block.',
          data: {
            locked: true,
            chosen_option: existing.chosen_option,
            solution_text: existing.solution_text,
            is_correct: existing.is_correct,
            points_earned: existing.points_earned,
          }
        });
      }
    }

    let is_correct = null;
    let points_earned = 0;

    if (chosen_option) {
      const block = await queryOne(
        'SELECT correct_option, points FROM place_content_blocks WHERE id=? AND place_id=?',
        [block_id, place_id]
      );

      if (block && block.correct_option) {
        is_correct = chosen_option.toLowerCase() === block.correct_option.toLowerCase() ? 1 : 0;
        points_earned = is_correct ? (block.points || 0) : 0;
      }
    }

    if (solution_text) {
      const block = await queryOne(
        'SELECT solution_answer, solution_points FROM place_content_blocks WHERE id=? AND place_id=?',
        [block_id, place_id]
      );

      if (block && block.solution_answer) {
        is_correct =
          solution_text.trim().toLowerCase() ===
          block.solution_answer.trim().toLowerCase()
            ? 1
            : 0;

        points_earned = is_correct ? (block.solution_points || 0) : 0;
      }
    }

    await query(
      `INSERT INTO user_progress
         (session_id, place_id, block_id, chosen_option, is_correct, points_earned, solution_text)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         chosen_option=VALUES(chosen_option),
         is_correct=VALUES(is_correct),
         points_earned=VALUES(points_earned),
         solution_text=VALUES(solution_text)`,
      [
        session.id,
        place_id,
        block_id,
        chosen_option || null,
        is_correct,
        points_earned,
        solution_text || null,
      ]
    );

    res.json({
      is_correct: is_correct,
      points_earned: points_earned,
      data: {
        is_correct: is_correct,
        points_earned: points_earned,
      }
    });
  } catch (err) {
    console.error('[API] Progress error:', err);
    res.status(500).json({ error: 'Serverfel.' });
  }
});

// GET /api/v1/sessions/:token
// Hämta sessionsresultat.
router.get('/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const session = await queryOne(
      `SELECT us.id, us.nickname, us.started_at, us.completed_at,
              a.title AS assignment_title, a.type, a.grading_mode,
              us.event_id
       FROM user_sessions us
       JOIN assignments a ON a.id = us.assignment_id
       WHERE us.session_token=?`,
      [token]
    );

    if (!session) {
      return res.status(404).json({ error: 'Session hittades inte.' });
    }

    const progress = await query(
      `SELECT up.place_id, up.block_id, up.chosen_option, up.solution_text,
              up.is_correct, up.points_earned, up.visited_at,
              p.title AS place_title
       FROM user_progress up
       JOIN places p ON p.id = up.place_id
       WHERE up.session_id=?
       ORDER BY up.visited_at ASC`,
      [session.id]
    );

    const totalScore = progress.reduce((sum, row) => sum + (row.points_earned || 0), 0);

    const notes = await queryOne(
      'SELECT content FROM user_notes WHERE session_id=?',
      [session.id]
    );

    res.json({
      data: {
        ...session,
        total_score: totalScore,
        progress,
        notes: notes?.content || '',
      }
    });
  } catch (err) {
    console.error('[API] Session get error:', err);
    res.status(500).json({ error: 'Serverfel.' });
  }
});

// PUT /api/v1/sessions/:token/notes
// Spara minnesbok.
router.put('/:token/notes', async (req, res) => {
  const { token } = req.params;
  const { content } = req.body;

  try {
    const session = await queryOne(
      'SELECT id FROM user_sessions WHERE session_token=?',
      [token]
    );

    if (!session) {
      return res.status(404).json({ error: 'Session hittades inte.' });
    }

    await query(
      `INSERT INTO user_notes (session_id, content) VALUES (?,?)
       ON DUPLICATE KEY UPDATE content=VALUES(content)`,
      [session.id, content || '']
    );

    res.json({ data: { saved: true } });
  } catch (err) {
    res.status(500).json({ error: 'Serverfel.' });
  }
});

// POST /api/v1/sessions/:token/complete
// Markera session som avslutad.
router.post('/:token/complete', async (req, res) => {
  const { token } = req.params;

  try {
    await query(
      'UPDATE user_sessions SET completed_at=NOW() WHERE session_token=? AND completed_at IS NULL',
      [token]
    );

    res.json({ data: { completed: true } });
  } catch (err) {
    res.status(500).json({ error: 'Serverfel.' });
  }
});

// GET /api/v1/sessions/:token/leaderboard
// Hämtar topplista för det uppdrag som sessionen tillhör.
router.get('/:token/leaderboard', async (req, res) => {
  const { token } = req.params;
  const groupToken = req.query.group || null;

  try {
    const session = await queryOne(
      'SELECT id, assignment_id FROM user_sessions WHERE session_token=?',
      [token]
    );

    if (!session) {
      return res.status(404).json({ error: 'Session hittades inte.' });
    }

    const groupFilter = groupToken
      ? `AND us.session_token IN (
           SELECT gm.session_token FROM group_members gm
           INNER JOIN \`groups\` g ON g.id = gm.group_id
           WHERE g.group_token = ?
         )`
      : '';

    const rows = await query(
      `SELECT
         us.session_token,
         us.nickname,
         us.started_at,
         us.completed_at,
         COALESCE(SUM(up.points_earned), 0) AS total_score,
         COUNT(CASE WHEN up.is_correct = 1 THEN 1 END) AS correct_count,
         COUNT(DISTINCT CASE WHEN up.block_id IS NULL THEN up.place_id END) AS places_visited
       FROM user_sessions us
       LEFT JOIN user_progress up ON up.session_id = us.id
       WHERE us.assignment_id = ?
       AND us.started_at > NOW() - INTERVAL 48 HOUR
       ${groupFilter}
       GROUP BY us.id
       ORDER BY total_score DESC, correct_count DESC, us.completed_at ASC`,
      groupToken ? [session.assignment_id, groupToken] : [session.assignment_id]
    );

    const entries = rows.map((r, i) => ({
      rank: i + 1,
      is_me: r.session_token === token,
      nickname: r.nickname || 'Anonym',
      total_score: Number(r.total_score),
      correct_count: Number(r.correct_count),
      places_visited: Number(r.places_visited),
      completed: !!r.completed_at,
      time_seconds: r.completed_at && r.started_at
        ? Math.round((new Date(r.completed_at) - new Date(r.started_at)) / 1000)
        : null,
    }));

    res.json({ data: { entries } });
  } catch (err) {
    console.error('[API] Leaderboard error:', err);
    res.status(500).json({ error: 'Serverfel.' });
  }
});

module.exports = router;