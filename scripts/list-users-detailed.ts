import dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

const { Pool } = require("pg");

async function listUsers() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    const result = await client.query("SELECT id, email, role, status FROM users ORDER BY id;");
    
    console.log("\n📋 USUARIOS EN LA BD:");
    console.log("=".repeat(80));
    result.rows.forEach((user: any) => {
      console.log(`ID: ${user.id} | Email: ${user.email} | Role: ${user.role} | Status: ${user.status}`);
    });
    console.log("=".repeat(80));
    
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

listUsers();
