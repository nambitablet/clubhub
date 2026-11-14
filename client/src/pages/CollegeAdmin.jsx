import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Plus, Building2, CheckCircle2 } from 'lucide-react';
import { api } from '../api.js';
import { ClubLogo, clubVars, Empty, fmtDT, Modal, Spinner, useAsync, useToast } from '../ui.jsx';
import { useAuth } from '../App.jsx';

export default function CollegeAdmin() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const { data, reload } = useAsync(() => api('/admin/overview'), []);
  const [creating, setCreating] = useState(false);
  if (user.platform_role !== 'college_admin') return <div className="container page"><Empty icon={ShieldCheck} title="College administrators only" /></div>;
  if (!data) return <Spinner />;
  const approve = async (e) => { await api(`/manage/events/${e.id}/status`, { method: 'POST', body: { approval: 'approved' } }); toast(`Approved “${e.title}”`); reload(); };
  return (
    <div className="container page">
      <div className="row between wrap mb-24" style={{ alignItems: 'end' }}>
        <div><div className="kicker">Office of Student Affairs</div><h1>College administration</h1><p className="muted mt-8">Approve club events and oversee every club on campus.</p></div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} />Register new club</button>
      </div>
      <div className="card mb-24">
        <div className="card-head"><h3 className="row"><ShieldCheck size={18} />Events awaiting approval</h3><span className="badge warn">{data.pending.length}</span></div>
        {data.pending.length === 0 ? <p className="muted small" style={{ padding: 20 }}>Everything is approved. 🎉</p> : data.pending.map((e) => (
          <div key={e.id} className="list-row" style={clubVars(e.club)}>
            <ClubLogo club={e.club} size="sm" />
            <div className="grow"><Link to={`/events/${e.id}`} className="bold">{e.title}</Link><div className="xs muted">{e.club.name} · {fmtDT(e.start_at)} · {e.venue} · cap. {e.capacity}</div></div>
            <span className="badge">{e.status}</span>
            <button className="btn btn-ok btn-sm" onClick={() => approve(e)}><CheckCircle2 size={15} />Approve</button>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-head"><h3 className="row"><Building2 size={18} />All clubs</h3><span className="badge">{data.clubs.length}</span></div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Club</th><th>Category</th><th>Members</th><th>Events</th><th>Participants</th><th /></tr></thead>
          <tbody>{data.clubs.map((c) => (
            <tr key={c.id}><td><div className="person"><ClubLogo club={c} size="xs" /><b>{c.name}</b></div></td><td className="small">{c.category}</td><td>{c.members}</td><td>{c.events}</td><td>{c.attended}</td>
              <td className="nowrap"><Link to={`/manage/${c.id}`} className="btn btn-ghost btn-sm">Console</Link></td></tr>
          ))}</tbody>
        </table></div>
      </div>
      {creating && <NewClub onClose={() => setCreating(false)} onDone={() => { setCreating(false); toast('Club created'); reload(); refresh(); }} />}
    </div>
  );
}

function NewClub({ onClose, onDone }) {
  const [f, setF] = useState({ name: '', category: 'Computing', lead_email: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => { try { await api('/admin/clubs', { method: 'POST', body: f }); onDone(); } catch (e) { setErr(e.message); } };
  return (
    <Modal title="Register a new club" sub="The club lead becomes President and can customise divisions, roles and recruitment." onClose={onClose}
      foot={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Create club</button></>}>
      <div className="col" style={{ gap: 14 }}>
        <label className="field"><span>Club name</span><input className="input" value={f.name} onChange={set('name')} /></label>
        <label className="field"><span>Category</span><input className="input" value={f.category} onChange={set('category')} /></label>
        <label className="field"><span>Club lead's ClubHub email (optional)</span><input className="input" value={f.lead_email} onChange={set('lead_email')} placeholder="student@rvce.edu.in" /></label>
        {err && <div className="error-box">{err}</div>}
      </div>
    </Modal>
  );
}
