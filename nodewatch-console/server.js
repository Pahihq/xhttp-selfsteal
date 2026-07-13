const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const pkg = require(path.join(ROOT, 'package.json'));
const PORT = Number(process.env.PORT || pkg.appPort || 3000);
const DATA_DIR = path.join(ROOT, '.data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
`);

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => ({
  salt,
  hash: crypto.scryptSync(password, salt, 64).toString('hex')
});
const verifyPassword = (password, salt, expected) => {
  const actual = Buffer.from(hashPassword(password, salt).hash, 'hex');
  const target = Buffer.from(expected, 'hex');
  return actual.length === target.length && crypto.timingSafeEqual(actual, target);
};
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');
const parseCookies = header => Object.fromEntries((header || '').split(';').filter(Boolean).map(v => {
  const index = v.indexOf('=');
  return [v.slice(0, index).trim(), decodeURIComponent(v.slice(index + 1))];
}));
const publicUser = user => ({ id: user.id, name: user.name, email: user.email });

const demoEmail = pkg.demoEmail || 'demo@service.ru';
const demoPassword = pkg.demoPassword || 'demo123';
const demoName = pkg.demoName || 'Демо-пользователь';
if (!db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail)) {
  const { salt, hash } = hashPassword(demoPassword);
  db.prepare('INSERT INTO users (name, email, password_hash, password_salt) VALUES (?, ?, ?, ?)')
    .run(demoName, demoEmail, hash, salt);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

const attempts = new Map();
const rateLimit = (req, res, next) => {
  const key = req.ip;
  const now = Date.now();
  const entry = attempts.get(key) || { count: 0, reset: now + 60_000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 60_000; }
  entry.count += 1;
  attempts.set(key, entry);
  if (entry.count > 20) return res.status(429).json({ error: 'Слишком много попыток. Повторите через минуту.' });
  next();
};

const getSessionUser = req => {
  const token = parseCookies(req.headers.cookie).session;
  if (!token) return null;
  return db.prepare(`SELECT users.id, users.name, users.email
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?`)
    .get(tokenHash(token), Date.now()) || null;
};
const requireAuth = (req, res, next) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Требуется вход' });
  req.user = user;
  next();
};
const createSession = (userId, res) => {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash(token), userId, expiresAt);
  res.cookie('session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
};

app.get('/api/health', (_req, res) => res.json({ ok: true, database: 'sqlite' }));
app.get('/api/auth/session', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, user: publicUser(user) });
});
app.post('/api/auth/register', rateLimit, (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    return res.status(400).json({ error: 'Укажите имя, корректный email и пароль от 8 символов.' });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Этот email уже зарегистрирован.' });
  const { salt, hash } = hashPassword(password);
  const result = db.prepare('INSERT INTO users (name, email, password_hash, password_salt) VALUES (?, ?, ?, ?)')
    .run(name, email, hash, salt);
  createSession(result.lastInsertRowid, res);
  res.status(201).json({ user: { id: Number(result.lastInsertRowid), name, email } });
});
app.post('/api/auth/login', rateLimit, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) return res.status(401).json({ error: 'Неверный email или пароль.' });
  createSession(user.id, res);
  res.json({ user: publicUser(user) });
});
app.post('/api/auth/logout', (req, res) => {
  const token = parseCookies(req.headers.cookie).session;
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
  res.clearCookie('session', { path: '/' });
  res.status(204).end();
});
app.patch('/api/profile', requireAuth, (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Проверьте имя и email.' });
  const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id);
  if (taken) return res.status(409).json({ error: 'Этот email уже используется.' });
  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, req.user.id);
  res.json({ user: { id: req.user.id, name, email } });
});

app.get('/', (_req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.get('/styles.css', (_req, res) => res.sendFile(path.join(ROOT, 'styles.css')));
app.get('/app.js', (_req, res) => res.sendFile(path.join(ROOT, 'app.js')));
app.use((_req, res) => res.status(404).json({ error: 'Не найдено' }));

app.listen(PORT, () => console.log(`${pkg.name} running at http://localhost:${PORT}`));
