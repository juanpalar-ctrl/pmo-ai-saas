require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function resetUser() {
  const email = 'test@lara.com';
  const password = 'test123456';
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query(
      'UPDATE users SET password_hash = $1, status = $2 WHERE email = $3 RETURNING email, status',
      [passwordHash, 'approved', email]
    );

    if (result.rows.length === 0) {
      console.log('❌ Usuario no encontrado');
      process.exit(1);
    }

    console.log('✅ Contraseña actualizada:', result.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

resetUser();
