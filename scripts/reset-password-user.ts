import dotenv from "dotenv";
import path from "path";
import bcrypt from "bcryptjs";

const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

const { Pool } = require("pg");

async function resetPassword() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    const newPassword = "Test123456";
    const hash = await bcrypt.hash(newPassword, 10);

    const result = await client.query(
      "UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING email",
      [hash, "testlara@example.com"]
    );

    if (result.rows.length > 0) {
      console.log(`✅ Contraseña reseteada para: ${result.rows[0].email}`);
      console.log(`🔑 Nueva contraseña: ${newPassword}`);
    } else {
      console.log("❌ Usuario no encontrado");
    }

    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

resetPassword();
