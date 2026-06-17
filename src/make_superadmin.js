// Kör detta en gång i terminalen:
// node make_superadmin.js
//
// Scriptet gör din befintliga admin till superadmin
// och skapar ett separat superadmin-konto om du vill.

'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  // Visa befintliga admins
  const [admins] = await conn.execute('SELECT id, email, name, role, tenant_id FROM admins');
  console.log('\nBefintliga admins:');
  admins.forEach(a => console.log(`  ID ${a.id}: ${a.email} (${a.role}, tenant: ${a.tenant_id})`));

  // Skapa superadmin-konto
  const superEmail = 'super@pixelworks.se'; // Byt till din e-post
  const superPass  = process.env.SUPER_ADMIN_PASSWORD || 'byt-mig-nu-123!';

  const [existing] = await conn.execute('SELECT id FROM admins WHERE email = ?', [superEmail]);
  if (existing.length > 0) {
    console.log(`\n⚠️  Superadmin ${superEmail} finns redan.`);
  } else {
    const hash = await bcrypt.hash(superPass, 12);
    await conn.execute(
      'INSERT INTO admins (email, name, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, NULL)',
      [superEmail, 'Superadmin', hash, 'superadmin'],
    );
    console.log(`\n✅ Superadmin skapad: ${superEmail}`);
    console.log(`   Lösenord: ${superPass}`);
    console.log('   ⚠️  Byt lösenord efter första inloggning!');
  }

  await conn.end();
  console.log('\nKlart!\n');
}

main().catch(err => {
  console.error('Fel:', err.message);
  process.exit(1);
});
