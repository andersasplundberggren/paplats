'use strict';

function createCsrfMiddleware() {
  return function csrfStub(req, res, next) {
    req.csrfToken = () => 'csrf-disabled';
    next();
  };
}

module.exports = { createCsrfMiddleware };
