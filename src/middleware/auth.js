// =============================================================
// src/middleware/auth.js
// Behörighetsmiddleware för admin-gränssnittet.
//
// Ändringar i denna version:
// 1. requireAssignmentAccess nekar som standard ("fail closed")
//    när inget uppdrags-id kan utläsas ur requesten.
// 2. Redaktörens åtkomst verifieras nu även mot tenant —
//    uppdraget måste tillhöra samma tenant som sessionen.
// =============================================================

'use strict';

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.adminId) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/admin/login');
  }
  next();
}

function requireTenantAdmin(req, res, next) {
  if (!req.session || !req.session.adminId) return res.redirect('/admin/login');
  if (req.session.adminRole !== 'admin' && req.session.adminRole !== 'systemadmin') {
    return res.status(403).render('admin/pages/error', {
      title: 'Åtkomst nekad',
      message: 'Kräver administratörsbehörighet.',
      stack: null, detail: null,
    });
  }
  next();
}

function denyAssignmentAccess(res, message) {
  return res.status(403).render('admin/pages/error', {
    title: 'Åtkomst nekad',
    message: message || 'Du är inte tilldelad detta uppdrag.',
    stack: null,
    detail: null,
  });
}

async function requireAssignmentAccess(req, res, next) {
  if (!req.session || !req.session.adminId) return res.redirect('/admin/login');

  // Tenant-admins och systemadmins har full åtkomst inom sin tenant —
  // route-handlarna filtrerar redan sina queries på tenant_id.
  if (req.session.adminRole === 'admin' || req.session.adminRole === 'systemadmin') {
    return next();
  }

  const assignmentId =
    req.params.assignmentId ||
    req.params.id ||
    req.query.assignmentId ||
    (req.body && req.body.assignment_id);

  // FAIL CLOSED: kan vi inte avgöra vilket uppdrag det gäller
  // släpps redaktören inte igenom (tidigare: return next()).
  if (!assignmentId || !/^\d+$/.test(String(assignmentId))) {
    return denyAssignmentAccess(res, 'Uppdraget kunde inte identifieras.');
  }

  try {
    const { queryOne } = require('../config/database');

    // Kontrollera BÅDE tilldelning och att uppdraget tillhör
    // redaktörens tenant.
    const access = await queryOne(
      `SELECT ae.id
       FROM assignment_editors ae
       JOIN assignments a ON a.id = ae.assignment_id
       WHERE ae.assignment_id = ?
         AND ae.admin_id = ?
         AND a.tenant_id = ?`,
      [assignmentId, req.session.adminId, req.session.tenantId]
    );

    if (!access) return denyAssignmentAccess(res);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAdmin, requireTenantAdmin, requireAssignmentAccess };
