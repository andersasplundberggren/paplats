'use strict';

require('dotenv').config();

const db = require('../src/config/database');
const testConnection = db.testConnection;

const sessionCleanupService = require('../src/services/sessionCleanupService');

const APPLY = process.argv.indexOf('--apply') !== -1;
const VERBOSE = process.argv.indexOf('--verbose') !== -1;

function printCandidate(row) {
  console.log(
    '- session_id=' + row.sessionId +
    ' assignment_id=' + row.assignmentId +
    ' assignment_title=' + (row.assignmentTitle || 'NULL') +
    ' retention_mode=' + (row.retentionMode || 'auto') +
    ' retention_hours=' + row.retentionHours +
    ' retention_days=' + row.retentionDays +
    ' started_at=' + row.startedAt +
    ' completed_at=' + (row.completedAt || 'NULL') +
    ' nickname=' + (row.nickname || 'NULL') +
    ' contact=' + (row.contact || 'NULL')
  );
}

async function main() {
  await testConnection();

  var result;

  if (APPLY) {
    result = await sessionCleanupService.applyExpiredAutoSessions();
  } else {
    result = await sessionCleanupService.previewExpiredAutoSessions();
  }

  console.log('========================================');
  console.log('Gallring av användarsessioner');
  console.log('========================================');
  console.log('Läge: ' + (APPLY ? 'SKARP KÖRNING' : 'TORRKÖRNING'));
  console.log('Filter: endast uppdrag med automatisk gallring');
  console.log('');

  if (!result.candidateCount) {
    console.log('Inga användarsessioner uppfyller gallringsregeln.');
    return;
  }

  console.log('Sessioner att gallra: ' + result.candidateCount);
  console.log('Tillhörande user_progress rader: ' + result.progressCount);
  console.log('Tillhörande user_notes rader: ' + result.notesCount);
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
    return;
  }

  console.log('Raderade användarsessioner: ' + result.deletedCount);
  console.log('Relaterade user_progress och user_notes raderades automatiskt via ON DELETE CASCADE.');
}

main().catch(function (err) {
  console.error('[cleanupUserSessions] Fel:', err);
  process.exit(1);
});