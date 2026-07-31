require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool();

async function approveUser(email) {
  try {
    const result = await pool.query(
      "UPDATE users SET status = 'approved' WHERE email = $1 RETURNING id, email, status;",
      [email]
    );

    if (result.rows.length === 0) {
      console.log(`❌ Usuario no encontrado: ${email}`);
      return;
    }

    console.log(`✅ Usuario aprobado:`, result.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

const email = process.argv[2] || 'test@lara.com';
approveUser(email);
