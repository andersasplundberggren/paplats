'use strict';

const { transaction } = require('../config/database');

function safeCount(rows) {
  return (rows && rows[0] && rows[0].count) || 0;
}

function normalizeRetentionHours(value, fallbackHours) {
  var hours = parseInt(value, 10);

  if (isNaN(hours) || hours < 1) {
    return fallbackHours;
  }

  return hours;
}

function formatRetentionDays(hours) {
  var safeHours = normalizeRetentionHours(hours, 48);
  var days = safeHours / 24;

  if (Math.floor(days) === days) {
    return String(days);
  }

  return days.toFixed(2);
}

async function getAssignmentById(conn, assignmentId) {
  var result = await conn.execute(
    'SELECT id, title, session_retention_mode, session_retention_hours ' +
    'FROM assignments ' +
    'WHERE id = ?',
    [assignmentId]
  );

  var rows = result[0];
  return rows && rows[0] ? rows[0] : null;
}

async function getExpiredAutoSessionCandidates(conn) {
  var result = await conn.execute(
    'SELECT ' +
      'us.id, ' +
      'us.assignment_id, ' +
      'us.session_token, ' +
      'us.nickname, ' +
      'us.contact, ' +
      'us.started_at, ' +
      'us.completed_at, ' +
      'a.title AS assignment_title, ' +
      'a.session_retention_mode, ' +
      'a.session_retention_hours ' +
    'FROM user_sessions us ' +
    'JOIN assignments a ON a.id = us.assignment_id ' +
    'WHERE a.session_retention_mode = ? ' +
      'AND COALESCE(a.session_retention_hours, 48) > 0 ' +
      'AND COALESCE(us.completed_at, us.started_at) < DATE_SUB(NOW(), INTERVAL COALESCE(a.session_retention_hours, 48) HOUR) ' +
    'ORDER BY COALESCE(us.completed_at, us.started_at) ASC',
    ['auto']
  );

  return result[0];
}

async function getAssignmentSessionCandidates(conn, assignmentId) {
  var result = await conn.execute(
    'SELECT ' +
      'id, ' +
      'assignment_id, ' +
      'session_token, ' +
      'nickname, ' +
      'contact, ' +
      'started_at, ' +
      'completed_at ' +
    'FROM user_sessions ' +
    'WHERE assignment_id = ? ' +
    'ORDER BY COALESCE(completed_at, started_at) ASC',
    [assignmentId]
  );

  return result[0];
}

async function countRelatedRows(conn, sessionIds) {
  if (!sessionIds.length) {
    return {
      notesCount: 0,
      progressCount: 0
    };
  }

  var placeholders = sessionIds.map(function () { return '?'; }).join(',');

  var notesResult = await conn.execute(
    'SELECT COUNT(*) AS count ' +
    'FROM user_notes ' +
    'WHERE session_id IN (' + placeholders + ')',
    sessionIds
  );

  var progressResult = await conn.execute(
    'SELECT COUNT(*) AS count ' +
    'FROM user_progress ' +
    'WHERE session_id IN (' + placeholders + ')',
    sessionIds
  );

  return {
    notesCount: safeCount(notesResult[0]),
    progressCount: safeCount(progressResult[0])
  };
}

async function deleteSessions(conn, sessionIds) {
  if (!sessionIds.length) {
    return 0;
  }

  var placeholders = sessionIds.map(function () { return '?'; }).join(',');

  var result = await conn.execute(
    'DELETE FROM user_sessions ' +
    'WHERE id IN (' + placeholders + ')',
    sessionIds
  );

  return (result[0] && result[0].affectedRows) || 0;
}

function enrichAutoSessionRows(rows) {
  return rows.map(function (row) {
    var retentionHours = normalizeRetentionHours(row.session_retention_hours, 48);

    return {
      sessionId: row.id,
      assignmentId: row.assignment_id,
      assignmentTitle: row.assignment_title || null,
      sessionToken: row.session_token,
      nickname: row.nickname || null,
      contact: row.contact || null,
      startedAt: row.started_at,
      completedAt: row.completed_at || null,
      retentionMode: row.session_retention_mode || 'auto',
      retentionHours: retentionHours,
      retentionDays: formatRetentionDays(retentionHours)
    };
  });
}

function enrichAssignmentSessionRows(rows) {
  return rows.map(function (row) {
    return {
      sessionId: row.id,
      assignmentId: row.assignment_id,
      sessionToken: row.session_token,
      nickname: row.nickname || null,
      contact: row.contact || null,
      startedAt: row.started_at,
      completedAt: row.completed_at || null
    };
  });
}

async function previewExpiredAutoSessions() {
  return transaction(async function (conn) {
    var rows = await getExpiredAutoSessionCandidates(conn);
    var candidates = enrichAutoSessionRows(rows);
    var sessionIds = candidates.map(function (row) { return row.sessionId; });
    var related = await countRelatedRows(conn, sessionIds);

    return {
      mode: 'auto',
      candidateCount: candidates.length,
      progressCount: related.progressCount,
      notesCount: related.notesCount,
      candidates: candidates
    };
  });
}

async function applyExpiredAutoSessions() {
  return transaction(async function (conn) {
    var rows = await getExpiredAutoSessionCandidates(conn);
    var candidates = enrichAutoSessionRows(rows);
    var sessionIds = candidates.map(function (row) { return row.sessionId; });
    var related = await countRelatedRows(conn, sessionIds);
    var deletedCount = await deleteSessions(conn, sessionIds);

    return {
      mode: 'auto',
      candidateCount: candidates.length,
      deletedCount: deletedCount,
      progressCount: related.progressCount,
      notesCount: related.notesCount,
      candidates: candidates
    };
  });
}

async function previewAssignmentSessions(assignmentId) {
  return transaction(async function (conn) {
    var assignment = await getAssignmentById(conn, assignmentId);

    if (!assignment) {
      return null;
    }

    var rows = await getAssignmentSessionCandidates(conn, assignmentId);
    var candidates = enrichAssignmentSessionRows(rows);
    var sessionIds = candidates.map(function (row) { return row.sessionId; });
    var related = await countRelatedRows(conn, sessionIds);

    return {
      assignment: {
        id: assignment.id,
        title: assignment.title,
        sessionRetentionMode: assignment.session_retention_mode || 'auto',
        sessionRetentionHours: assignment.session_retention_hours
      },
      candidateCount: candidates.length,
      progressCount: related.progressCount,
      notesCount: related.notesCount,
      candidates: candidates
    };
  });
}

async function applyAssignmentSessions(assignmentId) {
  return transaction(async function (conn) {
    var assignment = await getAssignmentById(conn, assignmentId);

    if (!assignment) {
      return null;
    }

    var rows = await getAssignmentSessionCandidates(conn, assignmentId);
    var candidates = enrichAssignmentSessionRows(rows);
    var sessionIds = candidates.map(function (row) { return row.sessionId; });
    var related = await countRelatedRows(conn, sessionIds);
    var deletedCount = await deleteSessions(conn, sessionIds);

    return {
      assignment: {
        id: assignment.id,
        title: assignment.title,
        sessionRetentionMode: assignment.session_retention_mode || 'auto',
        sessionRetentionHours: assignment.session_retention_hours
      },
      candidateCount: candidates.length,
      deletedCount: deletedCount,
      progressCount: related.progressCount,
      notesCount: related.notesCount,
      candidates: candidates
    };
  });
}

module.exports = {
  previewExpiredAutoSessions: previewExpiredAutoSessions,
  applyExpiredAutoSessions: applyExpiredAutoSessions,
  previewAssignmentSessions: previewAssignmentSessions,
  applyAssignmentSessions: applyAssignmentSessions,
  formatRetentionDays: formatRetentionDays
};