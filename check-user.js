require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.query('SELECT id, email, role, status FROM users WHERE email = $1', ['test@lara.com'])
  .then(result => {
    if (result.rows.length === 0) {
      console.log('❌ Usuario NO existe en la BD');
    } else {
      console.log('✅ Usuario encontrado:');
      console.log(result.rows[0]);
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
