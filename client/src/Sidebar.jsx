import { useState } from 'react';
import { CATEGORIES, labelOf } from './constants';

function ReportForm({ busy, onSubmit, onCancel }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'pothole', severity: 'medium' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form className="panel" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <h2>Report a hazard at this spot</h2>
      <label>What is it?
        <input value={form.title} onChange={set('title')} placeholder="Deep pothole near the crossing" minLength={3} maxLength={100} required />
      </label>
      <label>Type
        <select value={form.category} onChange={set('category')}>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>How bad is it?
        <select value={form.severity} onChange={set('severity')}>
          <option value="low">Low: a nuisance</option>
          <option value="medium">Medium: slows people down</option>
          <option value="high">High: unsafe</option>
        </select>
      </label>
      <label>Details (optional)
        <textarea value={form.description} onChange={set('description')} maxLength={500} rows={3} />
      </label>
      <div className="row">
        <button disabled={busy}>{busy ? 'Saving...' : 'Submit report'}</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function Sidebar({ online, category, setCategory, count, picked, busy, nearby, onSubmit, onCancel, onNearMe, onSelectNearby }) {
  return (
    <aside className="sidebar">
      <header>
        <h1>Civic Hazard Tracker</h1>
        <p className="meta">{online} {online === 1 ? 'person' : 'people'} watching live</p>
      </header>

      <div className="panel">
        <label>Show
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All hazard types</option>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <p className="meta">{count} open {count === 1 ? 'hazard' : 'hazards'} in this map view</p>
        <div className="legend">
          <span><i className="pin low" />Low</span><span><i className="pin medium" />Medium</span><span><i className="pin high" />High</span>
        </div>
      </div>

      {picked ? (
        <ReportForm key={`${picked.lat}${picked.lng}`} busy={busy} onSubmit={onSubmit} onCancel={onCancel} />
      ) : (
        <div className="panel hint">Click anywhere on the map to report a hazard at that spot.</div>
      )}

      <div className="panel">
        <button onClick={onNearMe}>Find hazards near me</button>
        {nearby && (nearby.length === 0
          ? <p className="meta">No open hazards within 1 km of you.</p>
          : <ul className="nearby">
              {nearby.map((r) => (
                <li key={r._id}>
                  <button className="link" onClick={() => onSelectNearby(r)}>{r.title}</button>
                  <span className="meta">{labelOf(r.category)}, {r.distance} m away</span>
                </li>
              ))}
            </ul>)}
      </div>
    </aside>
  );
}