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

async function requireAssignmentAccess(req, res, next) {
  if (!req.session || !req.session.adminId) return res.redirect('/admin/login');
  if (req.session.adminRole === 'admin' || req.session.adminRole === 'systemadmin') return next();

  const assignmentId = req.params.assignmentId
    || req.params.id
    || req.query.assignmentId
    || (req.body && req.body.assignment_id);

  if (!assignmentId) return next();

  try {
    const { queryOne } = require('../config/database');
    const access = await queryOne(
      'SELECT id FROM assignment_editors WHERE assignment_id=? AND admin_id=?',
      [assignmentId, req.session.adminId]
    );
    if (!access) {
      return res.status(403).render('admin/pages/error', {
        title: 'Åtkomst nekad', message: 'Du är inte tilldelad detta uppdrag.',
        stack: null, detail: null,
      });
    }
    next();
  } catch (err) { next(err); }
}

module.exports = { requireAdmin, requireTenantAdmin, requireAssignmentAccess };