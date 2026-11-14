# ClubHub — Event, Membership & Volunteer Management for RVCE Clubs

A working prototype for RV College of Engineering's innovative teams. All 20 teams listed at
<https://rvce.edu.in/innovative_teams> are included. Each one has its own colours, divisions, role hierarchy and recruitment pipeline.
Events are **sample data**; no real or fictional students are pre-loaded.

## Run it

Requires Node.js 24 (uses the built-in `node:sqlite`, so there are no native modules to compile).

```bash
npm install
npm run build      # builds the React frontend into dist/
npm start          # http://localhost:4000
```

- `npm run dev` runs the API (port 4000) with hot-reload Vite (port 5173).
- `npm run seed` resets the database to fresh sample data (`data/clubhub.db`).

### Login accounts

The database starts with **no sample people**: just the 20 clubs, some upcoming sample events and these four accounts, one per position. The login page also has one-click buttons for them.

| Position | Email | Password | Can do |
|---|---|---|---|
| College Administrator | `collegeadmin@rvce.edu.in` | `Admin@2026` | Approve events, register new clubs, open any club's console |
| Coding Club President | `president.codingclub@rvce.edu.in` | `Coding@2026` | Full control of Coding Club: profile, structure, members, events, attendance, volunteers, certificates |
| Team Antariksh Captain | `captain.antariksh@rvce.edu.in` | `Antariksh@2026` | Full control of Team Antariksh |
| Student | `student@rvce.edu.in` | `Student@2026` | Browse clubs, apply, register for events, volunteer, download certificates |

New students can create their own accounts with **Join ClubHub**.

## Deploying to Vercel

The repo is ready for Vercel with no extra settings: `vercel.json` builds the React app into `dist/` and serves the Express API as one serverless function (`api/index.js`).

1. At [vercel.com/new](https://vercel.com/new), import this GitHub repository.
2. Optional but recommended: add an environment variable `SESSION_SECRET` with any long random string. It signs login tokens.
3. Click **Deploy**.

**Prototype limitation:** on Vercel the SQLite database lives in temporary storage (`/tmp`). It is recreated from the seed whenever a new server instance starts, so registrations, applications and certificates made on the live site are not permanent. The four login accounts always work. For permanent data, move the database to a hosted service such as Turso or Postgres.

## Feature map

| Spec | Where |
|---|---|
| Accounts, roles, profiles | Sign-up/login, My Space → Profile, role-based access on every API |
| Club profiles & membership | `/clubs`, `/clubs/:slug`, Manage → Profile & structure |
| **Custom divisions & people structure** | Manage → Profile & structure: add, rename and reorder divisions; define roles with levels and fine-grained permissions (club settings, members, events, attendance, volunteers, certificates) |
| **Selection tests & interviews** | Each club defines its own recruitment stages (e.g. Application → Coding Test → Interview → Selected). Admins work through a kanban: schedule each round, add scores and messages; students follow a stepper and get notified |
| Event management | Create, draft, publish, edit, cancel and restore; search and filter by club, category, date and keyword; seats left; auto-close on deadline or capacity |
| Registration + waitlist | Name/USN/branch/year form, cancel, waitlist with position and automatic promotion |
| Attendance | Present/absent toggles, bulk "mark unmarked absent", CSV export |
| QR check-in | Each registration gets a QR ticket; the Check-in desk scans with the phone camera (html5-qrcode) or accepts a typed ticket/USN |
| Club attendance | Meetings (whole club or one division) with attendance; members see their own % in My Space |
| Volunteers | Tasks with slot, headcount and hours; students sign up; admins confirm, assign members, mark completed or no-show, and edit hours |
| Certificates | One-click generation for attendees and completed volunteers; PDF with club colours, unique ID and a verification QR; revoke/restore |
| Verification | `/verify/:id` is public (USN partly masked) |
| Dashboards & reports | Club dashboard (attendance rate, pipeline, divisions, volunteers, charts); CSV reports for events, members and volunteers |

### Limitations from section 15, and how far they are addressed

- **No email** → In-app notifications (bell icon) for each stage change, waitlist promotion, cancellation, volunteer assignment and certificate.
- **QR depends on camera** → The camera scanner is built in, and typing the ticket code or USN always works as a fallback.
- **Certificates depend on accurate attendance** → Eligibility is computed from attendance and volunteer records, the console shows pending counts, and wrongly issued certificates can be revoked (verification then shows "revoked").
- **No official college approval** → A college-admin role with an approval queue. Events show "College approved" or "Approval pending" badges.
- **Calendar** → Every event has an "Add to calendar" `.ics` download with a 2-hour reminder.

## Stack

React 18 + Vite · Express · SQLite (`node:sqlite`) · PDFKit · qrcode · lucide-react icons
