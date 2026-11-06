'use strict';

/**
 * Data access for the students table. Every query uses bound parameters,
 * so user input is never placed directly into SQL.
 */

function escapeLike(text) {
  return text.replace(/[\\%_]/g, '\\$&');
}

const plain = (row) => (row ? { ...row } : null);

function list(db, { q = '' } = {}) {
  const term = String(q).trim();
  if (!term) {
    return db.prepare('SELECT * FROM students ORDER BY name COLLATE NOCASE').all().map(plain);
  }
  const like = `%${escapeLike(term)}%`;
  return db
    .prepare(
      `SELECT * FROM students
       WHERE name   LIKE ? ESCAPE '\\'
          OR email  LIKE ? ESCAPE '\\'
          OR course LIKE ? ESCAPE '\\'
       ORDER BY name COLLATE NOCASE`
    )
    .all(like, like, like)
    .map(plain);
}

function get(db, id) {
  return plain(db.prepare('SELECT * FROM students WHERE id = ?').get(id));
}

function create(db, { name, email, phone, course, year }) {
  const result = db
    .prepare('INSERT INTO students (name, email, phone, course, year) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, phone, course, year);
  return get(db, Number(result.lastInsertRowid));
}

function update(db, id, { name, email, phone, course, year }) {
  const result = db
    .prepare(
      `UPDATE students
       SET name = ?, email = ?, phone = ?, course = ?, year = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(name, email, phone, course, year, id);
  return result.changes === 0 ? null : get(db, id);
}

function remove(db, id) {
  return db.prepare('DELETE FROM students WHERE id = ?').run(id).changes > 0;
}

function isDuplicateEmailError(err) {
  return /UNIQUE constraint failed: students\.email/.test(String(err && err.message));
}

module.exports = { list, get, create, update, remove, isDuplicateEmailError };
