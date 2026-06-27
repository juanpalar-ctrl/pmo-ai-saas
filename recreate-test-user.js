require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function recreateUser() {
  // Tomar credenciales de argumentos
  const email = process.argv[2] || 'test@lara.com';
  const password = process.argv[3] || 'test123456';
  
  if (!process.argv[2] || !process.argv[3]) {
    console.log('⚠️  Usando credenciales por defecto. Para custom:');
    console.log('   node recreate-test-user.js <email> <password>');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await pool.query('DELETE FROM users WHERE email = $1', [email]);
    
    await pool.query(
      'INSERT INTO users (id, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5)',
      ['user_' + Date.now(), email, passwordHash, 'analyst', 'approved']
    );
    
    console.log('✅ Usuario creado:', email);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

recreateUser();
