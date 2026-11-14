import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Bell, CalendarDays, ChevronDown, Compass, LayoutDashboard, LogOut, Menu, ShieldCheck, Settings2, UserRound, BadgeCheck, Building2 } from 'lucide-react';
import { api, setToken, getToken } from './api.js';
import { Avatar, ClubLogo, relTime, Spinner } from './ui.jsx';
import Home from './pages/Home.jsx';
import Clubs from './pages/Clubs.jsx';
import ClubDetail from './pages/ClubDetail.jsx';
import Events from './pages/Events.jsx';
import EventDetail from './pages/EventDetail.jsx';
import { Login, Signup } from './pages/Auth.jsx';
import MySpace from './pages/MySpace.jsx';
import Verify from './pages/Verify.jsx';
import Manage from './pages/manage/Manage.jsx';
import CollegeAdmin from './pages/CollegeAdmin.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function App() {
  const [me, setMe] = useState({ user: null, managed: [], unread: 0, ready: false });
  const refresh = useCallback(async () => {
    if (!getToken()) return setMe({ user: null, managed: [], unread: 0, ready: true });
    try { const d = await api('/me'); setMe({ ...d, ready: true }); if (!d.user) setToken(null); } catch { setMe({ user: null, managed: [], unread: 0, ready: true }); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const login = async (token) => { setToken(token); await refresh(); };
  const logout = async () => { try { await api('/auth/logout', { method: 'POST' }); } catch {} setToken(null); setMe({ user: null, managed: [], unread: 0, ready: true }); };
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  if (!me.ready) return <Spinner />;
  const inConsole = loc.pathname.startsWith('/manage');
  return (
    <AuthCtx.Provider value={{ ...me, refresh, login, logout }}>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/clubs" element={<Clubs />} />
        <Route path="/clubs/:slug" element={<ClubDetail />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/verify/:code" element={<Verify />} />
        <Route path="/me" element={<RequireAuth><MySpace /></RequireAuth>} />
        <Route path="/manage/*" element={<RequireAuth><Manage /></RequireAuth>} />
        <Route path="/college" element={<RequireAuth><CollegeAdmin /></RequireAuth>} />
        <Route path="*" element={<div className="container page"><h1>Page not found</h1><p className="muted mt-8">That page does not exist. <Link className="link" to="/">Go home</Link></p></div>} />
      </Routes>
      {!inConsole && <Footer />}
    </AuthCtx.Provider>
  );
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return children;
}

function useClickAway(open, setOpen) {
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, setOpen]);
  return ref;
}

function Nav() {
  const { user, managed, unread, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const [mob, setMob] = useState(false);
  const ref = useClickAway(menu, setMenu);
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => { setMenu(false); setMob(false); }, [loc.pathname]);
  return (
    <header className="nav">
      <div className="container nav-inner">
        <button className="icon-btn mobile-toggle" onClick={() => setMob(!mob)} aria-label="Menu"><Menu size={18} /></button>
        <Link to="/" className="brand">
          <span className="brand-mark"><svg width="20" height="20" viewBox="0 0 64 64"><path d="M14 36a18 18 0 0 1 36 0" stroke="white" strokeWidth="7" fill="none" strokeLinecap="round" /><circle cx="32" cy="44" r="7" fill="#fbbf24" /></svg></span>
          <span>ClubHub<small>RV College of Engineering</small></span>
        </Link>
        <nav className={`nav-links ${mob ? 'open' : ''}`}>
          <NavLink to="/clubs"><Compass size={16} />Clubs</NavLink>
          <NavLink to="/events"><CalendarDays size={16} />Events</NavLink>
          <NavLink to="/verify"><BadgeCheck size={16} />Verify certificate</NavLink>
          {user && <NavLink to="/me"><LayoutDashboard size={16} />My Space</NavLink>}
          {managed?.length > 0 && <NavLink to="/manage"><Settings2 size={16} />Manage</NavLink>}
          {user?.platform_role === 'college_admin' && <NavLink to="/college"><Building2 size={16} />College</NavLink>}
        </nav>
        <div className="nav-right">
          {user ? (
            <>
              <Notifications unread={unread} />
              <div style={{ position: 'relative' }} ref={ref}>
                <button className="row" style={{ border: 0, background: 'none', cursor: 'pointer', gap: 8, padding: 0 }} onClick={() => setMenu(!menu)} aria-label="Account menu">
                  <Avatar name={user.name} /><ChevronDown size={16} className="muted hide-sm" />
                </button>
                {menu && (
                  <div className="menu">
                    <div className="menu-head row"><Avatar name={user.name} /><div className="grow"><b className="small" style={{ display: 'block' }}>{user.name}</b><span className="xs muted">{user.usn || user.email}</span></div></div>
                    <hr />
                    <Link to="/me"><LayoutDashboard size={16} />My Space</Link>
                    <Link to="/me?tab=profile"><UserRound size={16} />Profile</Link>
                    {managed?.length > 0 && <><hr /><div className="xs muted" style={{ padding: '4px 10px' }}>CLUBS YOU MANAGE</div>
                      {managed.slice(0, 5).map((c) => <Link key={c.id} to={`/manage/${c.id}`}><ClubLogo club={c} size="xs" />{c.name}</Link>)}</>}
                    {user.platform_role === 'college_admin' && <Link to="/college"><ShieldCheck size={16} />College admin</Link>}
                    <hr />
                    <button onClick={async () => { await logout(); nav('/'); }}><LogOut size={16} />Sign out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm hide-sm">Sign in</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">Join ClubHub</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Notifications({ unread }) {
  const { refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const ref = useClickAway(open, setOpen);
  const toggle = async () => {
    const o = !open; setOpen(o);
    if (o) { setItems(await api('/notifications')); if (unread) { await api('/notifications/read', { method: 'POST' }); refresh(); } }
  };
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="icon-btn" onClick={toggle} aria-label="Notifications"><Bell size={18} />{unread > 0 && <span className="dot">{unread}</span>}</button>
      {open && (
        <div className="menu" style={{ width: 360, maxWidth: 'calc(100vw - 32px)', right: -50, padding: 0 }}>
          <div className="card-head"><h3>Notifications</h3><span className="xs muted">In-app alerts</span></div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {!items ? <Spinner /> : items.length === 0 ? <p className="muted small center" style={{ padding: 30 }}>You're all caught up ✨</p> : items.map((n) => (
              <Link key={n.id} to={n.link || '#'} onClick={() => setOpen(false)} style={{ display: 'block', padding: '12px 16px', borderBottom: '1px solid var(--line-2)', borderRadius: 0, background: n.read ? '' : '#f6f7ff' }}>
                <b className="small" style={{ display: 'block', color: 'var(--ink)' }}>{n.title}</b>
                {n.body && <span className="xs ink2" style={{ display: 'block', marginTop: 2 }}>{n.body}</span>}
                <span className="xs muted">{relTime(n.created_at.includes('T') ? n.created_at : n.created_at.replace(' ', 'T') + 'Z')}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="cols">
          <div>
            <div className="brand" style={{ color: '#fff' }}><span className="brand-mark"><svg width="20" height="20" viewBox="0 0 64 64"><path d="M14 36a18 18 0 0 1 36 0" stroke="white" strokeWidth="7" fill="none" strokeLinecap="round" /><circle cx="32" cy="44" r="7" fill="#fbbf24" /></svg></span>ClubHub</div>
            <p className="mt-16" style={{ maxWidth: 340 }}>One place for RVCE's student clubs to run events, memberships, volunteers, attendance and certificates.</p>
          </div>
          <div><h4>Explore</h4><div className="col" style={{ gap: 8 }}><Link to="/clubs">All clubs</Link><Link to="/events">Upcoming events</Link><Link to="/events?when=past">Past events</Link></div></div>
          <div><h4>Students</h4><div className="col" style={{ gap: 8 }}><Link to="/me">My Space</Link><Link to="/me?tab=certificates">Certificates</Link><Link to="/verify">Verify a certificate</Link></div></div>
          <div><h4>Campus</h4><div className="col" style={{ gap: 8 }}><span>RV College of Engineering</span><span>Mysuru Road, Bengaluru 560059</span><a href="https://rvce.edu.in/innovative_teams" target="_blank" rel="noreferrer">Innovative Teams ↗</a></div></div>
        </div>
        <div className="base"><span>© 2026 ClubHub · Student project prototype. Events shown are sample data.</span><span>Free for every student and club.</span></div>
      </div>
    </footer>
  );
}
