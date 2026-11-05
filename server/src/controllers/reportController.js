import mongoose from 'mongoose';
import Report from '../models/Report.js';
import { broadcast } from '../socket.js';
import {
  createReportSchema,
  bboxQuerySchema,
  nearbyQuerySchema,
} from '../validators/report.js';

const DUPLICATE_RADIUS_M = 25;
const EARTH_RADIUS_M = 6378100;

// ---------- helpers ----------

function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    throw httpError(400, 'Validation failed', details);
  }
  return result.data;
}

function assertValidId(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, 'Invalid report id');
}

// ---------- POST /api/reports ----------
// Creates a report, OR upvotes an existing open report of the same category
// within 25 m (duplicate detection).
export async function createReport(req, res) {
  const data = validate(createReportSchema, req.body);

  // Atomic "find a nearby open duplicate and upvote it" in a single operation.
  // $geoWithin + $centerSphere = "inside a circle of radius 25 m" on the 2dsphere index.
  const duplicate = await Report.findOneAndUpdate(
    {
      status: 'open',
      category: data.category,
      location: {
        $geoWithin: {
          $centerSphere: [[data.lng, data.lat], DUPLICATE_RADIUS_M / EARTH_RADIUS_M],
        },
      },
    },
    { $inc: { upvotes: 1 } },
    { new: true }
  );

  if (duplicate) {
    broadcast('report:updated', duplicate);
    return res.status(200).json({ duplicate: true, report: duplicate });
  }

  const report = await Report.create({
    title: data.title,
    description: data.description,
    category: data.category,
    severity: data.severity,
    location: { type: 'Point', coordinates: [data.lng, data.lat] },
  });

  broadcast('report:created', report);
  res.status(201).json({ duplicate: false, report });
}

// ---------- GET /api/reports?bbox=west,south,east,north ----------
// Returns only the reports inside the visible map area.
export async function getReports(req, res) {
  const q = validate(bboxQuerySchema, req.query);

  // Leaflet bounds can exceed the world at low zoom levels, so clamp them
  const [w, s, e, n] = q.bbox;
  const west = Math.max(-180, w);
  const east = Math.min(180, e);
  const south = Math.max(-90, s);
  const north = Math.min(90, n);

  if (west >= east || south >= north) {
    throw httpError(400, 'bbox must satisfy west < east and south < north');
  }

  const filter = {
    location: { $geoWithin: { $box: [[west, south], [east, north]] } },
  };
  if (q.status !== 'all') filter.status = q.status;
  if (q.category) filter.category = q.category;

  const reports = await Report.find(filter)
    .sort({ createdAt: -1 })
    .limit(q.limit)
    .lean();

  res.json({ count: reports.length, reports });
}

// ---------- GET /api/reports/nearby?lat=..&lng=..&radius=.. ----------
// Closest open hazards to a point, with the distance in meters.
export async function getNearby(req, res) {
  const q = validate(nearbyQuerySchema, req.query);

  const match = { status: 'open' };
  if (q.category) match.category = q.category;

  const reports = await Report.aggregate([
    {
      // $geoNear must be the first stage. It sorts by distance and adds it to each doc.
      $geoNear: {
        near: { type: 'Point', coordinates: [q.lng, q.lat] },
        distanceField: 'distance',
        maxDistance: q.radius,
        spherical: true,
        query: match,
      },
    },
    { $limit: q.limit },
  ]);

  // Round distances to whole meters for a cleaner response
  for (const r of reports) r.distance = Math.round(r.distance);

  res.json({ count: reports.length, reports });
}

// ---------- PATCH /api/reports/:id/upvote ----------
export async function upvoteReport(req, res) {
  assertValidId(req.params.id);

  const report = await Report.findOneAndUpdate(
    { _id: req.params.id, status: 'open' },
    { $inc: { upvotes: 1 } },
    { new: true }
  );
  if (!report) throw httpError(404, 'Report not found or already resolved');

  broadcast('report:updated', report);
  res.json({ report });
}

// ---------- PATCH /api/reports/:id/resolve ----------
export async function resolveReport(req, res) {
  assertValidId(req.params.id);

  const report = await Report.findOneAndUpdate(
    { _id: req.params.id, status: 'open' },
    { status: 'resolved', resolvedAt: new Date() },
    { new: true }
  );
  if (!report) throw httpError(404, 'Report not found or already resolved');

  broadcast('report:resolved', report);
  res.json({ report });
}