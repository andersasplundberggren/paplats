'use strict';

function requireSuperAdmin(req, res, next) {
  if (req.session && req.session.isSuperAdmin && req.session.superAdminId) {
    req.session.touch();
    return next();
  }
  req.session.returnTo = req.originalUrl;
  return res.redirect('/superadmin/login');
}

module.exports = { requireSuperAdmin };
