import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { DEFAULT_CENTER, DEFAULT_ZOOM, labelOf } from './constants';

const makeIcon = (cls) =>
  L.divIcon({ className: '', html: `<span class="pin ${cls}"></span>`, iconSize: [22, 22], iconAnchor: [11, 11] });

const icons = { low: makeIcon('low'), medium: makeIcon('medium'), high: makeIcon('high') };
const pickIcon = makeIcon('pick');

// Reports the visible area as "west,south,east,north" whenever the map moves
function MapEvents({ onBounds, onPick }) {
  const map = useMapEvents({
    moveend: () => onBounds(map.getBounds().toBBoxString()),
    click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  useEffect(() => {
    onBounds(map.getBounds().toBBoxString());
  }, [map, onBounds]);
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom);
  }, [map, target]);
  return null;
}

export default function MapView({ reports, picked, flyTarget, onBounds, onPick, onUpvote, onResolve }) {
  return (
    <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents onBounds={onBounds} onPick={onPick} />
      <FlyTo target={flyTarget} />

      <MarkerClusterGroup chunkedLoading>
        {reports.map((r) => (
          // GeoJSON stores [lng, lat]; Leaflet wants [lat, lng]
          <Marker key={r._id} position={[r.location.coordinates[1], r.location.coordinates[0]]} icon={icons[r.severity]}>
            <Popup>
              <strong>{r.title}</strong>
              <p className="meta">{labelOf(r.category)}, {r.severity} severity</p>
              {r.description && <p>{r.description}</p>}
              <p className="meta">{r.upvotes} {r.upvotes === 1 ? 'person has' : 'people have'} confirmed this</p>
              <div className="row">
                <button onClick={() => onUpvote(r._id)}>I see this too</button>
                <button className="ghost" onClick={() => onResolve(r._id)}>Mark fixed</button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>

      {picked && <Marker position={[picked.lat, picked.lng]} icon={pickIcon} interactive={false} />}
    </MapContainer>
  );
}