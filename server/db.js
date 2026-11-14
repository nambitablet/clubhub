import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// On Vercel the deployment filesystem is read-only, so the prototype database lives in /tmp
// (re-seeded whenever a new serverless instance starts).
export const ON_VERCEL = !!process.env.VERCEL;
const DATA_DIR = ON_VERCEL ? '/tmp/clubhub' : path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
export const DB_PATH = path.join(DATA_DIR, 'clubhub.db');

// ---- stateless signed login tokens (work across serverless instances) ----
function loadSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (ON_VERCEL) return crypto.createHash('sha256').update(`clubhub:${process.env.VERCEL_PROJECT_ID || 'vercel'}`).digest('hex');
  const f = path.join(DATA_DIR, '.session-secret');
  try { return fs.readFileSync(f, 'utf8'); } catch {
    const s = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(f, s); return s;
  }
}
const SECRET = loadSecret();
const b64 = (s) => Buffer.from(s).toString('base64url');
const mac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
const emailTag = (email) => crypto.createHash('sha256').update(String(email).toLowerCase()).digest('base64url').slice(0, 12);
export function signToken(user) {
  const body = b64(JSON.stringify({ u: user.id, e: emailTag(user.email), t: Date.now() }));
  return `${body}.${mac(body)}`;
}
// Returns the user id if the token is genuine and still matches that user's email.
export function verifyToken(token, getUser) {
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const want = Buffer.from(mac(body)); const got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (Date.now() - p.t > 30 * 864e5) return null; // 30-day expiry
    const u = getUser(p.u);
    return u && emailTag(u.email) === p.e ? u : null;
  } catch { return null; }
}

export function openDb() {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  usn TEXT, branch TEXT, year INTEGER, phone TEXT, bio TEXT,
  platform_role TEXT NOT NULL DEFAULT 'student',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS clubs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT,
  tagline TEXT,
  description TEXT,
  category TEXT,
  icon TEXT DEFAULT 'sparkles',
  color TEXT DEFAULT '#4f46e5',
  color2 TEXT DEFAULT '#7c3aed',
  founded INTEGER,
  email TEXT, phone TEXT, website TEXT, instagram TEXT, linkedin TEXT,
  milestones TEXT DEFAULT '[]',
  recruitment_open INTEGER DEFAULT 1,
  recruitment_note TEXT,
  stages TEXT DEFAULT '["Application","Interview"]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS divisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS club_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rank INTEGER NOT NULL DEFAULT 10,
  perms TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES club_roles(id) ON DELETE SET NULL,
  division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  stage INTEGER NOT NULL DEFAULT 0,
  score TEXT, note TEXT, statement TEXT,
  stage_date TEXT,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  joined_at TEXT,
  UNIQUE(club_id, user_id)
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  venue TEXT,
  reg_deadline TEXT,
  capacity INTEGER DEFAULT 100,
  waitlist INTEGER DEFAULT 1,
  members_only INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  approval TEXT NOT NULL DEFAULT 'pending',
  checkin_open INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT, usn TEXT, branch TEXT, year INTEGER,
  status TEXT NOT NULL DEFAULT 'registered',
  attendance TEXT,
  ticket TEXT NOT NULL UNIQUE,
  checked_in_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(event_id, user_id)
);
CREATE TABLE IF NOT EXISTS volunteer_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  description TEXT,
  slot_start TEXT, slot_end TEXT,
  needed INTEGER DEFAULT 2,
  hours REAL DEFAULT 2
);
CREATE TABLE IF NOT EXISTS volunteer_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES volunteer_tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'signed_up',
  hours REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(task_id, user_id)
);
CREATE TABLE IF NOT EXISTS certificates (
  code TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  detail TEXT,
  hours REAL,
  revoked INTEGER DEFAULT 0,
  issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, event_id, type)
);
CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meeting_attendance (
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  PRIMARY KEY (meeting_id, user_id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}
export function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const h = crypto.scryptSync(pw, salt, 32);
  return crypto.timingSafeEqual(h, Buffer.from(hash, 'hex'));
}
export function newCode(prefix, len = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[bytes[i] % alphabet.length];
  return prefix ? `${prefix}-${s.slice(0, 4)}-${s.slice(4)}` : s;
}
export const ALL_PERMS = ['club', 'members', 'events', 'attendance', 'volunteers', 'certificates'];
