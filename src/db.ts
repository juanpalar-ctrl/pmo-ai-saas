import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../pmo.db');
const db = new sqlite3.Database(dbPath);

export { db };
