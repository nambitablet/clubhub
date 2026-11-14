import { useEffect, useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Save, Layers, Shield, ListOrdered, Info } from 'lucide-react';
import { api } from '../../api.js';
import { ClubLogo, ICONS, Spinner, useAsync, useToast } from '../../ui.jsx';
import { useAuth } from '../../App.jsx';
import { ConsoleHead } from './Manage.jsx';

const PERMS = [['club', 'Club settings'], ['members', 'Members & recruitment'], ['events', 'Events'], ['attendance', 'Attendance'], ['volunteers', 'Volunteers'], ['certificates', 'Certificates']];
const CATS = ['Motorsports', 'Aerospace', 'Robotics', 'Computing', 'Science & Research', 'Communication', 'Innovation & Entrepreneurship', 'Social Impact', 'Cultural', 'Sports'];

export default function Settings({ clubId }) {
  const [tab, setTab] = useState('profile');
  return (
    <>
      <ConsoleHead title="Profile & structure" sub="Every club is different — set up your own divisions, role hierarchy, permissions and recruitment stages." />
      <div className="tabs">{[['profile', 'Club profile'], ['structure', 'Divisions, roles & recruitment']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'profile' ? <Profile clubId={clubId} /> : <Structure clubId={clubId} />}
    </>
  );
}

function Profile({ clubId }) {
  const toast = useToast();
  const { refresh } = useAuth();
  const { data } = useAsync(() => api(`/manage/${clubId}/overview`), [clubId]);
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { if (data) setF({ ...data.club, milestones: data.club.milestones.join('\n') }); }, [data]);
  if (!f) return <Spinner />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async () => { setErr(''); try { await api(`/manage/${clubId}/profile`, { method: 'PUT', body: { ...f, milestones: f.milestones.split('\n') } }); toast('Club profile saved'); refresh(); } catch (e) { setErr(e.message); } };
  return (
    <div className="split">
      <div className="card card-pad">
        <div className="form-grid">
          <label className="field"><span>Club name</span><input className="input" value={f.name} onChange={set('name')} /></label>
          <label className="field"><span>Category</span><select className="select" value={f.category || ''} onChange={set('category')}>{[...new Set([f.category, ...CATS])].filter(Boolean).map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field full"><span>Tagline</span><input className="input" value={f.tagline || ''} onChange={set('tagline')} /></label>
          <label className="field full"><span>Description</span><textarea className="textarea" style={{ minHeight: 130 }} value={f.description || ''} onChange={set('description')} /></label>
          <label className="field full"><span>Milestones</span><textarea className="textarea" value={f.milestones} onChange={set('milestones')} /><small>One per line</small></label>
          <label className="field"><span>Founded</span><input type="number" className="input" value={f.founded || ''} onChange={set('founded')} /></label>
          <label className="field"><span>Email</span><input className="input" value={f.email || ''} onChange={set('email')} /></label>
          <label className="field"><span>Instagram</span><input className="input" value={f.instagram || ''} onChange={set('instagram')} /></label>
          <label className="field"><span>Website</span><input className="input" value={f.website || ''} onChange={set('website')} /></label>
          <label className="field full"><span>Recruitment note</span><textarea className="textarea" style={{ minHeight: 70 }} value={f.recruitment_note || ''} onChange={set('recruitment_note')} placeholder="Eligibility, syllabus for the test, timeline…" /></label>
          <label className="check full"><span className="switch"><input type="checkbox" checked={!!f.recruitment_open} onChange={set('recruitment_open')} /><span /></span>Accepting new applications</label>
          {err && <div className="error-box full">{err}</div>}
        </div>
        <div className="row mt-24"><button className="btn btn-brand" onClick={save}><Save size={16} />Save profile</button></div>
      </div>
      <div className="col sticky" style={{ gap: 16 }}>
        <div className="card card-pad">
          <h3 className="mb-16">Branding</h3>
          <div className="row mb-16"><ClubLogo club={f} size="lg" /><div><b>{f.name}</b><div className="xs muted">{f.tagline}</div></div></div>
          <div className="row mb-16"><input type="color" className="color-swatch" value={f.color} onChange={set('color')} aria-label="Primary colour" /><input type="color" className="color-swatch" value={f.color2} onChange={set('color2')} aria-label="Secondary colour" /><span className="small muted">Club colours theme your pages, events and certificates.</span></div>
          <p className="field"><span>Icon</span></p>
          <div className="icon-pick mt-8">{Object.entries(ICONS).map(([k, I]) => <button key={k} type="button" className={f.icon === k ? 'on' : ''} onClick={() => setF({ ...f, icon: k })} aria-label={k}><I size={18} /></button>)}</div>
        </div>
      </div>
    </div>
  );
}

function move(arr, i, d) { const a = [...arr]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; }

function Structure({ clubId }) {
  const toast = useToast();
  const { refresh } = useAuth();
  const { data, reload } = useAsync(() => api(`/manage/${clubId}/structure`), [clubId]);
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { if (data) setS({ divisions: data.divisions, roles: data.roles.map((r) => ({ ...r, perms: r.perms ? r.perms.split(',') : [] })), stages: data.stages }); }, [data]);
  if (!s) return <Spinner />;
  const upd = (k, i, patch) => setS({ ...s, [k]: s[k].map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const save = async () => {
    setErr('');
    try { const r = await api(`/manage/${clubId}/structure`, { method: 'PUT', body: s }); toast(r.warning || 'Structure saved', r.warning ? 'bad' : 'ok'); reload(); refresh(); } catch (e) { setErr(e.message); }
  };
  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="notice"><Info size={18} /><div>Changes apply when you press <b>Save structure</b>. Deleting a role moves its members to the lowest remaining role; deleting a division clears it from members.</div></div>
      <div className="grid g-2" style={{ alignItems: 'start' }}>
        <div className="card card-pad">
          <div className="row between mb-16"><h3 className="row"><Layers size={18} />Divisions</h3><button className="btn btn-ghost btn-sm" onClick={() => setS({ ...s, divisions: [...s.divisions, { name: '' }] })}><Plus size={14} />Add</button></div>
          <div className="editable-list">
            {s.divisions.map((d, i) => (
              <div key={d.id || `n${i}`} className="editable-item">
                <div className="handle"><button onClick={() => setS({ ...s, divisions: move(s.divisions, i, -1) })} aria-label="Move up"><ChevronUp size={14} /></button><button onClick={() => setS({ ...s, divisions: move(s.divisions, i, 1) })} aria-label="Move down"><ChevronDown size={14} /></button></div>
                <div className="grow col" style={{ gap: 4 }}>
                  <input className="input" style={{ height: 34 }} value={d.name} onChange={(e) => upd('divisions', i, { name: e.target.value })} placeholder="Division name" />
                  <input className="input" style={{ height: 30, fontSize: 13 }} value={d.description || ''} onChange={(e) => upd('divisions', i, { description: e.target.value })} placeholder="Short description (optional)" />
                </div>
                {d.members > 0 && <span className="badge">{d.members}</span>}
                <button className="btn btn-ghost btn-sm" onClick={() => setS({ ...s, divisions: s.divisions.filter((_, j) => j !== i) })} aria-label="Delete division"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <div className="row between mb-16"><h3 className="row"><ListOrdered size={18} />Recruitment stages</h3><button className="btn btn-ghost btn-sm" onClick={() => setS({ ...s, stages: [...s.stages.slice(0, -1), 'New stage', s.stages[s.stages.length - 1]] })}><Plus size={14} />Add stage</button></div>
          <div className="editable-list">
            {s.stages.map((st, i) => (
              <div key={i} className="editable-item">
                <span className="badge" style={{ minWidth: 28, justifyContent: 'center' }}>{i + 1}</span>
                <input className="input grow" style={{ height: 34 }} value={st} onChange={(e) => setS({ ...s, stages: s.stages.map((x, j) => (j === i ? e.target.value : x)) })} />
                <button className="btn btn-ghost btn-sm" disabled={s.stages.length <= 2} onClick={() => setS({ ...s, stages: s.stages.filter((_, j) => j !== i) })} aria-label="Delete stage"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <p className="xs muted mt-16">First stage is the application, last stage means selected. Typical: Application → Written Test → Interview → Selected.</p>
        </div>
      </div>
      <div className="card card-pad">
        <div className="row between mb-16"><h3 className="row"><Shield size={18} />Role hierarchy & permissions</h3><button className="btn btn-ghost btn-sm" onClick={() => setS({ ...s, roles: [...s.roles, { name: '', rank: (s.roles.at(-1)?.rank || 5) + 1, perms: [] }] })}><Plus size={14} />Add role</button></div>
        <p className="small muted mb-16">Level 1 is the top of the hierarchy. Roles at levels 1–4 appear on the public team page. Any role with a permission can open this console.</p>
        <div className="editable-list">
          {s.roles.map((r, i) => (
            <div key={r.id || `n${i}`} className="editable-item" style={{ flexWrap: 'wrap' }}>
              <label className="row xs muted" style={{ gap: 4 }}>Level<input type="number" min="1" max="20" className="input" style={{ width: 58, height: 34 }} value={r.rank} onChange={(e) => upd('roles', i, { rank: Number(e.target.value) })} /></label>
              <input className="input" style={{ height: 34, width: 200 }} value={r.name} onChange={(e) => upd('roles', i, { name: e.target.value })} placeholder="Role name" />
              <div className="perm-grid grow">{PERMS.map(([k, l]) => <span key={k} role="checkbox" aria-checked={r.perms.includes(k)} tabIndex={0} className={`perm ${r.perms.includes(k) ? 'on' : ''}`} onClick={() => upd('roles', i, { perms: r.perms.includes(k) ? r.perms.filter((x) => x !== k) : [...r.perms, k] })}>{l}</span>)}</div>
              {r.members > 0 && <span className="badge">{r.members} people</span>}
              <button className="btn btn-ghost btn-sm" onClick={() => setS({ ...s, roles: s.roles.filter((_, j) => j !== i) })} aria-label="Delete role"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
      {err && <div className="error-box">{err}</div>}
      <div className="row"><button className="btn btn-brand btn-lg" onClick={save}><Save size={17} />Save structure</button></div>
    </div>
  );
}
