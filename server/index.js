import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { hashPassword, verifyPassword, newCode, ALL_PERMS, signToken, verifyToken, ON_VERCEL } from './db.js';
import { seed } from './seed.js';
import { certificatePdf } from './pdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = seed();
const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------- helpers
const one = (sql, ...p) => db.prepare(sql).get(...p);
const all = (sql, ...p) => db.prepare(sql).all(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);
const nowIso = () => new Date().toISOString();
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const h = (fn) => (req, res, next) => { try { const r = fn(req, res, next); if (r && r.then) r.catch(next); } catch (e) { next(e); } };
const tx = (fn) => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
const notify = (userId, title, body, link) => run('INSERT INTO notifications (user_id,title,body,link) VALUES (?,?,?,?)', userId, title, body || null, link || null);
const publicUser = (u) => u && ({ id: u.id, name: u.name, email: u.email, usn: u.usn, branch: u.branch, year: u.year, phone: u.phone, bio: u.bio, platform_role: u.platform_role });
const parseClub = (c) => c && ({ ...c, milestones: JSON.parse(c.milestones || '[]'), stages: JSON.parse(c.stages || '[]') });

function auth(req, _res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : req.query.token;
  if (token) {
    const u = verifyToken(token, (id) => one('SELECT * FROM users WHERE id=?', id));
    if (u) req.user = u;
  }
  next();
}
app.use(auth);
const needUser = (req) => { if (!req.user) fail(401, 'Please sign in to continue.'); return req.user; };

function permsFor(user, clubId) {
  if (!user) return new Set();
  if (user.platform_role === 'college_admin') return new Set(ALL_PERMS);
  const m = one(`SELECT r.perms FROM memberships m JOIN club_roles r ON r.id=m.role_id WHERE m.club_id=? AND m.user_id=? AND m.status='approved'`, clubId, user.id);
  return new Set((m?.perms || '').split(',').filter(Boolean));
}
function requirePerm(req, clubId, perm) {
  const u = needUser(req);
  const p = permsFor(u, clubId);
  if (!p.size || (perm && !p.has(perm))) fail(403, `You need the "${perm || 'admin'}" permission in this club.`);
  return p;
}
function eventOr404(id) { const e = one('SELECT * FROM events WHERE id=?', id); if (!e) fail(404, 'Event not found'); return e; }

function enrichEvent(e, user) {
  const c = one(`SELECT
    SUM(status='registered') reg, SUM(status='waitlisted') wl, SUM(attendance='present') present, SUM(attendance='absent') absent
    FROM registrations WHERE event_id=?`, e.id);
  const registered = c.reg || 0; const waitlisted = c.wl || 0;
  const now = Date.now();
  let reg_state = 'open';
  if (e.status === 'cancelled') reg_state = 'cancelled';
  else if (e.status === 'draft') reg_state = 'draft';
  else if (new Date(e.end_at).getTime() < now) reg_state = 'ended';
  else if (e.reg_deadline && new Date(e.reg_deadline).getTime() < now) reg_state = 'closed';
  else if (registered >= e.capacity) reg_state = e.waitlist ? 'waitlist' : 'full';
  const club = one('SELECT id,slug,name,short_name,icon,color,color2,category FROM clubs WHERE id=?', e.club_id);
  const out = { ...e, club, registered, waitlisted, present: c.present || 0, absent: c.absent || 0, seats_left: Math.max(0, e.capacity - registered), reg_state };
  if (user) {
    out.my_registration = one('SELECT * FROM registrations WHERE event_id=? AND user_id=? AND status!=\'cancelled\'', e.id, user.id) || null;
    if (out.my_registration?.status === 'waitlisted') {
      out.my_registration.position = one(`SELECT COUNT(*) n FROM registrations WHERE event_id=? AND status='waitlisted' AND id<=?`, e.id, out.my_registration.id).n;
    }
  }
  return out;
}

function promoteWaitlist(eventId) {
  const e = one('SELECT * FROM events WHERE id=?', eventId);
  let regs = one(`SELECT COUNT(*) n FROM registrations WHERE event_id=? AND status='registered'`, eventId).n;
  while (regs < e.capacity) {
    const w = one(`SELECT * FROM registrations WHERE event_id=? AND status='waitlisted' ORDER BY id LIMIT 1`, eventId);
    if (!w) break;
    run(`UPDATE registrations SET status='registered' WHERE id=?`, w.id);
    notify(w.user_id, 'A seat opened up — you\'re in!', `You have been moved from the waitlist to confirmed for "${e.title}".`, `/events/${eventId}`);
    regs++;
  }
}

// ---------------------------------------------------------------- auth
app.post('/api/auth/signup', h((req, res) => {
  const { name, email, password, usn, branch, year, phone } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) fail(400, 'Name, email and password are required.');
  if (String(password).length < 6) fail(400, 'Password must be at least 6 characters.');
  if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, 'Please enter a valid email.');
  if (one('SELECT id FROM users WHERE lower(email)=lower(?)', email)) fail(409, 'An account with this email already exists.');
  const id = Number(run('INSERT INTO users (name,email,password_hash,usn,branch,year,phone) VALUES (?,?,?,?,?,?,?)',
    name.trim(), email.trim().toLowerCase(), hashPassword(password), usn?.toUpperCase() || null, branch || null, year ? Number(year) : null, phone || null).lastInsertRowid);
  const token = signToken(one('SELECT * FROM users WHERE id=?', id));
  notify(id, 'Welcome to ClubHub! 🎉', 'Explore clubs, register for events and start collecting certificates.', '/clubs');
  res.json({ token, user: publicUser(one('SELECT * FROM users WHERE id=?', id)) });
}));
app.post('/api/auth/login', h((req, res) => {
  const { email, password } = req.body || {};
  const u = one('SELECT * FROM users WHERE lower(email)=lower(?)', String(email || ''));
  if (!u || !verifyPassword(String(password || ''), u.password_hash)) fail(401, 'Incorrect email or password.');
  const token = signToken(u);
  res.json({ token, user: publicUser(u) });
}));
app.post('/api/auth/logout', h((req, res) => {
  res.json({ ok: true });
}));
app.get('/api/me', h((req, res) => {
  if (!req.user) return res.json({ user: null });
  const managed = req.user.platform_role === 'college_admin'
    ? all('SELECT id,slug,name,short_name,icon,color,color2 FROM clubs ORDER BY name')
    : all(`SELECT c.id,c.slug,c.name,c.short_name,c.icon,c.color,c.color2,r.name role_name,r.perms FROM memberships m JOIN club_roles r ON r.id=m.role_id JOIN clubs c ON c.id=m.club_id
           WHERE m.user_id=? AND m.status='approved' AND r.perms!='' ORDER BY r.rank`, req.user.id);
  const unread = one('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0', req.user.id).n;
  res.json({ user: publicUser(req.user), managed, unread });
}));
app.put('/api/me', h((req, res) => {
  const u = needUser(req);
  const { name, usn, branch, year, phone, bio, password } = req.body || {};
  if (!name?.trim()) fail(400, 'Name is required.');
  run('UPDATE users SET name=?,usn=?,branch=?,year=?,phone=?,bio=? WHERE id=?', name.trim(), usn?.toUpperCase() || null, branch || null, year ? Number(year) : null, phone || null, bio || null, u.id);
  if (password) { if (password.length < 6) fail(400, 'Password must be at least 6 characters.'); run('UPDATE users SET password_hash=? WHERE id=?', hashPassword(password), u.id); }
  res.json({ user: publicUser(one('SELECT * FROM users WHERE id=?', u.id)) });
}));

// ---------------------------------------------------------------- public
app.get('/api/stats', h((_req, res) => {
  res.json({
    clubs: one('SELECT COUNT(*) n FROM clubs').n,
    members: one(`SELECT COUNT(DISTINCT user_id) n FROM memberships WHERE status='approved'`).n,
    upcoming: one(`SELECT COUNT(*) n FROM events WHERE status='published' AND end_at>?`, nowIso()).n,
    certificates: one('SELECT COUNT(*) n FROM certificates WHERE revoked=0').n,
    volunteer_hours: Math.round(one(`SELECT COALESCE(SUM(hours),0) n FROM volunteer_signups WHERE status='completed'`).n),
  });
}));
app.get('/api/categories', h((_req, res) => {
  res.json({
    clubs: all('SELECT category, COUNT(*) n FROM clubs GROUP BY category ORDER BY n DESC'),
    events: all(`SELECT category, COUNT(*) n FROM events WHERE status!='draft' GROUP BY category ORDER BY n DESC`),
  });
}));
app.get('/api/clubs', h((req, res) => {
  const { q, category } = req.query;
  let sql = `SELECT c.*, (SELECT COUNT(*) FROM memberships m WHERE m.club_id=c.id AND m.status='approved') members,
    (SELECT COUNT(*) FROM events e WHERE e.club_id=c.id AND e.status='published' AND e.end_at>?) upcoming FROM clubs c WHERE 1=1`;
  const p = [nowIso()];
  if (q) { sql += ' AND (c.name LIKE ? OR c.tagline LIKE ? OR c.description LIKE ? OR c.category LIKE ?)'; p.push(...Array(4).fill(`%${q}%`)); }
  if (category) { sql += ' AND c.category=?'; p.push(category); }
  sql += ' ORDER BY c.name';
  const clubs = all(sql, ...p).map(parseClub);
  if (req.user) {
    const mine = Object.fromEntries(all('SELECT club_id,status FROM memberships WHERE user_id=?', req.user.id).map((m) => [m.club_id, m.status]));
    clubs.forEach((c) => { c.my_status = mine[c.id] || null; });
  }
  res.json(clubs);
}));
app.get('/api/clubs/:slug', h((req, res) => {
  const c = parseClub(one('SELECT * FROM clubs WHERE slug=? OR id=?', req.params.slug, req.params.slug));
  if (!c) fail(404, 'Club not found');
  c.divisions = all(`SELECT d.*, (SELECT COUNT(*) FROM memberships m WHERE m.division_id=d.id AND m.status='approved') members FROM divisions d WHERE club_id=? ORDER BY sort,id`, c.id);
  c.roles = all('SELECT id,name,rank FROM club_roles WHERE club_id=? ORDER BY rank,id', c.id);
  c.members_count = one(`SELECT COUNT(*) n FROM memberships WHERE club_id=? AND status='approved'`, c.id).n;
  c.team = all(`SELECT u.id,u.name,u.branch,u.year,r.name role,r.rank,d.name division FROM memberships m JOIN users u ON u.id=m.user_id
    JOIN club_roles r ON r.id=m.role_id LEFT JOIN divisions d ON d.id=m.division_id WHERE m.club_id=? AND m.status='approved' AND r.rank<=4 ORDER BY r.rank,u.name`, c.id);
  c.events = all(`SELECT * FROM events WHERE club_id=? AND status IN ('published','cancelled') ORDER BY start_at DESC`, c.id).map((e) => enrichEvent(e, req.user));
  c.stats = {
    events: one(`SELECT COUNT(*) n FROM events WHERE club_id=? AND status='published'`, c.id).n,
    participants: one(`SELECT COUNT(*) n FROM registrations r JOIN events e ON e.id=r.event_id WHERE e.club_id=? AND r.attendance='present'`, c.id).n,
  };
  if (req.user) {
    c.my_membership = one(`SELECT m.*, r.name role_name, d.name division_name FROM memberships m LEFT JOIN club_roles r ON r.id=m.role_id LEFT JOIN divisions d ON d.id=m.division_id WHERE m.club_id=? AND m.user_id=?`, c.id, req.user.id) || null;
    c.can_manage = permsFor(req.user, c.id).size > 0;
  }
  res.json(c);
}));
app.get('/api/events', h((req, res) => {
  const { q, club, category, when = 'upcoming', from, to } = req.query;
  let sql = `SELECT e.* FROM events e JOIN clubs c ON c.id=e.club_id WHERE e.status IN ('published','cancelled')`;
  const p = [];
  if (when === 'upcoming') { sql += ' AND e.end_at>=?'; p.push(nowIso()); }
  if (when === 'past') { sql += ' AND e.end_at<?'; p.push(nowIso()); }
  if (q) { sql += ' AND (e.title LIKE ? OR e.description LIKE ? OR c.name LIKE ? OR e.venue LIKE ?)'; p.push(...Array(4).fill(`%${q}%`)); }
  if (club) { sql += ' AND (c.slug=? OR c.id=?)'; p.push(club, club); }
  if (category) { sql += ' AND e.category=?'; p.push(category); }
  if (from) { sql += ' AND e.start_at>=?'; p.push(new Date(from).toISOString()); }
  if (to) { const t = new Date(to); t.setHours(23, 59, 59); sql += ' AND e.start_at<=?'; p.push(t.toISOString()); }
  sql += when === 'past' ? ' ORDER BY e.start_at DESC' : ' ORDER BY e.start_at ASC';
  res.json(all(sql, ...p).map((e) => enrichEvent(e, req.user)));
}));
app.get('/api/events/:id', h((req, res) => {
  const e = eventOr404(req.params.id);
  const perms = permsFor(req.user, e.club_id);
  if (e.status === 'draft' && !perms.size) fail(404, 'Event not found');
  const out = enrichEvent(e, req.user);
  out.club = parseClub(one('SELECT * FROM clubs WHERE id=?', e.club_id));
  out.tasks = all(`SELECT t.*, (SELECT COUNT(*) FROM volunteer_signups s WHERE s.task_id=t.id AND s.status!='cancelled') filled FROM volunteer_tasks t WHERE event_id=? ORDER BY slot_start,id`, e.id);
  if (req.user) {
    const mine = Object.fromEntries(all(`SELECT s.task_id, s.status FROM volunteer_signups s JOIN volunteer_tasks t ON t.id=s.task_id WHERE t.event_id=? AND s.user_id=?`, e.id, req.user.id).map((s) => [s.task_id, s.status]));
    out.tasks.forEach((t) => { t.my_status = mine[t.id] || null; });
    out.is_member = !!one(`SELECT 1 FROM memberships WHERE club_id=? AND user_id=? AND status='approved'`, e.club_id, req.user.id);
  }
  out.can_manage = perms.size > 0;
  res.json(out);
}));
app.get('/api/events/:id/ics', h((req, res) => {
  const e = eventOr404(req.params.id);
  const club = one('SELECT name FROM clubs WHERE id=?', e.club_id);
  const f = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s) => String(s || '').replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ClubHub RVCE//EN', 'BEGIN:VEVENT', `UID:clubhub-event-${e.id}@rvce`, `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(e.start_at)}`, `DTEND:${f(e.end_at)}`, `SUMMARY:${esc(e.title)} (${esc(club.name)})`, `LOCATION:${esc(e.venue)}, RV College of Engineering`,
    `DESCRIPTION:${esc(e.description)}`, 'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)} starts in 2 hours`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${e.title.replace(/[^\w]+/g, '-')}.ics"`);
  res.send(ics);
}));

// ---------------------------------------------------------------- certificates (public verify)
function certDetail(code) {
  return one(`SELECT c.*, u.name student_name, u.usn, u.branch, e.title event_title, e.start_at, e.end_at, e.venue, cl.name club_name, cl.slug club_slug, cl.color, cl.color2, cl.icon
    FROM certificates c JOIN users u ON u.id=c.user_id JOIN events e ON e.id=c.event_id JOIN clubs cl ON cl.id=e.club_id WHERE c.code=?`, String(code).toUpperCase().trim());
}
app.get('/api/verify/:code', h((req, res) => {
  const c = certDetail(req.params.code);
  if (!c) return res.json({ valid: false });
  res.json({ valid: !c.revoked, revoked: !!c.revoked, certificate: { ...c, usn: c.usn ? c.usn.slice(0, 5) + '•••' + c.usn.slice(-2) : null } });
}));
app.get('/api/certificates/:code/pdf', h(async (req, res) => {
  const c = certDetail(req.params.code);
  if (!c || c.revoked) fail(404, 'Certificate not found');
  const u = req.user;
  const perms = u ? permsFor(u, one('SELECT club_id FROM events WHERE id=?', c.event_id).club_id) : new Set();
  if (!u || (u.id !== c.user_id && !perms.size)) fail(403, 'Only the certificate holder can download this PDF.');
  const origin = `${req.protocol}://${req.get('host')}`;
  const buf = await certificatePdf(c, `${origin}/verify/${c.code}`);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.inline ? 'inline' : 'attachment'}; filename="ClubHub-${c.code}.pdf"`);
  res.send(buf);
}));
app.get('/api/qr', h(async (req, res) => {
  const svg = await QRCode.toString(String(req.query.data || '').slice(0, 300), { type: 'svg', margin: 1, color: { dark: '#0f172a', light: '#ffffff' } });
  res.setHeader('Content-Type', 'image/svg+xml'); res.setHeader('Cache-Control', 'public, max-age=86400'); res.send(svg);
}));

// ---------------------------------------------------------------- student actions
app.post('/api/clubs/:id/apply', h((req, res) => {
  const u = needUser(req);
  const c = parseClub(one('SELECT * FROM clubs WHERE id=?', req.params.id));
  if (!c) fail(404, 'Club not found');
  if (!c.recruitment_open) fail(400, 'Recruitment for this club is currently closed.');
  const ex = one('SELECT * FROM memberships WHERE club_id=? AND user_id=?', c.id, u.id);
  if (ex && ['pending', 'approved'].includes(ex.status)) fail(409, ex.status === 'approved' ? 'You are already a member.' : 'You already have an application in progress.');
  const { division_id, statement } = req.body || {};
  if (ex) run(`UPDATE memberships SET status='pending', stage=0, division_id=?, statement=?, score=NULL, note=NULL, stage_date=NULL, applied_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`, division_id || null, statement || null, ex.id);
  else run('INSERT INTO memberships (club_id,user_id,division_id,statement,status,stage) VALUES (?,?,?,?,\'pending\',0)', c.id, u.id, division_id || null, statement || null);
  all(`SELECT m.user_id FROM memberships m JOIN club_roles r ON r.id=m.role_id WHERE m.club_id=? AND m.status='approved' AND instr(r.perms,'members')>0`, c.id)
    .forEach((a) => notify(a.user_id, `New application — ${c.name}`, `${u.name} applied to join ${c.name}.`, `/manage/${c.id}/members`));
  res.json({ ok: true });
}));
app.delete('/api/clubs/:id/apply', h((req, res) => {
  const u = needUser(req);
  run(`UPDATE memberships SET status='withdrawn' WHERE club_id=? AND user_id=? AND status='pending'`, req.params.id, u.id);
  res.json({ ok: true });
}));
app.post('/api/events/:id/register', h((req, res) => {
  const u = needUser(req);
  const e = enrichEvent(eventOr404(req.params.id), u);
  if (['cancelled', 'draft', 'ended', 'closed', 'full'].includes(e.reg_state)) fail(400, { cancelled: 'This event was cancelled.', ended: 'This event has ended.', closed: 'Registration deadline has passed.', full: 'This event is full.', draft: 'Registration is not open yet.' }[e.reg_state]);
  if (e.members_only && !one(`SELECT 1 FROM memberships WHERE club_id=? AND user_id=? AND status='approved'`, e.club_id, u.id)) fail(403, 'This event is open to club members only.');
  if (e.my_registration) fail(409, 'You are already registered.');
  const { name, usn, branch, year } = req.body || {};
  if (!name || !usn || !branch || !year) fail(400, 'Please fill in your name, USN, branch and year.');
  const status = e.reg_state === 'waitlist' ? 'waitlisted' : 'registered';
  const ex = one('SELECT id FROM registrations WHERE event_id=? AND user_id=?', e.id, u.id);
  if (ex) run(`UPDATE registrations SET name=?,usn=?,branch=?,year=?,status=?,attendance=NULL,checked_in_at=NULL,created_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),id=id WHERE id=?`, name, usn.toUpperCase(), branch, Number(year), status, ex.id);
  else run('INSERT INTO registrations (event_id,user_id,name,usn,branch,year,status,ticket) VALUES (?,?,?,?,?,?,?,?)', e.id, u.id, name, usn.toUpperCase(), branch, Number(year), status, newCode('', 10));
  if (!u.usn) run('UPDATE users SET usn=?, branch=COALESCE(branch,?), year=COALESCE(year,?) WHERE id=?', usn.toUpperCase(), branch, Number(year), u.id);
  notify(u.id, status === 'registered' ? `Registered: ${e.title}` : `Waitlisted: ${e.title}`, status === 'registered' ? 'Your ticket QR is in My Space → Events. Show it at the check-in desk.' : 'The event is full — you are on the waitlist and will be notified if a seat opens.', `/events/${e.id}`);
  res.json(enrichEvent(eventOr404(e.id), u));
}));
app.post('/api/events/:id/cancel-registration', h((req, res) => {
  const u = needUser(req);
  const e = eventOr404(req.params.id);
  if (new Date(e.start_at) < new Date()) fail(400, 'You cannot cancel after the event has started.');
  run(`UPDATE registrations SET status='cancelled' WHERE event_id=? AND user_id=?`, e.id, u.id);
  promoteWaitlist(e.id);
  res.json(enrichEvent(e, u));
}));
app.post('/api/tasks/:id/signup', h((req, res) => {
  const u = needUser(req);
  const t = one('SELECT t.*, e.title, e.end_at, e.status ev_status FROM volunteer_tasks t JOIN events e ON e.id=t.event_id WHERE t.id=?', req.params.id);
  if (!t) fail(404, 'Task not found');
  if (t.ev_status !== 'published' || new Date(t.end_at) < new Date()) fail(400, 'Volunteer sign-ups are closed for this event.');
  const filled = one(`SELECT COUNT(*) n FROM volunteer_signups WHERE task_id=? AND status!='cancelled'`, t.id).n;
  const ex = one('SELECT * FROM volunteer_signups WHERE task_id=? AND user_id=?', t.id, u.id);
  if (ex && ex.status !== 'cancelled') fail(409, 'You have already signed up for this task.');
  if (filled >= t.needed) fail(400, 'All volunteer slots for this task are filled.');
  if (ex) run(`UPDATE volunteer_signups SET status='signed_up', hours=NULL WHERE id=?`, ex.id);
  else run('INSERT INTO volunteer_signups (task_id,user_id) VALUES (?,?)', t.id, u.id);
  res.json({ ok: true });
}));
app.delete('/api/tasks/:id/signup', h((req, res) => {
  const u = needUser(req);
  run(`UPDATE volunteer_signups SET status='cancelled' WHERE task_id=? AND user_id=? AND status IN ('signed_up','assigned')`, req.params.id, u.id);
  res.json({ ok: true });
}));

app.get('/api/me/dashboard', h((req, res) => {
  const u = needUser(req);
  const regs = all(`SELECT r.*, e.id event_id FROM registrations r JOIN events e ON e.id=r.event_id WHERE r.user_id=? AND r.status!='cancelled' ORDER BY e.start_at`, u.id)
    .map((r) => ({ ...r, event: enrichEvent(one('SELECT * FROM events WHERE id=?', r.event_id), u) }));
  const memberships = all(`SELECT m.*, c.name club_name, c.slug, c.icon, c.color, c.color2, c.stages, r.name role_name, d.name division_name
    FROM memberships m JOIN clubs c ON c.id=m.club_id LEFT JOIN club_roles r ON r.id=m.role_id LEFT JOIN divisions d ON d.id=m.division_id
    WHERE m.user_id=? AND m.status!='withdrawn' ORDER BY m.status='approved' DESC, m.applied_at DESC`, u.id).map((m) => {
    const att = one(`SELECT COUNT(*) total, SUM(a.status='present') present FROM meetings mt LEFT JOIN meeting_attendance a ON a.meeting_id=mt.id AND a.user_id=? WHERE mt.club_id=? AND mt.date>=? AND a.status IS NOT NULL`, u.id, m.club_id, m.joined_at || m.applied_at);
    const meetings = all(`SELECT mt.title, mt.date, a.status FROM meetings mt JOIN meeting_attendance a ON a.meeting_id=mt.id AND a.user_id=? WHERE mt.club_id=? ORDER BY mt.date DESC LIMIT 8`, u.id, m.club_id);
    return { ...m, stages: JSON.parse(m.stages), attendance: { total: att.total || 0, present: att.present || 0, meetings } };
  });
  const volunteering = all(`SELECT s.*, t.role, t.description, t.slot_start, t.slot_end, t.hours task_hours, e.id event_id, e.title event_title, e.start_at, c.name club_name, c.color, c.color2, c.icon
    FROM volunteer_signups s JOIN volunteer_tasks t ON t.id=s.task_id JOIN events e ON e.id=t.event_id JOIN clubs c ON c.id=e.club_id
    WHERE s.user_id=? AND s.status!='cancelled' ORDER BY t.slot_start DESC`, u.id);
  const certificates = all(`SELECT c.*, e.title event_title, e.start_at, cl.name club_name, cl.color, cl.color2, cl.icon FROM certificates c JOIN events e ON e.id=c.event_id JOIN clubs cl ON cl.id=e.club_id
    WHERE c.user_id=? AND c.revoked=0 ORDER BY c.issued_at DESC`, u.id);
  res.json({
    registrations: regs, memberships, volunteering, certificates,
    stats: {
      upcoming: regs.filter((r) => new Date(r.event.end_at) > new Date()).length,
      attended: regs.filter((r) => r.attendance === 'present').length,
      clubs: memberships.filter((m) => m.status === 'approved').length,
      hours: volunteering.filter((v) => v.status === 'completed').reduce((a, v) => a + (v.hours || 0), 0),
      certificates: certificates.length,
    },
  });
}));
app.get('/api/notifications', h((req, res) => {
  const u = needUser(req);
  res.json(all('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 40', u.id));
}));
app.post('/api/notifications/read', h((req, res) => {
  const u = needUser(req);
  run('UPDATE notifications SET read=1 WHERE user_id=?', u.id);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- club admin
app.get('/api/manage/:clubId/overview', h((req, res) => {
  const perms = requirePerm(req, req.params.clubId);
  const c = parseClub(one('SELECT * FROM clubs WHERE id=?', req.params.clubId));
  if (!c) fail(404, 'Club not found');
  const id = c.id; const now = nowIso();
  const events = all('SELECT * FROM events WHERE club_id=? ORDER BY start_at DESC', id).map((e) => enrichEvent(e));
  const totals = {
    members: one(`SELECT COUNT(*) n FROM memberships WHERE club_id=? AND status='approved'`, id).n,
    applications: one(`SELECT COUNT(*) n FROM memberships WHERE club_id=? AND status='pending'`, id).n,
    upcoming: events.filter((e) => e.end_at > now && e.status === 'published').length,
    drafts: events.filter((e) => e.status === 'draft').length,
    registrations: events.reduce((a, e) => a + e.registered, 0),
    attended: events.reduce((a, e) => a + e.present, 0),
    marked: events.reduce((a, e) => a + e.present + e.absent, 0),
    volunteer_hours: one(`SELECT COALESCE(SUM(s.hours),0) n FROM volunteer_signups s JOIN volunteer_tasks t ON t.id=s.task_id JOIN events e ON e.id=t.event_id WHERE e.club_id=? AND s.status='completed'`, id).n,
    volunteers: one(`SELECT COUNT(DISTINCT s.user_id) n FROM volunteer_signups s JOIN volunteer_tasks t ON t.id=s.task_id JOIN events e ON e.id=t.event_id WHERE e.club_id=? AND s.status!='cancelled'`, id).n,
    certificates: one('SELECT COUNT(*) n FROM certificates c JOIN events e ON e.id=c.event_id WHERE e.club_id=? AND c.revoked=0', id).n,
  };
  const byDivision = all(`SELECT d.name, COUNT(m.id) n FROM divisions d LEFT JOIN memberships m ON m.division_id=d.id AND m.status='approved' WHERE d.club_id=? GROUP BY d.id ORDER BY d.sort`, id);
  const byYear = all(`SELECT u.year, COUNT(*) n FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.club_id=? AND m.status='approved' GROUP BY u.year ORDER BY u.year`, id);
  const pipeline = c.stages.map((s, i) => ({ stage: s, n: one(`SELECT COUNT(*) n FROM memberships WHERE club_id=? AND status='pending' AND stage=?`, id, i).n }));
  const topVolunteers = all(`SELECT u.name, SUM(s.hours) hours, COUNT(*) tasks FROM volunteer_signups s JOIN users u ON u.id=s.user_id JOIN volunteer_tasks t ON t.id=s.task_id JOIN events e ON e.id=t.event_id
    WHERE e.club_id=? AND s.status='completed' GROUP BY u.id ORDER BY hours DESC LIMIT 5`, id);
  res.json({ club: c, perms: [...perms], totals, events, byDivision, byYear, pipeline, topVolunteers });
}));
app.put('/api/manage/:clubId/profile', h((req, res) => {
  requirePerm(req, req.params.clubId, 'club');
  const b = req.body || {};
  if (!b.name?.trim()) fail(400, 'Club name is required.');
  run(`UPDATE clubs SET name=?,short_name=?,tagline=?,description=?,category=?,icon=?,color=?,color2=?,founded=?,email=?,phone=?,website=?,instagram=?,linkedin=?,milestones=?,recruitment_open=?,recruitment_note=? WHERE id=?`,
    b.name.trim(), b.short_name || null, b.tagline || null, b.description || null, b.category || null, b.icon || 'sparkles', b.color || '#4f46e5', b.color2 || '#7c3aed',
    b.founded ? Number(b.founded) : null, b.email || null, b.phone || null, b.website || null, b.instagram || null, b.linkedin || null,
    JSON.stringify((b.milestones || []).filter(Boolean)), b.recruitment_open ? 1 : 0, b.recruitment_note || null, req.params.clubId);
  res.json(parseClub(one('SELECT * FROM clubs WHERE id=?', req.params.clubId)));
}));
app.get('/api/manage/:clubId/structure', h((req, res) => {
  requirePerm(req, req.params.clubId);
  const id = req.params.clubId;
  res.json({
    divisions: all(`SELECT d.*, (SELECT COUNT(*) FROM memberships m WHERE m.division_id=d.id AND m.status='approved') members FROM divisions d WHERE club_id=? ORDER BY sort,id`, id),
    roles: all(`SELECT r.*, (SELECT COUNT(*) FROM memberships m WHERE m.role_id=r.id AND m.status='approved') members FROM club_roles r WHERE club_id=? ORDER BY rank,id`, id),
    stages: JSON.parse(one('SELECT stages FROM clubs WHERE id=?', id).stages),
  });
}));
app.put('/api/manage/:clubId/structure', h((req, res) => {
  const perms = requirePerm(req, req.params.clubId, 'club');
  const id = Number(req.params.clubId);
  const { divisions = [], roles = [], stages = [] } = req.body || {};
  if (!roles.length) fail(400, 'A club needs at least one role.');
  if (!roles.some((r) => (r.perms || []).includes('club'))) fail(400, 'At least one role must keep the "Club settings" permission, or nobody could edit the club.');
  const cleanStages = stages.map((s) => String(s).trim()).filter(Boolean);
  if (cleanStages.length < 2) fail(400, 'Recruitment needs at least two stages (e.g. Application → Selected).');
  tx(() => {
    const keepD = []; divisions.forEach((d, i) => {
      if (!d.name?.trim()) return;
      if (d.id && one('SELECT 1 FROM divisions WHERE id=? AND club_id=?', d.id, id)) { run('UPDATE divisions SET name=?,description=?,sort=? WHERE id=?', d.name.trim(), d.description || null, i, d.id); keepD.push(d.id); }
      else keepD.push(Number(run('INSERT INTO divisions (club_id,name,description,sort) VALUES (?,?,?,?)', id, d.name.trim(), d.description || null, i).lastInsertRowid));
    });
    all('SELECT id FROM divisions WHERE club_id=?', id).filter((d) => !keepD.includes(d.id)).forEach((d) => run('DELETE FROM divisions WHERE id=?', d.id));
    const keepR = []; roles.forEach((r, i) => {
      if (!r.name?.trim()) return;
      const p = (r.perms || []).filter((x) => ALL_PERMS.includes(x)).join(',');
      const rank = Number(r.rank) || i + 1;
      if (r.id && one('SELECT 1 FROM club_roles WHERE id=? AND club_id=?', r.id, id)) { run('UPDATE club_roles SET name=?,rank=?,perms=? WHERE id=?', r.name.trim(), rank, p, r.id); keepR.push(r.id); }
      else keepR.push(Number(run('INSERT INTO club_roles (club_id,name,rank,perms) VALUES (?,?,?,?)', id, r.name.trim(), rank, p).lastInsertRowid));
    });
    const fallback = one(`SELECT id FROM club_roles WHERE club_id=? AND id IN (${keepR.join(',')}) ORDER BY rank DESC LIMIT 1`, id).id;
    all('SELECT id FROM club_roles WHERE club_id=?', id).filter((r) => !keepR.includes(r.id)).forEach((r) => { run('UPDATE memberships SET role_id=? WHERE role_id=?', fallback, r.id); run('DELETE FROM club_roles WHERE id=?', r.id); });
    run('UPDATE clubs SET stages=? WHERE id=?', JSON.stringify(cleanStages), id);
    run(`UPDATE memberships SET stage=? WHERE club_id=? AND status='pending' AND stage>=?`, cleanStages.length - 2, id, cleanStages.length - 1);
  });
  // the editor must not lock themselves out
  if (req.user.platform_role !== 'college_admin' && !permsFor(req.user, id).has('club') && perms.has('club')) {
    /* allowed — but warn the client */ return res.json({ ok: true, warning: 'Your own role no longer has club-settings permission.' });
  }
  res.json({ ok: true });
}));
app.get('/api/manage/:clubId/members', h((req, res) => {
  requirePerm(req, req.params.clubId);
  const rows = all(`SELECT m.*, u.name, u.email, u.usn, u.branch, u.year, u.phone, r.name role_name, r.rank, d.name division_name
    FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN club_roles r ON r.id=m.role_id LEFT JOIN divisions d ON d.id=m.division_id
    WHERE m.club_id=? AND m.status IN ('approved','pending','rejected') ORDER BY r.rank, u.name`, req.params.clubId);
  const meetings = one('SELECT COUNT(*) n FROM meetings WHERE club_id=?', req.params.clubId).n;
  rows.forEach((r) => { if (r.status === 'approved') { const a = one(`SELECT COUNT(*) t, SUM(a.status='present') p FROM meeting_attendance a JOIN meetings mt ON mt.id=a.meeting_id WHERE mt.club_id=? AND a.user_id=?`, req.params.clubId, r.user_id); r.att = a.t ? Math.round(100 * (a.p || 0) / a.t) : null; } });
  res.json({ members: rows, meetings });
}));
app.put('/api/manage/:clubId/members/:mid', h((req, res) => {
  requirePerm(req, req.params.clubId, 'members');
  const club = parseClub(one('SELECT * FROM clubs WHERE id=?', req.params.clubId));
  const m = one('SELECT * FROM memberships WHERE id=? AND club_id=?', req.params.mid, club.id);
  if (!m) fail(404, 'Member not found');
  const { action, role_id, division_id, score, note, stage_date } = req.body || {};
  const last = club.stages.length - 1;
  const link = '/me?tab=clubs';
  const defaultRole = () => (one(`SELECT id FROM club_roles WHERE club_id=? AND lower(name) IN ('member','trainee') ORDER BY rank DESC LIMIT 1`, club.id) || one('SELECT id FROM club_roles WHERE club_id=? ORDER BY rank DESC LIMIT 1', club.id)).id;
  if (action === 'advance') {
    const next = m.stage + 1;
    if (next >= last) { run(`UPDATE memberships SET status='approved', stage=?, role_id=COALESCE(?,role_id,?), joined_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), score=COALESCE(?,score), note=COALESCE(?,note) WHERE id=?`, last, role_id || null, defaultRole(), score ?? null, note ?? null, m.id); notify(m.user_id, `Welcome to ${club.name}! 🎉`, `Your application was successful — you are now a member of ${club.name}.`, `/clubs/${club.slug}`); }
    else { run('UPDATE memberships SET stage=?, score=COALESCE(?,score), note=?, stage_date=? WHERE id=?', next, score ?? null, note || null, stage_date || null, m.id); notify(m.user_id, `${club.stages[next]} — ${club.name}`, `You have moved to the "${club.stages[next]}" stage.${stage_date ? ' Scheduled: ' + new Date(stage_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) + '.' : ''}${note ? ' ' + note : ''}`, link); }
  } else if (action === 'approve') {
    run(`UPDATE memberships SET status='approved', stage=?, role_id=COALESCE(?,role_id,?), division_id=COALESCE(?,division_id), joined_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`, last, role_id || null, defaultRole(), division_id || null, m.id);
    notify(m.user_id, `Welcome to ${club.name}! 🎉`, `Your membership request was approved.`, `/clubs/${club.slug}`);
  } else if (action === 'reject') {
    run(`UPDATE memberships SET status='rejected', note=? WHERE id=?`, note || null, m.id);
    notify(m.user_id, `Update on your ${club.name} application`, note || 'Thank you for applying. Unfortunately we could not move ahead with your application this time.', link);
  } else if (action === 'update') {
    run('UPDATE memberships SET role_id=COALESCE(?,role_id), division_id=?, score=COALESCE(?,score), note=COALESCE(?,note), stage_date=COALESCE(?,stage_date) WHERE id=?', role_id || null, division_id || null, score ?? null, note ?? null, stage_date ?? null, m.id);
    if (role_id && role_id !== m.role_id && m.status === 'approved') { const r = one('SELECT name FROM club_roles WHERE id=?', role_id); notify(m.user_id, `New role in ${club.name}`, `You are now ${r.name}.`, `/clubs/${club.slug}`); }
  } else if (action === 'remove') {
    if (m.user_id === req.user.id) fail(400, 'You cannot remove yourself.');
    run(`UPDATE memberships SET status='removed' WHERE id=?`, m.id);
  } else fail(400, 'Unknown action');
  res.json({ ok: true });
}));

// events (admin)
const eventFields = (b) => {
  if (!b.title?.trim()) fail(400, 'Event title is required.');
  if (!b.start_at || !b.end_at) fail(400, 'Start and end time are required.');
  if (new Date(b.end_at) <= new Date(b.start_at)) fail(400, 'End time must be after the start time.');
  if (b.reg_deadline && new Date(b.reg_deadline) > new Date(b.end_at)) fail(400, 'Registration deadline must be before the event ends.');
  if (!(Number(b.capacity) > 0)) fail(400, 'Capacity must be at least 1.');
  return [b.title.trim(), b.description || null, b.category || 'Workshop', new Date(b.start_at).toISOString(), new Date(b.end_at).toISOString(), b.venue || null,
    b.reg_deadline ? new Date(b.reg_deadline).toISOString() : null, Number(b.capacity), b.waitlist ? 1 : 0, b.members_only ? 1 : 0];
};
app.post('/api/manage/:clubId/events', h((req, res) => {
  requirePerm(req, req.params.clubId, 'events');
  const f = eventFields(req.body || {});
  const status = req.body.status === 'published' ? 'published' : 'draft';
  const id = run(`INSERT INTO events (club_id,title,description,category,start_at,end_at,venue,reg_deadline,capacity,waitlist,members_only,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, req.params.clubId, ...f, status).lastInsertRowid;
  res.json(enrichEvent(eventOr404(id)));
}));
app.put('/api/manage/events/:id', h((req, res) => {
  const e = eventOr404(req.params.id);
  requirePerm(req, e.club_id, 'events');
  const f = eventFields({ ...e, ...req.body });
  run('UPDATE events SET title=?,description=?,category=?,start_at=?,end_at=?,venue=?,reg_deadline=?,capacity=?,waitlist=?,members_only=? WHERE id=?', ...f, e.id);
  promoteWaitlist(e.id);
  if (e.status === 'published' && (e.start_at !== f[3] || e.venue !== f[5])) {
    all(`SELECT user_id FROM registrations WHERE event_id=? AND status IN ('registered','waitlisted')`, e.id)
      .forEach((r) => notify(r.user_id, `Event updated: ${f[0]}`, `Please check the new date/time/venue: ${new Date(f[3]).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} at ${f[5]}.`, `/events/${e.id}`));
  }
  res.json(enrichEvent(eventOr404(e.id)));
}));
app.post('/api/manage/events/:id/status', h((req, res) => {
  const e = eventOr404(req.params.id);
  const { status, approval, checkin_open } = req.body || {};
  if (approval) {
    if (req.user?.platform_role !== 'college_admin') fail(403, 'Only the college administrator can approve events.');
    run('UPDATE events SET approval=? WHERE id=?', approval === 'approved' ? 'approved' : 'pending', e.id);
    return res.json(enrichEvent(eventOr404(e.id)));
  }
  requirePerm(req, e.club_id, checkin_open !== undefined ? 'attendance' : 'events');
  if (checkin_open !== undefined) run('UPDATE events SET checkin_open=? WHERE id=?', checkin_open ? 1 : 0, e.id);
  if (status) {
    if (!['draft', 'published', 'cancelled'].includes(status)) fail(400, 'Bad status');
    run('UPDATE events SET status=? WHERE id=?', status, e.id);
    if (status === 'cancelled' && e.status !== 'cancelled') {
      all(`SELECT user_id FROM registrations WHERE event_id=? AND status IN ('registered','waitlisted')`, e.id)
        .forEach((r) => notify(r.user_id, `Cancelled: ${e.title}`, 'The organisers have cancelled this event. Sorry for the inconvenience!', `/events/${e.id}`));
    }
  }
  res.json(enrichEvent(eventOr404(e.id)));
}));
app.delete('/api/manage/events/:id', h((req, res) => {
  const e = eventOr404(req.params.id);
  requirePerm(req, e.club_id, 'events');
  if (e.status !== 'draft') fail(400, 'Only draft events can be deleted. Cancel published events instead.');
  run('DELETE FROM events WHERE id=?', e.id);
  res.json({ ok: true });
}));
app.get('/api/manage/events/:id', h((req, res) => {
  const e = eventOr404(req.params.id);
  const perms = requirePerm(req, e.club_id);
  const out = enrichEvent(e);
  out.perms = [...perms];
  out.registrations = all(`SELECT r.*, u.email FROM registrations r JOIN users u ON u.id=r.user_id WHERE r.event_id=? AND r.status!='cancelled' ORDER BY r.status, r.name`, e.id);
  out.tasks = all('SELECT * FROM volunteer_tasks WHERE event_id=? ORDER BY slot_start,id', e.id).map((t) => ({
    ...t, signups: all(`SELECT s.*, u.name, u.usn, u.branch, u.email FROM volunteer_signups s JOIN users u ON u.id=s.user_id WHERE s.task_id=? AND s.status!='cancelled' ORDER BY s.id`, t.id),
  }));
  out.certificates = all('SELECT c.*, u.name FROM certificates c JOIN users u ON u.id=c.user_id WHERE c.event_id=? ORDER BY c.type, u.name', e.id);
  out.members = all(`SELECT u.id, u.name, u.usn FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.club_id=? AND m.status='approved' ORDER BY u.name`, e.club_id);
  res.json(out);
}));
app.post('/api/manage/events/:id/attendance', h((req, res) => {
  const e = eventOr404(req.params.id);
  requirePerm(req, e.club_id, 'attendance');
  const { updates = [] } = req.body || {};
  tx(() => updates.forEach(({ id, attendance }) => {
    const val = ['present', 'absent'].includes(attendance) ? attendance : null;
    run(`UPDATE registrations SET attendance=?, checked_in_at=CASE WHEN ?='present' THEN COALESCE(checked_in_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')) ELSE NULL END WHERE id=? AND event_id=? AND status='registered'`, val, val, id, e.id);
  }));
  res.json({ ok: true });
}));
app.post('/api/manage/events/:id/checkin', h((req, res) => {
  const e = eventOr404(req.params.id);
  requirePerm(req, e.club_id, 'attendance');
  let code = String(req.body?.code || '').trim();
  const m = code.match(/CHK:(\d+):([A-Z0-9]+)/i);
  if (m) { if (Number(m[1]) !== e.id) fail(400, 'This ticket belongs to a different event.'); code = m[2]; }
  const r = one('SELECT * FROM registrations WHERE event_id=? AND (upper(ticket)=upper(?) OR upper(usn)=upper(?))', e.id, code, code);
  if (!r || r.status === 'cancelled') fail(404, 'No registration found for this ticket / USN.');
  if (r.status === 'waitlisted') fail(400, `${r.name} is on the waitlist and does not have a confirmed seat.`);
  const already = r.attendance === 'present';
  if (!already) run(`UPDATE registrations SET attendance='present', checked_in_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`, r.id);
  res.json({ ok: true, already, registration: { ...r, attendance: 'present' } });
}));
app.get('/api/manage/events/:id/attendance.csv', h((req, res) => {
  const e = eventOr404(req.params.id);
  requirePerm(req, e.club_id);
  const rows = all(`SELECT r.name, r.usn, r.branch, r.year, u.email, r.status, COALESCE(r.attendance,'not marked') attendance, r.checked_in_at, r.created_at FROM registrations r JOIN users u ON u.id=r.user_id WHERE r.event_id=? AND r.status!='cancelled' ORDER BY r.name`, e.id);
  sendCsv(res, `${e.title}-attendance`, ['Name', 'USN', 'Branch', 'Year', 'Email', 'Registration', 'Attendance', 'Checked in at', 'Registered at'], rows.map(Object.values));
}));
function sendCsv(res, name, header, rows) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name.replace(/[^\w-]+/g, '_')}.csv"`);
  res.send('﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n'));
}

// volunteers (admin)
app.post('/api/manage/events/:id/tasks', h((req, res) => {
  const e = eventOr404(req.params.id);
  requirePerm(req, e.club_id, 'volunteers');
  const { role, description, slot_start, slot_end, needed, hours } = req.body || {};
  if (!role?.trim()) fail(400, 'Task role is required.');
  run('INSERT INTO volunteer_tasks (event_id,role,description,slot_start,slot_end,needed,hours) VALUES (?,?,?,?,?,?,?)', e.id, role.trim(), description || null,
    slot_start ? new Date(slot_start).toISOString() : e.start_at, slot_end ? new Date(slot_end).toISOString() : e.end_at, Number(needed) || 1, Number(hours) || 1);
  res.json({ ok: true });
}));
app.put('/api/manage/tasks/:id', h((req, res) => {
  const t = one('SELECT t.*, e.club_id FROM volunteer_tasks t JOIN events e ON e.id=t.event_id WHERE t.id=?', req.params.id);
  if (!t) fail(404, 'Task not found');
  requirePerm(req, t.club_id, 'volunteers');
  const b = { ...t, ...req.body };
  run('UPDATE volunteer_tasks SET role=?,description=?,slot_start=?,slot_end=?,needed=?,hours=? WHERE id=?', b.role, b.description, new Date(b.slot_start).toISOString(), new Date(b.slot_end).toISOString(), Number(b.needed) || 1, Number(b.hours) || 1, t.id);
  res.json({ ok: true });
}));
app.delete('/api/manage/tasks/:id', h((req, res) => {
  const t = one('SELECT t.*, e.club_id FROM volunteer_tasks t JOIN events e ON e.id=t.event_id WHERE t.id=?', req.params.id);
  if (!t) fail(404, 'Task not found');
  requirePerm(req, t.club_id, 'volunteers');
  run('DELETE FROM volunteer_tasks WHERE id=?', t.id);
  res.json({ ok: true });
}));
app.post('/api/manage/tasks/:id/assign', h((req, res) => {
  const t = one('SELECT t.*, e.club_id, e.title FROM volunteer_tasks t JOIN events e ON e.id=t.event_id WHERE t.id=?', req.params.id);
  if (!t) fail(404, 'Task not found');
  requirePerm(req, t.club_id, 'volunteers');
  const uid = Number(req.body?.user_id);
  if (!one('SELECT 1 FROM users WHERE id=?', uid)) fail(404, 'User not found');
  const ex = one('SELECT * FROM volunteer_signups WHERE task_id=? AND user_id=?', t.id, uid);
  if (ex) run(`UPDATE volunteer_signups SET status='assigned' WHERE id=?`, ex.id); else run(`INSERT INTO volunteer_signups (task_id,user_id,status) VALUES (?,?,'assigned')`, t.id, uid);
  notify(uid, `Volunteer assignment: ${t.role}`, `You have been assigned as "${t.role}" for ${t.title}.`, '/me?tab=volunteering');
  res.json({ ok: true });
}));
app.put('/api/manage/signups/:id', h((req, res) => {
  const s = one('SELECT s.*, t.hours task_hours, t.role, e.club_id, e.title FROM volunteer_signups s JOIN volunteer_tasks t ON t.id=s.task_id JOIN events e ON e.id=t.event_id WHERE s.id=?', req.params.id);
  if (!s) fail(404, 'Sign-up not found');
  requirePerm(req, s.club_id, 'volunteers');
  const { status, hours } = req.body || {};
  if (!['signed_up', 'assigned', 'completed', 'no_show', 'cancelled'].includes(status)) fail(400, 'Bad status');
  run('UPDATE volunteer_signups SET status=?, hours=? WHERE id=?', status, status === 'completed' ? Number(hours ?? s.hours ?? s.task_hours) : null, s.id);
  if (status === 'assigned' && s.status === 'signed_up') notify(s.user_id, `Volunteer confirmed: ${s.role}`, `You are confirmed as "${s.role}" for ${s.title}.`, '/me?tab=volunteering');
  res.json({ ok: true });
}));

// certificates (admin)
app.post('/api/manage/events/:id/certificates', h((req, res) => {
  const e = eventOr404(req.params.id);
  requirePerm(req, e.club_id, 'certificates');
  if (new Date(e.start_at) > new Date()) fail(400, 'Certificates can be generated once the event has started.');
  const types = req.body?.types || ['participation', 'volunteer'];
  let created = 0;
  tx(() => {
    if (types.includes('participation')) all(`SELECT user_id FROM registrations WHERE event_id=? AND attendance='present'`, e.id).forEach((r) => {
      if (!one(`SELECT 1 FROM certificates WHERE user_id=? AND event_id=? AND type='participation'`, r.user_id, e.id)) {
        run(`INSERT INTO certificates (code,user_id,event_id,type) VALUES (?,?,?,'participation')`, newCode('RVCE'), r.user_id, e.id); created++;
        notify(r.user_id, 'Certificate issued 🎓', `Your participation certificate for "${e.title}" is ready.`, '/me?tab=certificates');
      }
    });
    if (types.includes('volunteer')) all(`SELECT s.user_id, GROUP_CONCAT(t.role, ', ') roles, SUM(s.hours) hours FROM volunteer_signups s JOIN volunteer_tasks t ON t.id=s.task_id WHERE t.event_id=? AND s.status='completed' GROUP BY s.user_id`, e.id).forEach((v) => {
      if (!one(`SELECT 1 FROM certificates WHERE user_id=? AND event_id=? AND type='volunteer'`, v.user_id, e.id)) {
        run(`INSERT INTO certificates (code,user_id,event_id,type,detail,hours) VALUES (?,?,?,'volunteer',?,?)`, newCode('RVCE'), v.user_id, e.id, v.roles, v.hours); created++;
        notify(v.user_id, 'Volunteer certificate issued 🎓', `Thank you for volunteering at "${e.title}"! Your certificate is ready.`, '/me?tab=certificates');
      }
    });
  });
  res.json({ created });
}));
app.post('/api/manage/certificates/:code/revoke', h((req, res) => {
  const c = one('SELECT c.*, e.club_id FROM certificates c JOIN events e ON e.id=c.event_id WHERE c.code=?', req.params.code);
  if (!c) fail(404, 'Certificate not found');
  requirePerm(req, c.club_id, 'certificates');
  run('UPDATE certificates SET revoked=? WHERE code=?', req.body?.revoke === false ? 0 : 1, c.code);
  res.json({ ok: true });
}));

// meetings / club attendance
app.get('/api/manage/:clubId/meetings', h((req, res) => {
  requirePerm(req, req.params.clubId);
  const meetings = all(`SELECT mt.*, d.name division_name, (SELECT COUNT(*) FROM meeting_attendance a WHERE a.meeting_id=mt.id AND a.status='present') present,
    (SELECT COUNT(*) FROM meeting_attendance a WHERE a.meeting_id=mt.id) marked FROM meetings mt LEFT JOIN divisions d ON d.id=mt.division_id WHERE mt.club_id=? ORDER BY mt.date DESC`, req.params.clubId);
  res.json(meetings);
}));
app.post('/api/manage/:clubId/meetings', h((req, res) => {
  requirePerm(req, req.params.clubId, 'attendance');
  const { title, date, division_id } = req.body || {};
  if (!title?.trim() || !date) fail(400, 'Title and date are required.');
  const id = run('INSERT INTO meetings (club_id,division_id,title,date) VALUES (?,?,?,?)', req.params.clubId, division_id || null, title.trim(), new Date(date).toISOString()).lastInsertRowid;
  res.json({ id: Number(id) });
}));
app.get('/api/manage/meetings/:id', h((req, res) => {
  const mt = one('SELECT * FROM meetings WHERE id=?', req.params.id);
  if (!mt) fail(404, 'Meeting not found');
  requirePerm(req, mt.club_id);
  const members = all(`SELECT u.id user_id, u.name, u.usn, d.name division_name, a.status FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN divisions d ON d.id=m.division_id
    LEFT JOIN meeting_attendance a ON a.meeting_id=? AND a.user_id=u.id WHERE m.club_id=? AND m.status='approved' ${mt.division_id ? 'AND m.division_id=' + Number(mt.division_id) : ''} ORDER BY u.name`, mt.id, mt.club_id);
  res.json({ meeting: mt, members });
}));
app.post('/api/manage/meetings/:id/attendance', h((req, res) => {
  const mt = one('SELECT * FROM meetings WHERE id=?', req.params.id);
  if (!mt) fail(404, 'Meeting not found');
  requirePerm(req, mt.club_id, 'attendance');
  tx(() => (req.body?.updates || []).forEach(({ user_id, status }) => {
    if (!status) run('DELETE FROM meeting_attendance WHERE meeting_id=? AND user_id=?', mt.id, user_id);
    else run('INSERT INTO meeting_attendance (meeting_id,user_id,status) VALUES (?,?,?) ON CONFLICT(meeting_id,user_id) DO UPDATE SET status=excluded.status', mt.id, user_id, status === 'present' ? 'present' : 'absent');
  }));
  res.json({ ok: true });
}));
app.delete('/api/manage/meetings/:id', h((req, res) => {
  const mt = one('SELECT * FROM meetings WHERE id=?', req.params.id);
  if (!mt) fail(404, 'Meeting not found');
  requirePerm(req, mt.club_id, 'attendance');
  run('DELETE FROM meetings WHERE id=?', mt.id);
  res.json({ ok: true });
}));

// reports
app.get('/api/manage/:clubId/report/:kind.csv', h((req, res) => {
  requirePerm(req, req.params.clubId);
  const id = req.params.clubId; const club = one('SELECT name FROM clubs WHERE id=?', id);
  if (req.params.kind === 'events') {
    const rows = all('SELECT * FROM events WHERE club_id=? ORDER BY start_at', id).map((e) => enrichEvent(e)).map((e) => [e.title, e.category, e.start_at.slice(0, 10), e.venue, e.status, e.capacity, e.registered, e.waitlisted, e.present, e.absent, e.present + e.absent ? Math.round(100 * e.present / (e.present + e.absent)) + '%' : '']);
    return sendCsv(res, `${club.name}-events-report`, ['Event', 'Category', 'Date', 'Venue', 'Status', 'Capacity', 'Registered', 'Waitlisted', 'Present', 'Absent', 'Attendance %'], rows);
  }
  if (req.params.kind === 'members') {
    const rows = all(`SELECT u.name, u.usn, u.branch, u.year, u.email, r.name role, d.name division, m.joined_at FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN club_roles r ON r.id=m.role_id LEFT JOIN divisions d ON d.id=m.division_id WHERE m.club_id=? AND m.status='approved' ORDER BY r.rank, u.name`, id);
    return sendCsv(res, `${club.name}-members`, ['Name', 'USN', 'Branch', 'Year', 'Email', 'Role', 'Division', 'Joined'], rows.map(Object.values));
  }
  if (req.params.kind === 'volunteers') {
    const rows = all(`SELECT u.name, u.usn, e.title, t.role, s.status, s.hours FROM volunteer_signups s JOIN users u ON u.id=s.user_id JOIN volunteer_tasks t ON t.id=s.task_id JOIN events e ON e.id=t.event_id WHERE e.club_id=? AND s.status!='cancelled' ORDER BY e.start_at, u.name`, id);
    return sendCsv(res, `${club.name}-volunteers`, ['Name', 'USN', 'Event', 'Task', 'Status', 'Hours'], rows.map(Object.values));
  }
  fail(404, 'Unknown report');
}));

// college admin: create clubs & approvals
app.get('/api/admin/overview', h((req, res) => {
  if (needUser(req).platform_role !== 'college_admin') fail(403, 'College administrators only.');
  res.json({
    pending: all(`SELECT * FROM events WHERE approval='pending' AND status!='cancelled' ORDER BY start_at`).map((e) => enrichEvent(e)),
    clubs: all(`SELECT c.id,c.slug,c.name,c.icon,c.color,c.color2,c.category,(SELECT COUNT(*) FROM memberships m WHERE m.club_id=c.id AND m.status='approved') members,
      (SELECT COUNT(*) FROM events e WHERE e.club_id=c.id AND e.status='published') events,
      (SELECT COUNT(*) FROM registrations r JOIN events e ON e.id=r.event_id WHERE e.club_id=c.id AND r.attendance='present') attended FROM clubs c ORDER BY c.name`),
  });
}));
app.post('/api/admin/clubs', h((req, res) => {
  if (needUser(req).platform_role !== 'college_admin') fail(403, 'College administrators only.');
  const { name, category, lead_email } = req.body || {};
  if (!name?.trim()) fail(400, 'Club name is required.');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (one('SELECT 1 FROM clubs WHERE slug=?', slug)) fail(409, 'A club with this name already exists.');
  const lead = lead_email ? one('SELECT * FROM users WHERE lower(email)=lower(?)', lead_email) : null;
  if (lead_email && !lead) fail(404, 'No user with that email — ask them to sign up first.');
  const id = tx(() => {
    const cid = Number(run(`INSERT INTO clubs (slug,name,short_name,category,tagline,description,stages) VALUES (?,?,?,?,?,?,?)`, slug, name.trim(), name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase(), category || 'Computing', 'A new club at RVCE', 'Tell students what your club does.', JSON.stringify(['Application', 'Interview', 'Selected'])).lastInsertRowid);
    const top = Number(run(`INSERT INTO club_roles (club_id,name,rank,perms) VALUES (?,?,?,?)`, cid, 'President', 1, ALL_PERMS.join(',')).lastInsertRowid);
    run(`INSERT INTO club_roles (club_id,name,rank,perms) VALUES (?,?,?,?)`, cid, 'Member', 5, '');
    run(`INSERT INTO divisions (club_id,name,sort) VALUES (?,?,0)`, cid, 'General');
    if (lead) { run(`INSERT INTO memberships (club_id,user_id,role_id,status,stage,joined_at) VALUES (?,?,?,'approved',2,strftime('%Y-%m-%dT%H:%M:%fZ','now'))`, cid, lead.id, top); notify(lead.id, `You now lead ${name.trim()}`, 'Set up your club profile, divisions and roles from the Manage console.', `/manage/${cid}/settings`); }
    return cid;
  });
  res.json({ id, slug });
}));

// ---------------------------------------------------------------- static client
const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  if (!(err instanceof HttpError)) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong on the server.' });
});

const PORT = Number(process.env.PORT) || 4000;
if (!ON_VERCEL) app.listen(PORT, () => console.log(`ClubHub running at http://localhost:${PORT}`));

export default app;
