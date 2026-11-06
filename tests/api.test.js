'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { openDb } = require('../db');
const { createApp } = require('../app');

let server;
let db;
let base;

const validStudent = {
  name: 'Test Student',
  email: 'test.student@example.com',
  phone: '+254 700 000 000',
  course: 'Software Engineering',
  year: 2,
};

async function request(method, path, body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(base + path, options);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  db = openDb(':memory:');
  server = createApp(db);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

test('health check responds ok', async () => {
  const res = await request('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('starts with an empty list', async () => {
  const res = await request('GET', '/api/students');
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 0);
  assert.deepEqual(res.body.students, []);
});

test('CREATE: adds a student and returns it with an id', async () => {
  const res = await request('POST', '/api/students', validStudent);
  assert.equal(res.status, 201);
  assert.equal(typeof res.body.id, 'number');
  assert.equal(res.body.name, 'Test Student');
  assert.equal(res.body.email, 'test.student@example.com');
  assert.equal(res.body.year, 2);
});

test('CREATE: trims input and lowercases the email', async () => {
  const res = await request('POST', '/api/students', {
    ...validStudent,
    name: '  Spaced Name  ',
    email: '  SPACED@Example.COM ',
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, 'Spaced Name');
  assert.equal(res.body.email, 'spaced@example.com');
});

test('CREATE: rejects invalid data with field errors', async () => {
  const res = await request('POST', '/api/students', {
    name: 'A',
    email: 'not-an-email',
    phone: 'abc',
    course: '',
    year: 9,
  });
  assert.equal(res.status, 400);
  assert.deepEqual(Object.keys(res.body.errors).sort(), ['course', 'email', 'name', 'phone', 'year']);
});

test('CREATE: rejects a duplicate email with 409', async () => {
  const res = await request('POST', '/api/students', validStudent);
  assert.equal(res.status, 409);
  assert.ok(res.body.errors.email);
});

test('CREATE: rejects malformed JSON with 400', async () => {
  const res = await request('POST', '/api/students', '{not json');
  assert.equal(res.status, 400);
});

test('CREATE: rejects an oversized body with 413', async () => {
  const res = await request('POST', '/api/students', { ...validStudent, name: 'x'.repeat(20000) });
  assert.equal(res.status, 413);
});

test('READ: lists students sorted by name', async () => {
  await request('POST', '/api/students', { ...validStudent, name: 'Alice First', email: 'alice@example.com' });
  const res = await request('GET', '/api/students');
  assert.equal(res.status, 200);
  const names = res.body.students.map((s) => s.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
  assert.equal(res.body.total, names.length);
});

test('READ: searches by name, email and course', async () => {
  const byName = await request('GET', '/api/students?q=alice');
  assert.equal(byName.body.total, 1);

  const byEmail = await request('GET', '/api/students?q=spaced%40example');
  assert.equal(byEmail.body.total, 1);

  const byCourse = await request('GET', '/api/students?q=software');
  assert.ok(byCourse.body.total >= 3);

  const none = await request('GET', '/api/students?q=zzzz-no-match');
  assert.equal(none.body.total, 0);
});

test('READ: search treats % and _ as plain characters', async () => {
  const res = await request('GET', '/api/students?q=%25');
  assert.equal(res.body.total, 0);
});

test('READ: gets one student by id and 404s for unknown ids', async () => {
  const created = await request('POST', '/api/students', { ...validStudent, email: 'one@example.com' });
  const found = await request('GET', `/api/students/${created.body.id}`);
  assert.equal(found.status, 200);
  assert.equal(found.body.email, 'one@example.com');

  const missing = await request('GET', '/api/students/999999');
  assert.equal(missing.status, 404);
});

test('UPDATE: changes a student and keeps the id', async () => {
  const created = await request('POST', '/api/students', { ...validStudent, email: 'update.me@example.com' });
  const res = await request('PUT', `/api/students/${created.body.id}`, {
    ...validStudent,
    email: 'update.me@example.com',
    name: 'Updated Name',
    year: 4,
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.id, created.body.id);
  assert.equal(res.body.name, 'Updated Name');
  assert.equal(res.body.year, 4);

  const again = await request('GET', `/api/students/${created.body.id}`);
  assert.equal(again.body.name, 'Updated Name');
});

test('UPDATE: validates data, blocks duplicate emails and 404s for unknown ids', async () => {
  const a = await request('POST', '/api/students', { ...validStudent, email: 'dup.a@example.com' });
  const b = await request('POST', '/api/students', { ...validStudent, email: 'dup.b@example.com' });

  const invalid = await request('PUT', `/api/students/${a.body.id}`, { ...validStudent, year: 0 });
  assert.equal(invalid.status, 400);

  const duplicate = await request('PUT', `/api/students/${b.body.id}`, { ...validStudent, email: 'dup.a@example.com' });
  assert.equal(duplicate.status, 409);

  const missing = await request('PUT', '/api/students/999999', validStudent);
  assert.equal(missing.status, 404);
});

test('DELETE: removes a student, then 404s', async () => {
  const created = await request('POST', '/api/students', { ...validStudent, email: 'delete.me@example.com' });
  const res = await request('DELETE', `/api/students/${created.body.id}`);
  assert.equal(res.status, 204);

  const after = await request('GET', `/api/students/${created.body.id}`);
  assert.equal(after.status, 404);

  const again = await request('DELETE', `/api/students/${created.body.id}`);
  assert.equal(again.status, 404);
});

test('rejects unsupported methods and unknown API routes', async () => {
  const method = await request('PATCH', '/api/students');
  assert.equal(method.status, 405);

  const unknown = await request('GET', '/api/nothing');
  assert.equal(unknown.status, 404);

  const badId = await request('GET', '/api/students/abc');
  assert.equal(badId.status, 404);
});

test('SQL injection attempts are treated as plain text', async () => {
  const res = await request('POST', '/api/students', {
    ...validStudent,
    email: 'inject@example.com',
    name: "Robert'); DROP TABLE students;--",
  });
  assert.equal(res.status, 201);
  const list = await request('GET', '/api/students');
  assert.ok(list.body.total > 0);
  assert.ok(list.body.students.some((s) => s.name.startsWith('Robert')));
});

test('static files: serves the page and blocks path traversal', async () => {
  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);

  const traversal = await fetch(base + '/..%2Fserver.js');
  assert.equal(traversal.status, 404);

  const missing = await fetch(base + '/nope.html');
  assert.equal(missing.status, 404);
});
