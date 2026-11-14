import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CalendarDays, Pencil } from 'lucide-react';
import { api } from '../../api.js';
import { Empty, fmtDate, fmtTime, Modal, REG_STATE, Spinner, toLocalInput, useAsync, useToast } from '../../ui.jsx';
import { ApprovalBadge } from '../parts.jsx';
import { ConsoleHead } from './Manage.jsx';

export const EVENT_CATEGORIES = ['Workshop', 'Hackathon', 'Competition', 'Talk', 'Bootcamp', 'Conference', 'Outreach', 'Open House', 'Field Trip', 'Social', 'Recruitment'];

export default function EventsAdmin({ clubId }) {
  const { data, loading, reload } = useAsync(() => api(`/manage/${clubId}/overview`), [clubId]);
  const [edit, setEdit] = useState(null);
  const [filter, setFilter] = useState('upcoming');
  if (loading && !data) return <Spinner />;
  const now = new Date().toISOString();
  const list = data.events.filter((e) => filter === 'all' || (filter === 'drafts' ? e.status === 'draft' : filter === 'upcoming' ? e.end_at >= now && e.status !== 'draft' : e.end_at < now && e.status !== 'draft'));
  if (filter === 'upcoming') list.reverse();
  return (
    <>
      <ConsoleHead title="Events" sub="Create, publish and run your club's events.">
        <button className="btn btn-brand" onClick={() => setEdit({})}><Plus size={17} />New event</button>
      </ConsoleHead>
      <div className="seg mb-16">{[['upcoming', 'Upcoming'], ['drafts', `Drafts (${data.totals.drafts})`], ['past', 'Past'], ['all', 'All']].map(([k, l]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}</div>
      <div className="card">
        {list.length === 0 ? <Empty icon={CalendarDays} title="No events here" action={<button className="btn btn-primary" onClick={() => setEdit({})}><Plus size={16} />Create event</button>} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Event</th><th>Date</th><th>Status</th><th>Registrations</th><th>Attendance</th><th /></tr></thead>
            <tbody>{list.map((e) => (
              <tr key={e.id}>
                <td><Link to={`/manage/${clubId}/events/${e.id}`} className="bold">{e.title}</Link><div className="xs muted">{e.category} · {e.venue}</div></td>
                <td className="nowrap small">{fmtDate(e.start_at)}<div className="xs muted">{fmtTime(e.start_at)}</div></td>
                <td><div className="col" style={{ gap: 4, alignItems: 'flex-start' }}><span className={`badge ${REG_STATE[e.reg_state][1]}`}>{REG_STATE[e.reg_state][0]}</span>{e.status !== 'draft' && <ApprovalBadge e={e} />}</div></td>
                <td className="nowrap"><b>{e.registered}</b><span className="muted">/{e.capacity}</span>{e.waitlisted > 0 && <div className="xs muted">+{e.waitlisted} waitlist</div>}</td>
                <td className="nowrap">{e.present + e.absent ? <><b>{e.present}</b><span className="muted"> present</span></> : <span className="muted xs">—</span>}</td>
                <td className="nowrap"><button className="btn btn-ghost btn-sm" onClick={() => setEdit(e)} aria-label="Edit"><Pencil size={14} /></button> <Link to={`/manage/${clubId}/events/${e.id}`} className="btn btn-soft btn-sm">Open</Link></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {edit && <EventForm clubId={clubId} event={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </>
  );
}

export function EventForm({ clubId, event, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !event.id;
  const d0 = new Date(); d0.setDate(d0.getDate() + 14); d0.setHours(10, 0, 0, 0);
  const [f, setF] = useState({
    title: event.title || '', description: event.description || '', category: event.category || 'Workshop', venue: event.venue || '',
    start_at: toLocalInput(event.start_at || d0), end_at: toLocalInput(event.end_at || new Date(d0.getTime() + 3 * 3600000)),
    reg_deadline: toLocalInput(event.reg_deadline || new Date(d0.getTime() - 86400000)), capacity: event.capacity || 60,
    waitlist: event.waitlist ?? 1, members_only: event.members_only ?? 0,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value });
  const save = async (status) => {
    setBusy(true); setErr('');
    try {
      const body = { ...f, start_at: new Date(f.start_at).toISOString(), end_at: new Date(f.end_at).toISOString(), reg_deadline: f.reg_deadline ? new Date(f.reg_deadline).toISOString() : null, status };
      if (isNew) await api(`/manage/${clubId}/events`, { method: 'POST', body }); else await api(`/manage/events/${event.id}`, { method: 'PUT', body });
      toast(isNew ? (status === 'published' ? 'Event published 🚀' : 'Draft saved') : 'Event updated'); onSaved();
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal wide title={isNew ? 'Create event' : 'Edit event'} sub={isNew ? 'Save as a draft or publish straight away.' : 'Registered participants are notified if the time or venue changes.'} onClose={onClose}
      foot={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button>{isNew && <button className="btn btn-ghost" disabled={busy} onClick={() => save('draft')}>Save draft</button>}<button className="btn btn-brand" disabled={busy} onClick={() => save('published')}>{isNew ? 'Publish event' : 'Save changes'}</button></>}>
      <div className="form-grid">
        <label className="field full"><span>Title</span><input className="input" value={f.title} onChange={set('title')} placeholder="e.g. Intro to Rocketry" /></label>
        <label className="field full"><span>Description</span><textarea className="textarea" value={f.description} onChange={set('description')} placeholder="What will participants do and learn?" /></label>
        <label className="field"><span>Category</span><select className="select" value={f.category} onChange={set('category')}>{EVENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="field"><span>Venue</span><input className="input" value={f.venue} onChange={set('venue')} placeholder="e.g. CSE Seminar Hall" /></label>
        <label className="field"><span>Starts</span><input type="datetime-local" className="input" value={f.start_at} onChange={set('start_at')} /></label>
        <label className="field"><span>Ends</span><input type="datetime-local" className="input" value={f.end_at} onChange={set('end_at')} /></label>
        <label className="field"><span>Registration deadline</span><input type="datetime-local" className="input" value={f.reg_deadline} onChange={set('reg_deadline')} /></label>
        <label className="field"><span>Capacity</span><input type="number" min="1" className="input" value={f.capacity} onChange={set('capacity')} /></label>
        <label className="check"><input type="checkbox" checked={!!f.waitlist} onChange={set('waitlist')} />Enable waitlist when full</label>
        <label className="check"><input type="checkbox" checked={!!f.members_only} onChange={set('members_only')} />Club members only</label>
        {err && <div className="error-box full">{err}</div>}
      </div>
    </Modal>
  );
}
