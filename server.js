'use strict';

let openDb;
try {
  ({ openDb } = require('./db'));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const db = openDb();
const server = createApp(db);

server.listen(PORT, HOST, () => {
  console.log(`Student Management System running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
