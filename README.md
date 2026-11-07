# Geospatial Civic Hazard Tracker

A full-stack MERN app where residents map urban problems (potholes, flooding, broken streetlights, transit delays) on a live map. Reports are stored as GeoJSON in MongoDB, queried with geospatial operators, and pushed to every connected user in real time.

**Live demo:** https://civic-hazard-tracker.vercel.app
**Note:** free hosting tiers can sleep when idle, so the first load may take 30 to 60 seconds.

## Features

- Interactive Leaflet map on OpenStreetMap tiles (no API keys needed)
- Marker clustering, with data re-fetched for just the visible area on every pan and zoom
- Click-to-report flow with category, severity and description
- Duplicate detection: a report within 25 m of an open one of the same type becomes a confirmation instead of a second pin
- "Find hazards near me" with distances in meters
- Live updates over Socket.IO, plus a live count of people on the map
- Input validation (zod), rate limiting, Helmet and CORS on the API

## Tech stack

| Layer | Tools |
|---|---|
| Database | MongoDB Atlas, Mongoose 9, `2dsphere` index |
| Backend | Node.js, Express 5, Socket.IO, zod, Helmet, express-rate-limit |
| Frontend | React 19, Vite, React Leaflet, react-leaflet-cluster, Axios |

## Architecture

```
  Browser (React + Leaflet)
     |   GET /api/reports?bbox=...        (visible map area only)
     |   GET /api/reports/nearby          ($geoNear, sorted by distance)
     |   POST /api/reports                (validate, dedupe, save)
     |   Socket.IO  <---- report:created / updated / resolved
     v
  Express API  --->  MongoDB (reports collection, 2dsphere index)
```

## How the geospatial part works

Each report stores its position as a GeoJSON `Point` (`[longitude, latitude]`) with a `2dsphere` index.

- **Map view:** the client sends the visible bounds as `bbox=west,south,east,north`. The server uses `$geoWithin` with `$box`, caps results (default 500), and the client clusters them. The browser never downloads the whole dataset.
- **Nearby search:** an aggregation with `$geoNear` filters to open reports within a radius, sorts by distance and returns the distance of each result.
- **Duplicate detection:** `findOneAndUpdate` with `$geoWithin` and `$centerSphere` (25 m) finds an open report of the same category and increments its upvotes in one atomic operation. If nothing matches, a new report is created.
- **Compound index:** `{ status, category, createdAt }` supports the common filters.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health check for hosting and uptime monitors |
| GET | `/api/reports?bbox=w,s,e,n&category=&status=&limit=` | Reports inside a map area |
| GET | `/api/reports/nearby?lat=&lng=&radius=&category=&limit=` | Closest open reports, with `distance` in meters |
| POST | `/api/reports` | Create a report, or confirm a nearby duplicate |
| PATCH | `/api/reports/:id/upvote` | Confirm an open report |
| PATCH | `/api/reports/:id/resolve` | Mark a report as fixed |

Create example:

```json
POST /api/reports
{ "title": "Deep pothole", "category": "pothole", "severity": "high", "lat": 40.758, "lng": -73.9855 }
```

Socket events sent to clients: `report:created`, `report:updated`, `report:resolved`, `clients:count`.

## Run it locally

Requirements: Node.js 20+ and a MongoDB Atlas free cluster (or local MongoDB).

```bash
# 1. Backend
cd server
npm install
copy .env.example .env        
npm run dev                 # http://localhost:5000

# 2. Frontend (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Optional: fill the map with demo data (this replaces all existing reports), using the same point as `DEFAULT_CENTER` in `client/src/constants.js`:

```bash
cd server
node scripts/seed.js 40.758 -73.9855
```

Run the API smoke test (server must be running; it cleans up after itself):

```bash
cd server
node scripts/smoke-test.js
```

## Environment variables

| Where | Variable | Example |
|---|---|---|
| server | `PORT` | `5000` (set automatically by most hosts) |
| server | `MONGO_URI` | Atlas connection string, including the `civic-hazards` database name |
| server | `CLIENT_ORIGIN` | `http://localhost:5173` locally; your frontend URL in production (no trailing slash; separate several with commas) |
| client | `VITE_API_URL` | `http://localhost:5000` locally; your backend URL in production |

## Deploying for free

1. **Database:** in Atlas, open Network Access and allow `0.0.0.0/0` (hosting providers use changing IPs), and use a strong database password.
2. **Backend** (a host that runs a long-lived Node server, such as Render, Railway or Fly.io; avoid serverless-only hosts because Socket.IO needs persistent connections):
   - Root directory `server`, build command `npm install`, start command `npm start`.
   - Set `MONGO_URI` and a temporary `CLIENT_ORIGIN`.
   - After deploying, check `https://YOUR-BACKEND/health`.
3. **Frontend** (Vercel, Netlify or Cloudflare Pages):
   - Root directory `client`, build command `npm run build`, output directory `dist`.
   - Set `VITE_API_URL` to your backend URL, then deploy.
4. **Connect them:** set the backend's `CLIENT_ORIGIN` to the frontend URL and redeploy the backend.
5. **Optional:** free backends can sleep when idle. A free uptime monitor that pings `/health` every 10 to 14 minutes keeps it awake. Check each provider's current free-tier limits.

## Design decisions and limitations

- Coordinates are `[lng, lat]` in MongoDB and `[lat, lng]` in Leaflet; the conversion happens in one place in the client.
- Anyone can confirm or resolve a report. This keeps the demo simple; production use would need accounts and moderation.
- Rate limits are per IP and in memory, so a multi-instance deployment would need a shared store such as Redis.
- Socket.IO broadcasts to everyone; at larger scale it would join clients to map-region rooms and use a Redis adapter.

## Ideas for next steps

- User accounts, report photos and moderation
- Server-side grid or geohash aggregation for very dense zoomed-out views
- Expiring or auto-flagging stale reports
- Automated tests for the API with a test database