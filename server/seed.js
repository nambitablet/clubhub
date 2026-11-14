// Seeds ClubHub with the RVCE clubs, a set of upcoming sample events and FOUR role accounts.
// No other people are created: memberships, registrations, attendance, volunteer records and
// certificates start empty and fill up as the accounts below (and new sign-ups) use the site.
import fs from 'node:fs';
import { openDb, DB_PATH, hashPassword } from './db.js';
import { CLUBS } from './clubs-data.js';

// Login accounts — one per position. Keep in sync with README.md and the login page.
export const ACCOUNTS = [
  { key: 'college', name: 'College Administrator', email: 'collegeadmin@rvce.edu.in', password: 'Admin@2026', platform_role: 'college_admin', bio: 'Office of Student Affairs — approves events and registers clubs.' },
  { key: 'president', name: 'Coding Club President', email: 'president.codingclub@rvce.edu.in', password: 'Coding@2026', usn: '1RV23CS001', branch: 'CS', year: 3, club: 'coding-club', role: 'President', bio: 'Manages the Coding Club profile, events, recruitment and certificates.' },
  { key: 'captain', name: 'Team Antariksh Captain', email: 'captain.antariksh@rvce.edu.in', password: 'Antariksh@2026', usn: '1RV23AS001', branch: 'AS', year: 3, club: 'team-antariksh', role: 'Team Captain', bio: 'Leads Team Antariksh — runs its recruitment pipeline and events.' },
  { key: 'student', name: 'Student User', email: 'student@rvce.edu.in', password: 'Student@2026', usn: '1RV24CS001', branch: 'CS', year: 2, bio: 'Explores clubs, registers for events and volunteers.' },
];

export function seed({ reset = false } = {}) {
  if (reset) for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) { try { fs.rmSync(f); } catch {} }
  const db = openDb();
  if (db.prepare('SELECT COUNT(*) c FROM clubs').get().c > 0) return db;

  const day = (offset, h = 10, m = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(h, m, 0, 0); return d.toISOString(); };
  db.exec('BEGIN');

  const insUser = db.prepare('INSERT INTO users (name,email,password_hash,usn,branch,year,bio,platform_role) VALUES (?,?,?,?,?,?,?,?)');
  const uid = {};
  for (const a of ACCOUNTS) {
    uid[a.key] = Number(insUser.run(a.name, a.email, hashPassword(a.password), a.usn || null, a.branch || null, a.year || null, a.bio, a.platform_role || 'student').lastInsertRowid);
  }

  const insClub = db.prepare(`INSERT INTO clubs (slug,name,short_name,tagline,description,category,icon,color,color2,founded,email,website,instagram,milestones,recruitment_open,recruitment_note,stages) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insDiv = db.prepare('INSERT INTO divisions (club_id,name,sort) VALUES (?,?,?)');
  const insRole = db.prepare('INSERT INTO club_roles (club_id,name,rank,perms) VALUES (?,?,?,?)');
  const insMem = db.prepare(`INSERT INTO memberships (club_id,user_id,role_id,status,stage,joined_at) VALUES (?,?,?,'approved',?,?)`);
  const clubId = {};
  for (const c of CLUBS) {
    const handle = c.slug.replace(/-/g, '');
    const id = Number(insClub.run(c.slug, c.name, c.short, c.tagline, c.description, c.category, c.icon, c.color, c.color2, c.founded,
      `${handle}@rvce.edu.in`, 'https://rvce.edu.in/innovative_teams', `@${handle}_rvce`, JSON.stringify(c.milestones), 1,
      `Recruitment for first and second year students. ${c.stages.length > 3 ? `Shortlisted applicants take the ${c.stages[1]} followed by the ${c.stages[c.stages.length - 2]}.` : 'Shortlisted applicants are called for an interview.'}`,
      JSON.stringify(c.stages)).lastInsertRowid);
    clubId[c.slug] = id;
    c.divisions.forEach((d, i) => insDiv.run(id, d, i));
    const roles = c.roles.map(([n, r, p]) => ({ id: Number(insRole.run(id, n, r, p).lastInsertRowid), name: n }));
    for (const a of ACCOUNTS.filter((x) => x.club === c.slug)) {
      insMem.run(id, uid[a.key], roles.find((r) => r.name === a.role).id, c.stages.length - 1, day(0, 9));
    }
  }

  // Upcoming sample events (no registrations yet).
  const insEvent = db.prepare(`INSERT INTO events (club_id,title,description,category,start_at,end_at,venue,reg_deadline,capacity,waitlist,members_only,status,approval) VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?)`);
  const insTask = db.prepare('INSERT INTO volunteer_tasks (event_id,role,description,slot_start,slot_end,needed,hours) VALUES (?,?,?,?,?,?,?)');
  const TASKS = [
    ['Registration Desk', 'Check in participants, verify tickets and hand out kits.', 0, 2, 3],
    ['Stage & Logistics', 'Set up the venue, manage mics, projector and seating.', -1, 3, 4],
    ['Photography', 'Capture photos and short clips for social media.', 0, 1, 3],
  ];
  const EV = [
    ['coding-club', 'HackRVCE 8.0', 'A 24-hour campus hackathon with tracks on AI for Good, FinTech and Sustainability. Teams of 2–4, mentors from industry, swag and prizes. Bring your laptop and ideas!', 'Hackathon', 12, 9, 24 * 60, 'CSE Department, Block 3 Labs', 120, 1],
    ['coding-club', 'Capture The Flag Night', 'Beginner-friendly CTF with web exploitation, cryptography, forensics and reverse-engineering challenges. Learn as you hack — hints available.', 'Competition', 5, 18, 240, 'ISE Lab 2', 60, 1],
    ['coding-club', 'Open Source Contribution Drive', 'Make your first open-source pull request with mentors guiding you through issues on real projects.', 'Workshop', 31, 14, 180, 'CSE Seminar Hall', 70, 1],
    ['dhruva', 'Stargazing Night: Winter Skies', 'Observe Jupiter, Saturn, the Orion Nebula and the Pleiades through our telescopes. Includes a short session on night-sky navigation.', 'Outreach', 3, 19, 180, 'Main Ground (near Admin Block)', 100, 1],
    ['team-antariksh', 'Rocketry 101: Build & Launch', 'Design, build and launch your own water rocket! Learn about thrust, stability and recovery from the team that flew RVSat-1.', 'Workshop', 8, 10, 300, 'Aerospace Department & Ground', 40, 1],
    ['astra-robotics', 'Robotics Bootcamp: Autonomous Rovers', 'A two-day bootcamp on ROS 2, SLAM and motor control — end the weekend with a rover that drives itself.', 'Workshop', 15, 9, 480, 'ECE Robotics Lab', 30, 1],
    ['ham-club', 'Fox Hunting Challenge', 'Track down hidden radio transmitters across campus using handheld receivers and directional antennas. Teams of 3.', 'Competition', 10, 14, 180, 'Campus-wide (start at Ham Shack)', 45, 1],
    ['gdg-rvce', 'Google Cloud Study Jam', 'Guided hands-on labs on Google Cloud — compute, storage and Gen AI. Earn skill badges as you go.', 'Workshop', 6, 14, 180, 'ISE Seminar Hall', 90, 1],
    ['acm-rvce', 'Code Sprint 2026', 'A fast-paced 3-hour algorithmic sprint. Solo participation; prizes for top three and best first-year.', 'Competition', 18, 13, 180, 'CSE Labs 1–4', 160, 1],
    ['women-in-cloud', 'Cloud Careers Panel', 'Engineers from leading cloud companies talk about careers, interviews and growth in cloud computing. Open to all.', 'Talk', 9, 16, 120, 'MCA Seminar Hall', 120, 0],
    ['spark', 'EduAIthon 2.0', 'A 48-hour hackathon on AI in education. Build tools that help students learn better.', 'Hackathon', 25, 9, 48 * 60, 'Innovation Centre', 200, 1],
    ['anoraniya', 'Intro to Quantum Computing with Qiskit', 'Qubits, gates and your first quantum circuit on real IBM hardware. Basic Python is enough.', 'Workshop', 11, 14, 150, 'Physics Seminar Hall', 60, 1],
    ['team-krushi', 'Agri-Tech Field Day', 'Visit a partner farm, understand real problems faced by smallholder farmers and brainstorm solutions with the team.', 'Field Trip', 20, 7, 600, 'Bus from Main Gate', 35, 1],
    ['ashwa-racing', 'Formula Student Open House', 'See our race car up close, meet each division and learn how a Formula Student car goes from CAD to track.', 'Open House', 4, 15, 120, 'Mechanical Dept Workshop', 150, 0],
    ['team-vyoma', 'RC Plane Build Workshop', 'Build and fly a foam-board RC plane in a day. Learn the basics of aerodynamics, control surfaces and flight.', 'Workshop', 13, 9, 420, 'Aerospace Department', 30, 1],
    ['project-jatayu', 'Drone Autonomy Workshop', 'Program waypoint missions with ArduPilot and Mission Planner. Simulation first, then a supervised live flight.', 'Workshop', 22, 10, 240, 'ECE Seminar Hall', 40, 1],
    ['accelerate-club', 'Startup Bootcamp', 'From idea to pitch in a weekend: validation, MVP planning and pitching to a jury of founders.', 'Bootcamp', 27, 9, 600, 'Innovation Centre', 80, 1],
  ];
  EV.forEach(([slug, title, desc, cat, off, hr, mins, venue, cap, wl], i) => {
    const start = day(off, hr); const end = new Date(new Date(start).getTime() + mins * 60000).toISOString();
    const evId = Number(insEvent.run(clubId[slug], title, desc, cat, start, end, venue, day(off - 1, 23, 59), cap, wl, 'published', i % 6 === 5 ? 'pending' : 'approved').lastInsertRowid);
    TASKS.slice(0, 1 + (i % 3)).forEach(([role, d, so, need, hrs]) => {
      const ts = new Date(new Date(start).getTime() + so * 3600000).toISOString();
      insTask.run(evId, role, d, ts, new Date(new Date(ts).getTime() + hrs * 3600000).toISOString(), need, hrs);
    });
  });
  // A draft for the Coding Club President to publish.
  insEvent.run(clubId['coding-club'], 'Intro to Cybersecurity Workshop', 'Learn the fundamentals of network security, OWASP Top 10 and hands-on with Burp Suite.', 'Workshop', day(35, 14), day(35, 17), 'ISE Lab 1', day(34, 23, 59), 60, 1, 'draft', 'pending');

  const insN = db.prepare('INSERT INTO notifications (user_id,title,body,link) VALUES (?,?,?,?)');
  insN.run(uid.student, 'Welcome to ClubHub! 🎉', 'Explore clubs, register for events and start collecting certificates.', '/clubs');
  insN.run(uid.president, 'Your club console is ready', 'Publish the draft "Intro to Cybersecurity Workshop" and set up your divisions and roles.', `/manage/${clubId['coding-club']}`);
  insN.run(uid.captain, 'Your club console is ready', 'Review recruitment stages and divisions for Team Antariksh.', `/manage/${clubId['team-antariksh']}/settings`);
  insN.run(uid.college, 'Events awaiting approval', 'Some club events are waiting for approval from Student Affairs.', '/college');
  db.exec('COMMIT');
  return db;
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed({ reset: process.argv.includes('--reset') });
  console.log('Database seeded at', DB_PATH);
  for (const a of ACCOUNTS) console.log(`  ${a.name.padEnd(24)} ${a.email.padEnd(36)} ${a.password}`);
}
