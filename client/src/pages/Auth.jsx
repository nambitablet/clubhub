import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, Rocket, Settings2, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { BRANCHES } from '../ui.jsx';
import { useAuth } from '../App.jsx';

function Shell({ title, sub, children }) {
  return (
    <div className="container page" style={{ display: 'grid', placeItems: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: 460, padding: 'clamp(22px, 5vw, 36px)', boxShadow: 'var(--sh-2)' }}>
        <h1 style={{ fontSize: 28 }}>{title}</h1>
        <p className="muted mt-8 mb-24">{sub}</p>
        {children}
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (creds) => {
    setBusy(true); setErr('');
    try {
      const r = await api('/auth/login', { method: 'POST', body: { email: creds.email, password: creds.password } }); await login(r.token);
      nav(sp.get('next') || creds.to || (r.user.platform_role === 'college_admin' ? '/college' : '/me'));
    }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Shell title="Welcome back" sub="Sign in to register for events, track applications and get certificates.">
      <form className="col" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); go(f); }}>
        <label className="field"><span>Email</span><input className="input" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@rvce.edu.in" /></label>
        <label className="field"><span>Password</span><input className="input" type="password" required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        {err && <div className="error-box">{err}</div>}
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <div className="mt-24" style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}>
        <p className="xs muted bold mb-16" style={{ letterSpacing: '.08em' }}>ONE-CLICK DEMO ACCOUNTS</p>
        <div className="col" style={{ gap: 8 }}>
          {[
            [ShieldCheck, 'College Administrator', 'Approves events · registers clubs', 'collegeadmin@rvce.edu.in', 'Admin@2026', '/college'],
            [Settings2, 'Coding Club President', 'Full control of Coding Club', 'president.codingclub@rvce.edu.in', 'Coding@2026', '/manage'],
            [Rocket, 'Team Antariksh Captain', 'Full control of Team Antariksh', 'captain.antariksh@rvce.edu.in', 'Antariksh@2026', '/manage'],
            [GraduationCap, 'Student', 'Browse, apply, register, volunteer', 'student@rvce.edu.in', 'Student@2026', '/clubs'],
          ].map(([I, t, d, email, password, to]) => (
            <button key={email} className="btn btn-ghost" style={{ height: 'auto', padding: '10px 12px', justifyContent: 'flex-start', textAlign: 'left' }} disabled={busy} onClick={() => go({ email, password, to })}>
              <I size={18} /><span className="grow"><b className="small" style={{ display: 'block' }}>{t}</b><span className="xs muted" style={{ fontWeight: 400 }}>{d}</span></span>
            </button>
          ))}
        </div>
      </div>
      <p className="center small muted mt-24">New here? <Link className="link" to={`/signup${sp.get('next') ? `?next=${encodeURIComponent(sp.get('next'))}` : ''}`}>Create a free account</Link></p>
    </Shell>
  );
}

export function Signup() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [f, setF] = useState({ name: '', email: '', password: '', usn: '', branch: '', year: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const r = await api('/auth/signup', { method: 'POST', body: f }); await login(r.token); nav(sp.get('next') || '/clubs'); } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <Shell title="Join ClubHub" sub="Free for every RVCE student. Takes 30 seconds.">
      <form className="form-grid" onSubmit={submit}>
        <label className="field full"><span>Full name</span><input className="input" required value={f.name} onChange={set('name')} /></label>
        <label className="field full"><span>College email</span><input className="input" type="email" required value={f.email} onChange={set('email')} placeholder="you@rvce.edu.in" /></label>
        <label className="field full"><span>Password</span><input className="input" type="password" required minLength={6} autoComplete="new-password" value={f.password} onChange={set('password')} /><small>At least 6 characters</small></label>
        <label className="field"><span>USN</span><input className="input" value={f.usn} onChange={set('usn')} placeholder="1RV24CS001" /></label>
        <label className="field"><span>Year</span><select className="select" value={f.year} onChange={set('year')}><option value="">—</option>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></label>
        <label className="field full"><span>Branch</span><select className="select" value={f.branch} onChange={set('branch')}><option value="">Select branch</option>{Object.entries(BRANCHES).map(([k, v]) => <option key={k} value={k}>{v} ({k})</option>)}</select></label>
        {err && <div className="error-box full">{err}</div>}
        <button className="btn btn-primary btn-lg full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="center small muted mt-24">Already have an account? <Link className="link" to="/login">Sign in</Link></p>
    </Shell>
  );
}
