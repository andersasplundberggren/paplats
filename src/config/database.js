// =============================================================
// src/config/database.js
// MariaDB connection pool using mysql2/promise
// All queries go through the db.query() helper below.
// =============================================================

'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || '127.0.0.1',
  port:               parseInt(process.env.DB_PORT, 10) || 3306,
  database:           process.env.DB_NAME     || 'geoexp',
  user:               process.env.DB_USER     || 'geoexp_user',
  password:           process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  // Ensure MariaDB returns proper JS types
  typeCast: function (field, next) {
    // Return TINYINT(1) as boolean
    if (field.type === 'TINY' && field.length === 1) {
      return field.string() === '1';
    }
    return next();
  },
});

/**
 * Execute a parameterised SQL query.
 * Always use placeholders (?) — never interpolate user input into SQL.
 *
 * @param {string} sql    - SQL with ? placeholders
 * @param {Array}  params - Values matching the placeholders
 * @returns {Promise<Array>} rows
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Get a single row or null.
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/**
 * Run a transaction.
 * @param {Function} fn - async function receiving a connection
 */
async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Test the database connection.
 * Called on startup to fail fast if config is wrong.
 */
async function testConnection() {
  try {
    await query('SELECT 1');
    console.log('[DB] Connected to MariaDB successfully');
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, query, queryOne, transaction, testConnection };
