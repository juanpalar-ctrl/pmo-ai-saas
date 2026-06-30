require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = `
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS password_resets CASCADE;

CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'analyst',
  status VARCHAR(50) DEFAULT 'pending_approval',
  approvedat TIMESTAMP,
  approvedbyuserid VARCHAR(255),
  createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE password_resets (
  id VARCHAR(255) PRIMARY KEY,
  userid VARCHAR(255) NOT NULL REFERENCES users(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  expiresat TIMESTAMP NOT NULL,
  createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_password_resets_userid ON password_resets(userid);
`;

pool.query(sql)
  .then(() => {
    console.log('✅ Tablas de auth corregidas');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
