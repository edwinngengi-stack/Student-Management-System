'use strict';

const fs = require('node:fs');
const path = require('node:path');

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch {
  throw new Error(
    `This project needs Node.js 22.13 or newer (it uses the built-in SQLite module). You are running ${process.version}.`
  );
}

const DEFAULT_DB_FILE = path.join(__dirname, 'data', 'students.db');

/**
 * Opens (and creates, if needed) the SQLite database and makes sure the
 * students table exists. Pass ':memory:' for a throwaway database (used by tests).
 */
function openDb(file = process.env.DB_FILE || DEFAULT_DB_FILE) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  const db = new DatabaseSync(file);

  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL UNIQUE,
      phone      TEXT    NOT NULL DEFAULT '',
      course     TEXT    NOT NULL,
      year       INTEGER NOT NULL CHECK (year BETWEEN 1 AND 6),
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return db;
}

module.exports = { openDb, DEFAULT_DB_FILE };
