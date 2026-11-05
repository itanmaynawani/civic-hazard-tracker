import { useCallback, useEffect, useRef, useState } from 'react';
import { api, socket } from './api';
import MapView from './MapView';
import Sidebar from './Sidebar';

export default function App() {
  const [reports, setReports] = useState([]);
  const [bbox, setBbox] = useState(null);
  const [category, setCategory] = useState('');
  const [picked, setPicked] = useState(null);
  const [nearby, setNearby] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [online, setOnline] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const categoryRef = useRef(category);
  categoryRef.current = category;

  const notify = useCallback((text) => {
    setToast(text);
    setTimeout(() => setToast(''), 5000);
  }, []);

  const upsert = useCallback((report) => {
    if (categoryRef.current && report.category !== categoryRef.current) return;
    setReports((prev) =>
      prev.some((r) => r._id === report._id) ? prev.map((r) => (r._id === report._id ? report : r)) : [report, ...prev]
    );
  }, []);
  const remove = useCallback((id) => setReports((prev) => prev.filter((r) => r._id !== id)), []);

  // Load only the reports inside the visible map area (debounced while panning)
  useEffect(() => {
    if (!bbox) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/reports', { params: { bbox, category: category || undefined, limit: 500 } });
        if (!cancelled) setReports(data.reports);
      } catch {
        if (!cancelled) notify('Could not load hazards. Check that the server is running.');
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [bbox, category, notify]);

  // Live updates from other people
  useEffect(() => {
    socket.on('report:created', upsert);
    socket.on('report:updated', upsert);
    socket.on('report:resolved', (r) => remove(r._id));
    socket.on('clients:count', setOnline);
    socket.connect();
    return () => { socket.off(); socket.disconnect(); };
  }, [upsert, remove]);

  const submit = async (form) => {
    setBusy(true);
    try {
      const { data } = await api.post('/api/reports', { ...form, lat: picked.lat, lng: picked.lng });
      upsert(data.report);
      setPicked(null);
      notify(data.duplicate
        ? 'Someone already reported this within 25 m, so your report was added as a confirmation.'
        : 'Report added. Thanks for flagging it.');
    } catch (err) {
      const d = err.response?.data;
      notify(d?.details?.[0]?.message || d?.error || 'Could not save the report. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const upvote = (id) =>
    api.patch(`/api/reports/${id}/upvote`).then(({ data }) => upsert(data.report)).catch(() => notify('Could not add your confirmation.'));
  const resolve = (id) =>
    api.patch(`/api/reports/${id}/resolve`).then(() => remove(id)).catch(() => notify('Could not mark this as fixed.'));

  const nearMe = () => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        setFlyTarget({ lat, lng, zoom: 15 });
        api.get('/api/reports/nearby', { params: { lat, lng, radius: 1000, category: category || undefined } })
          .then(({ data }) => setNearby(data.reports))
          .catch(() => notify('Could not search near you.'));
      },
      () => notify('Location is blocked. Allow location access in your browser to use this.')
    );
  };

  const selectNearby = (r) => setFlyTarget({ lat: r.location.coordinates[1], lng: r.location.coordinates[0], zoom: 17 });

  return (
    <div className="app">
      <Sidebar
        online={online} category={category} setCategory={setCategory} count={reports.length}
        picked={picked} busy={busy} nearby={nearby}
        onSubmit={submit} onCancel={() => setPicked(null)} onNearMe={nearMe} onSelectNearby={selectNearby}
      />
      <MapView
        reports={reports} picked={picked} flyTarget={flyTarget}
        onBounds={setBbox} onPick={setPicked} onUpvote={upvote} onResolve={resolve}
      />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}