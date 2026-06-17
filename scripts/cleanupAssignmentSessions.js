'use strict';
require('dotenv').config();
const db = require('../src/config/database');
const testConnection = db.testConnection;
const sessionCleanupService = require('../src/services/sessionCleanupService');

const APPLY   = process.argv.indexOf('--apply')   !== -1;
const VERBOSE = process.argv.indexOf('--verbose') !== -1;

// ─── Hjälpfunktion: aktuell tid som läsbar sträng ────────────
function timestamp() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' });
}

function getArgValue(name) {
  var prefix = '--' + name + '=';
  var arg = process.argv.find(function (item) {
    return item.indexOf(prefix) === 0;
  });
  if (!arg) {
    return null;
  }
  return arg.slice(prefix.length);
}

function parseAssignmentId() {
  var raw = getArgValue('assignment-id');
  if (!raw) {
    return null;
  }
  var id = parseInt(raw, 10);
  if (isNaN(id) || id < 1) {
    return null;
  }
  return id;
}

function printCandidate(row) {
  console.log(
    '- session_id=' + row.sessionId +
    ' started_at=' + row.startedAt +
    ' completed_at=' + (row.completedAt || 'NULL') +
    ' nickname=' + (row.nickname || 'NULL') +
    ' contact=' + (row.contact || 'NULL')
  );
}

async function main() {
  var assignmentId = parseAssignmentId();
  if (!assignmentId) {
    console.error('[' + timestamp() + '] Du måste ange --assignment-id=<id>');
    process.exit(1);
  }

  await testConnection();

  var result;
  if (APPLY) {
    result = await sessionCleanupService.applyAssignmentSessions(assignmentId);
  } else {
    result = await sessionCleanupService.previewAssignmentSessions(assignmentId);
  }

  if (!result) {
    console.error('[' + timestamp() + '] Uppdraget hittades inte.');
    process.exit(1);
  }

  console.log('========================================');
  console.log('Manuell gallring av användarsessioner — ' + timestamp());
  console.log('========================================');
  console.log('Uppdrag ID: '          + result.assignment.id);
  console.log('Uppdrag: '             + result.assignment.title);
  console.log('Gallringsläge: '       + result.assignment.sessionRetentionMode);
  console.log('Läge: '                + (APPLY ? 'SKARP KÖRNING' : 'TORRKÖRNING'));
  console.log('');

  if (!result.candidateCount) {
    console.log('Det finns inga användarsessioner för detta uppdrag.');
    console.log('[Klart: ' + timestamp() + ']');
    return;
  }

  console.log('Sessioner att gallra: '              + result.candidateCount);
  console.log('Tillhörande user_progress rader: '  + result.progressCount);
  console.log('Tillhörande user_notes rader: '      + result.notesCount);
  console.log('');

  if (VERBOSE || !APPLY) {
    console.log('Kandidater:');
    result.candidates.forEach(function (row) {
      printCandidate(row);
    });
    console.log('');
  }

  if (!APPLY) {
    console.log('Ingen data raderades.');
    console.log('Kör med --apply för att utföra gallringen på riktigt.');
    console.log('[Klart: ' + timestamp() + ']');
    return;
  }

  console.log('Raderade användarsessioner: ' + result.deletedCount);
  console.log('Relaterade user_progress och user_notes raderades automatiskt via ON DELETE CASCADE.');
  console.log('[Klart: ' + timestamp() + ']');
}

main().catch(function (err) {
  console.error('[' + timestamp() + '] [cleanupAssignmentSessions] Fel:', err);
  process.exit(1);
});