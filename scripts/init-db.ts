/**
 * scripts/init-db.ts
 * Initialize database schema and admin user.
 * CRITICAL: Load dotenv BEFORE importing db module
 */

import dotenv from "dotenv";
import path from "path";

// Load .env FIRST before anything else
const envPath = path.resolve(__dirname, "../.env");
const envConfig = dotenv.config({ path: envPath });

if (envConfig.error) {
  console.error("❌ Error loading .env file:", envConfig.error);
  process.exit(1);
}

console.log("✅ .env loaded successfully");
console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 50) + "...");

// NOW import db after .env is loaded
const { Pool } = require("pg");

async function initializeDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log("🔄 Connecting to database...");
    const client = await pool.connect();
    console.log("✅ Connected to database!");

    console.log("🔄 Altering users table...");
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'user',
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending_approval';
    `);
    console.log("✅ Table altered successfully!");

    // Update your email to admin - REEMPLAZA CON TU EMAIL REAL
    const yourEmail = "juanpalar@gmail.com"; // ← CAMBIA ESTO A TU EMAIL
    console.log(`🔄 Setting admin for email: ${yourEmail}`);
    
    const result = await client.query(
      "UPDATE users SET role = 'admin', status = 'approved' WHERE email = $1 RETURNING email, role, status",
      [yourEmail]
    );

    if (result.rows.length > 0) {
      console.log("✅ Admin user updated:", result.rows[0]);
    } else {
      console.log(`⚠️  No user found with email: ${yourEmail}`);
      console.log("💡 Please register with this email first, or check that the email is spelled correctly.");
    }

    client.release();
    await pool.end();
    console.log("✅ Database initialization complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

initializeDatabase();
