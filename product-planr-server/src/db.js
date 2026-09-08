const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const databasePath =
  process.env.DATABASE_PATH ||
  path.join(process.cwd(), "data", "product-planr.db");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

const migrations = [
  {
    version: 1,
    sql: `
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
    CREATE TABLE graphs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, document_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX graphs_user_id_idx ON graphs(user_id);
  `,
  },
];

db.exec(
  "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
);
const applyMigrations = db.transaction(() => {
  for (const migration of migrations) {
    if (
      !db
        .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
        .get(migration.version)
    ) {
      db.exec(migration.sql);
      db.prepare(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
      ).run(migration.version, new Date().toISOString());
    }
  }
});
applyMigrations();

module.exports = { db, databasePath };
