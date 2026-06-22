const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const res = await pool.query(
      'SELECT projectid, agenttype, output FROM ai_analyses ORDER BY generatedat DESC LIMIT 1'
    );
    console.log(JSON.stringify(res.rows[0], null, 2));
    pool.end();
  } catch (err) {
    console.error(err);
    pool.end();
  }
})();
