'use strict';

const express = require('express');
const crypto  = require('crypto');
const { query, queryOne } = require('../../../config/database');

const router = express.Router();

const MAX_MEMBERS = 20;
const TTL_MS      = 24 * 60 * 60 * 1000;

function generateCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function getGroupData(groupId, assignmentId, requestingToken) {
  const members = await query(
    `SELECT gm.id, gm.session_token, gm.nickname, gm.last_seen,
            COALESCE(SUM(up.points_earned), 0) AS total_score,
            GROUP_CONCAT(DISTINCT CASE WHEN up.block_id IS NULL THEN up.place_id END) AS visited_place_ids
     FROM group_members gm
     LEFT JOIN user_sessions us
       ON us.session_token = gm.session_token AND us.assignment_id = ?
     LEFT JOIN user_progress up ON up.session_id = us.id
     WHERE gm.group_id = ?
     GROUP BY gm.id, gm.session_token, gm.nickname, gm.last_seen
     ORDER BY gm.joined_at ASC`,
    [assignmentId, groupId]
  );

  const messages = await query(
    `SELECT id, sender_name, text, sent_at
     FROM group_messages
     WHERE group_id = ?
     ORDER BY sent_at ASC`,
    [groupId]
  );

  return {
    members: members.map(m => ({
      id:             m.id,
      name:           m.nickname || 'Anonym',
      is_me:          m.session_token === requestingToken,
      visited_places: m.visited_place_ids
                        ? m.visited_place_ids.split(',').map(Number)
                        : [],
      total_score:    Number(m.total_score),
      last_seen:      m.last_seen,
    })),
    messages: messages.map(m => ({
      id:          m.id,
      sender_name: m.sender_name || 'Anonym',
      text:        m.text,
      sent_at:     m.sent_at,
    })),
  };
}

// POST /api/v1/groups — skapa ny grupp
router.post('/', async (req, res) => {
  const { session_token } = req.body;
  if (!session_token) return res.status(400).json({ error: 'session_token krävs.' });

  try {
    const session = await queryOne(
      'SELECT id, assignment_id, nickname FROM user_sessions WHERE session_token = ?',
      [session_token]
    );
    if (!session) return res.status(404).json({ error: 'Session hittades inte.' });

    const assignment = await queryOne(
      'SELECT tenant_id FROM assignments WHERE id = ?',
      [session.assignment_id]
    );
    if (!assignment) return res.status(404).json({ error: 'Uppdraget hittades inte.' });

    const group_token = crypto.randomBytes(24).toString('hex');

    let group_code, attempts = 0;
    do {
      group_code = generateCode(6);
      const exists = await queryOne('SELECT id FROM groups WHERE group_code = ?', [group_code]);
      if (!exists) break;
    } while (++attempts < 10);

    const result = await query(
      `INSERT INTO groups (group_token, group_code, assignment_id, tenant_id)
       VALUES (?, ?, ?, ?)`,
      [group_token, group_code, session.assignment_id, assignment.tenant_id]
    );
    const group_id = result.insertId;

    await query(
      `INSERT INTO group_members (group_id, session_token, nickname)
       VALUES (?, ?, ?)`,
      [group_id, session_token, session.nickname || null]
    );

    const { members, messages } = await getGroupData(group_id, session.assignment_id, session_token);

    res.json({ group_token, group_code, members, messages });
  } catch (err) {
    console.error('[Groups/create]', err);
    res.status(500).json({ error: 'Serverfel.' });
  }
});

// POST /api/v1/groups/:code/join — gå med i befintlig grupp
router.post('/:code/join', async (req, res) => {
  const { session_token } = req.body;
  const group_code = req.params.code.toUpperCase().trim();

  if (!session_token) return res.status(400).json({ error: 'session_token krävs.' });

  try {
    const group = await queryOne(
      'SELECT * FROM groups WHERE group_code = ?',
      [group_code]
    );
    if (!group) return res.status(404).json({ error: 'Ingen grupp hittades med den koden.' });

    if (Date.now() - new Date(group.created_at).getTime() > TTL_MS) {
      return res.status(410).json({ error: 'Den här gruppen har gått ut (24 timmar).' });
    }

    const session = await queryOne(
      'SELECT id, assignment_id, nickname FROM user_sessions WHERE session_token = ? AND assignment_id = ?',
      [session_token, group.assignment_id]
    );
    if (!session) {
      return res.status(400).json({ error: 'Din session tillhör inte samma uppdrag som gruppen.' });
    }

    const { count } = await queryOne(
      'SELECT COUNT(*) AS count FROM group_members WHERE group_id = ?',
      [group.id]
    );
    if (count >= MAX_MEMBERS) {
      return res.status(409).json({ error: `Gruppen är full (max ${MAX_MEMBERS} spelare).` });
    }

    const existing = await queryOne(
      'SELECT id FROM group_members WHERE group_id = ? AND session_token = ?',
      [group.id, session_token]
    );
    if (!existing) {
      await query(
        `INSERT INTO group_members (group_id, session_token, nickname)
         VALUES (?, ?, ?)`,
        [group.id, session_token, session.nickname || null]
      );
    }

    const { members, messages } = await getGroupData(group.id, group.assignment_id, session_token);

    res.json({
      group_token: group.group_token,
      group_code:  group.group_code,
      members,
      messages,
    });
  } catch (err) {
    console.error('[Groups/join]', err);
    res.status(500).json({ error: 'Serverfel.' });
  }
});

// GET /api/v1/groups/:token — hämta grupptillstånd (polling)
router.get('/:token', async (req, res) => {
  const group_token   = req.params.token;
  const session_token = req.query.session_token;

  try {
    const group = await queryOne(
      'SELECT * FROM groups WHERE group_token = ?',
      [group_token]
    );
    if (!group) return res.status(404).json({ error: 'Gruppen hittades inte.' });

    if (session_token) {
      await query(
        `UPDATE group_members SET last_seen = NOW()
         WHERE group_id = ? AND session_token = ?`,
        [group.id, session_token]
      );
    }

    const { members, messages } = await getGroupData(group.id, group.assignment_id, session_token);

    res.json({
      group_token: group.group_token,
      group_code:  group.group_code,
      members,
      messages,
    });
  } catch (err) {
    console.error('[Groups/fetch]', err);
    res.status(500).json({ error: 'Serverfel.' });
  }
});

// POST /api/v1/groups/:token/messages — skicka chattmeddelande
router.post('/:token/messages', async (req, res) => {
  const { session_token, text } = req.body;
  const group_token = req.params.token;

  if (!text?.trim())     return res.status(400).json({ error: 'text krävs.' });
  if (!session_token)    return res.status(400).json({ error: 'session_token krävs.' });

  try {
    const group = await queryOne(
      'SELECT id FROM groups WHERE group_token = ?',
      [group_token]
    );
    if (!group) return res.status(404).json({ error: 'Gruppen hittades inte.' });

    const member = await queryOne(
      'SELECT nickname FROM group_members WHERE group_id = ? AND session_token = ?',
      [group.id, session_token]
    );
    if (!member) return res.status(403).json({ error: 'Du är inte med i den här gruppen.' });

    await query(
      `INSERT INTO group_messages (group_id, session_token, sender_name, text)
       VALUES (?, ?, ?, ?)`,
      [group.id, session_token, member.nickname || 'Anonym', text.trim().substring(0, 1000)]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[Groups/messages]', err);
    res.status(500).json({ error: 'Serverfel.' });
  }
});

module.exports = router;
