require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function createUser() {
  const email = 'test@lara.com';
  const password = 'test123456';
  const passwordHash = await bcrypt.hash(password, 10);

  const sql = `
    INSERT INTO users (id, email, password_hash, role, status)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (email) DO NOTHING
  `;

  const id = 'user_' + Date.now();

  try {
    await pool.query(sql, [id, email, passwordHash, 'analyst', 'approved']);
    console.log('✅ Usuario creado:', email);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createUser();
