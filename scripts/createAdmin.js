// =============================================================
// scripts/createAdmin.js
// Run once: node scripts/createAdmin.js
// Creates the first admin account interactively.
// =============================================================

'use strict';

require('dotenv').config();

const readline = require('readline');
const bcrypt   = require('bcryptjs');
const { query, queryOne, pool } = require('../src/config/database');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

async function main() {
  console.log('\n=== GeoExp — Create Admin Account ===\n');

  const email    = (await ask('Email: ')).trim();
  const name     = (await ask('Name: ')).trim();
  const password = (await ask('Password (min 10 chars): ')).trim();
  const confirm  = (await ask('Confirm password: ')).trim();

  rl.close();

  if (!email || !name || !password) {
    console.error('\n[Error] All fields are required.');
    process.exit(1);
  }

  if (password !== confirm) {
    console.error('\n[Error] Passwords do not match.');
    process.exit(1);
  }

  if (password.length < 10) {
    console.error('\n[Error] Password must be at least 10 characters.');
    process.exit(1);
  }

  const existing = await queryOne('SELECT id FROM admins WHERE email = ?', [email]);
  if (existing) {
    console.error(`\n[Error] An admin with email "${email}" already exists.`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  const result = await query(
    'INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)',
    [email, name, hash],
  );

  console.log(`\n[OK] Admin created (ID: ${result.insertId}).`);
  console.log(`     Email: ${email}`);
  console.log(`     Name:  ${name}`);
  console.log('\nYou can now log in at /admin/login\n');

  await pool.end();
}

main().catch(err => {
  console.error('\n[Error]', err.message);
  process.exit(1);
});
