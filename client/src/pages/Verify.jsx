import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { BadgeCheck, ShieldX, Search, ShieldAlert } from 'lucide-react';
import { api } from '../api.js';
import { ClubLogo, clubVars, fmtDate, Spinner } from '../ui.jsx';

export default function Verify() {
  const { code } = useParams();
  const nav = useNavigate();
  const [input, setInput] = useState(code || '');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!code) { setRes(null); return; }
    setInput(code); setBusy(true);
    api(`/verify/${encodeURIComponent(code)}`).then(setRes).catch(() => setRes({ valid: false })).finally(() => setBusy(false));
  }, [code]);
  const c = res?.certificate;
  return (
    <div className="container page" style={{ maxWidth: 760 }}>
      <div className="center mb-24">
        <div className="club-logo lg" style={{ margin: '0 auto 18px', '--c1': '#059669', '--c2': '#0891b2' }}><BadgeCheck size={38} /></div>
        <h1>Verify a certificate</h1>
        <p className="muted mt-8">Enter the certificate ID printed on any ClubHub certificate, or scan its QR code.</p>
      </div>
      <form className="hero-search" style={{ margin: '0 auto', boxShadow: 'var(--sh-2)', border: '1px solid var(--line)' }} onSubmit={(e) => { e.preventDefault(); input.trim() && nav(`/verify/${input.trim().toUpperCase()}`); }}>
        <Search size={20} color="#94a3b8" style={{ alignSelf: 'center', marginLeft: 8 }} />
        <input className="mono" value={input} onChange={(e) => setInput(e.target.value)} placeholder="RVCE-XXXX-XXXX" aria-label="Certificate ID" />
        <button className="btn btn-primary">Verify</button>
      </form>
      <div className="mt-32">
        {busy ? <Spinner /> : res && (res.valid ? (
          <div className="card" style={{ ...clubVars(c), overflow: 'hidden' }}>
            <div style={{ background: 'var(--ok-soft)', padding: '16px 22px', display: 'flex', gap: 12, alignItems: 'center', color: 'var(--ok)' }}>
              <BadgeCheck size={26} /><div><b style={{ fontSize: 16 }}>Authentic certificate</b><div className="small" style={{ color: '#065f46' }}>Issued through ClubHub and currently valid.</div></div>
            </div>
            <div className="card-pad">
              <div className="info-list">
                <div><div className="ii"><BadgeCheck size={17} /></div><div><span>Awarded to</span><b style={{ fontSize: 18 }}>{c.student_name}</b>{c.usn && <span className="mono">{c.usn}</span>}</div></div>
                <div><div className="ii"><ClubLogo club={c} size="xs" /></div><div><span>{c.type === 'volunteer' ? `Volunteer certificate${c.detail ? ' · ' + c.detail : ''}${c.hours ? ` · ${c.hours} hrs` : ''}` : 'Certificate of participation'}</span><b>{c.event_title}</b><span>{c.club_name} · {fmtDate(c.start_at, { weekday: 'long' })}</span></div></div>
                <div><div className="ii mono" style={{ fontSize: 11 }}>ID</div><div><span>Certificate ID · issued {fmtDate(c.issued_at)}</span><b className="mono">{c.code}</b></div></div>
              </div>
              <Link to={`/events/${c.event_id}`} className="btn btn-ghost btn-sm mt-16">View event</Link>
            </div>
          </div>
        ) : res.revoked ? (
          <div className="notice warn"><ShieldAlert size={22} /><div><b>This certificate has been revoked</b><br />The issuing club withdrew it. Contact the club for details.</div></div>
        ) : (
          <div className="notice bad"><ShieldX size={22} /><div><b>No certificate found with this ID</b><br />Check for typos — IDs look like <span className="mono">RVCE-AB12-CD34</span>.</div></div>
        ))}
      </div>
    </div>
  );
}
