// =============================================================
// src/middleware/validate.js
// Shared validation rules and error-handling middleware.
// Uses express-validator.
// =============================================================

'use strict';

const { validationResult, body, param } = require('express-validator');

/**
 * Call after a validation chain.
 * Returns 422 with structured errors if validation fails.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // If this is an API request return JSON
    if (req.path.startsWith('/api/')) {
      return res.status(422).json({ errors: errors.array() });
    }
    // For admin HTML forms, flash and redirect back
    req.flash('validationErrors', JSON.stringify(errors.array()));
    req.flash('formData', JSON.stringify(req.body));
    return res.redirect('back');
  }
  next();
}

// --- Place validation rules ---
const placeRules = () => [
  body('title')
    .trim().notEmpty().withMessage('Title is required')
    .isLength({ max: 255 }).withMessage('Title too long'),
  body('latitude')
    .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('longitude')
    .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('activation_radius_meters')
    .isInt({ min: 1, max: 10000 }).withMessage('Radius must be 1–10 000 m'),
  body('preferred_bearing_degrees')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0, max: 360 }).withMessage('Bearing must be 0–360'),
  body('preferred_distance_meters')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 }).withMessage('Distance must be positive'),
  body('status')
    .isIn(['published', 'draft']).withMessage('Status must be published or draft'),
  body('category_id')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 }).withMessage('Invalid category'),
  body('sort_order')
    .optional()
    .isInt().withMessage('Sort order must be an integer'),
];

// --- Category validation rules ---
const categoryRules = () => [
  body('name')
    .trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name too long'),
];

// --- Admin login rules ---
const loginRules = () => [
  body('email')
    .trim().isEmail().withMessage('Valid email required'),
  body('password')
    .notEmpty().withMessage('Password required'),
];

module.exports = {
  handleValidationErrors,
  placeRules,
  categoryRules,
  loginRules,
};
