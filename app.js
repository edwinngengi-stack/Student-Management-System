'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const students = require('./students');
const { validateStudent } = require('./validation');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 10 * 1024;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(payload);
}

function sendNoContent(res) {
  res.writeHead(204, { 'Cache-Control': 'no-store' });
  res.end();
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Reply first; the connection is closed after the reply (see the error handler below).
        chunks.length = 0;
        reject(new HttpError(413, 'Request body is too large.'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new HttpError(400, 'Request body must be valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function methodNotAllowed(res, allowed) {
  sendJson(res, 405, { error: 'Method not allowed.' }, { Allow: allowed.join(', ') });
}

async function handleApi(db, req, res, url) {
  const { pathname } = url;

  if (pathname === '/api/health') {
    return sendJson(res, 200, { status: 'ok' });
  }

  const match = pathname.match(/^\/api\/students(?:\/(\d+))?\/?$/);
  if (!match) {
    return sendJson(res, 404, { error: 'Not found.' });
  }

  // Collection: /api/students
  if (match[1] === undefined) {
    if (req.method === 'GET') {
      const rows = students.list(db, { q: url.searchParams.get('q') || '' });
      return sendJson(res, 200, { total: rows.length, students: rows });
    }

    if (req.method === 'POST') {
      const { errors, value } = validateStudent(await readJsonBody(req));
      if (Object.keys(errors).length) {
        return sendJson(res, 400, { error: 'Please correct the highlighted fields.', errors });
      }
      try {
        return sendJson(res, 201, students.create(db, value));
      } catch (err) {
        if (students.isDuplicateEmailError(err)) {
          return sendJson(res, 409, {
            error: 'A student with this email already exists.',
            errors: { email: 'This email is already registered.' },
          });
        }
        throw err;
      }
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  }

  // Single record: /api/students/:id
  const id = Number(match[1]);

  if (req.method === 'GET') {
    const student = students.get(db, id);
    return student ? sendJson(res, 200, student) : sendJson(res, 404, { error: 'Student not found.' });
  }

  if (req.method === 'PUT') {
    const { errors, value } = validateStudent(await readJsonBody(req));
    if (Object.keys(errors).length) {
      return sendJson(res, 400, { error: 'Please correct the highlighted fields.', errors });
    }
    try {
      const updated = students.update(db, id, value);
      return updated ? sendJson(res, 200, updated) : sendJson(res, 404, { error: 'Student not found.' });
    } catch (err) {
      if (students.isDuplicateEmailError(err)) {
        return sendJson(res, 409, {
          error: 'A student with this email already exists.',
          errors: { email: 'This email is already registered.' },
        });
      }
      throw err;
    }
  }

  if (req.method === 'DELETE') {
    return students.remove(db, id) ? sendNoContent(res) : sendJson(res, 404, { error: 'Student not found.' });
  }

  return methodNotAllowed(res, ['GET', 'PUT', 'DELETE']);
}

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return methodNotAllowed(res, ['GET', 'HEAD']);
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return sendJson(res, 400, { error: 'Bad request.' });
  }
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.join(PUBLIC_DIR, pathname);
  // Block attempts like /../../server.js from leaving the public folder.
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return sendJson(res, 404, { error: 'Not found.' });
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      return sendJson(res, 404, { error: 'Not found.' });
    }
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}

/** Builds the HTTP server for a given database (kept separate so tests can use an in-memory one). */
function createApp(db) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        await handleApi(db, req, res, url);
      } else {
        serveStatic(req, res, url);
      }
    } catch (err) {
      if (err instanceof HttpError) {
        // For an oversized upload, close the connection once the reply is sent.
        const headers = err.status === 413 ? { Connection: 'close' } : {};
        return sendJson(res, err.status, { error: err.message }, headers);
      }
      console.error(err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Something went wrong on the server.' });
      }
    }
  });
}

module.exports = { createApp };
