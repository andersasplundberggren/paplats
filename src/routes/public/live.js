'use strict';

const express = require('express');
const { query, queryOne } = require('../../config/database');

const router = express.Router();

// ─── Hjälpfunktion: hämta live-data via results_token ────────
async function getLiveDataByToken(token, filters = {}) {
  const { status = 'all', q = '' } = filters;

  const assignment = await queryOne(
    `SELECT id, title, type, access_code, results_token, status AS assignment_status
     FROM assignments
     WHERE results_token = ? AND status = 'published'`,
    [token]
  );

  if (!assignment) return null;

  let sql = `
    SELECT
      us.id, us.nickname,
      us.started_at, us.completed_at,
      COALESCE(SUM(up.points_earned), 0) AS total_score,
      SUM(CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
      COUNT(DISTINCT CASE WHEN up.block_id IS NULL THEN up.place_id END) AS visited_places,
      MAX(up.visited_at) AS last_activity
    FROM user_sessions us
    LEFT JOIN user_progress up ON up.session_id = us.id
    WHERE us.assignment_id = ?
  `;
  const params = [assignment.id];

  if (status === 'active') {
    sql += ' AND us.completed_at IS NULL';
  } else if (status === 'completed') {
    sql += ' AND us.completed_at IS NOT NULL';
  }

  if (q) {
    sql += ' AND us.nickname LIKE ?';
    params.push(`%${q}%`);
  }

  sql += ' GROUP BY us.id, us.nickname, us.started_at, us.completed_at ORDER BY us.started_at DESC';

  const sessions = await query(sql, params);

  const placeRows = await query(
    'SELECT COUNT(*) AS place_count FROM places WHERE assignment_id = ? AND status = ?',
    [assignment.id, 'published']
  );
  const place_count = placeRows[0]?.place_count || 0;

  return { assignment, sessions, place_count };
}

// GET /live/:token — publik live-sida
router.get('/:token', async (req, res, next) => {
  const { token } = req.params;
  const { status = 'all', q = '' } = req.query;

  try {
    const data = await getLiveDataByToken(token, { status, q });

    if (!data) {
      return res.status(404).render('admin/pages/error', {
        title: '404',
        message: 'Sidan hittades inte eller uppdraget är inte aktivt.',
        stack: null,
        detail: null,
      });
    }

    res.render('admin/pages/assignments/live', {
      title: `Live: ${data.assignment.title}`,
      assignment: data.assignment,
      sessions: data.sessions,
      place_count: data.place_count,
      filters: { status, q },
      publicUrl: `${req.protocol}://${req.get('host')}/live/${token}`,
      isPublic: true,
      csrfToken: '',
      success: null,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /live/:token/data — JSON-endpoint för polling
router.get('/:token/data', async (req, res, next) => {
  const { token } = req.params;
  const { status = 'all', q = '' } = req.query;

  try {
    const data = await getLiveDataByToken(token, { status, q });

    if (!data) {
      return res.status(404).json({ error: 'Hittades inte.' });
    }

    res.json({
      sessions: data.sessions,
      place_count: data.place_count,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;