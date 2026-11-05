// Run with the server already running:  node scripts/smoke-test.js
// Creates [TEST] reports, checks every endpoint, then deletes the test data.
import 'dotenv/config';
import mongoose from 'mongoose';
import Report from '../src/models/Report.js';

const BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;

// Any coordinates work; these are just a fixed test point. Remember: [lng, lat] in the DB.
const LAT = 40.758;
const LNG = -73.9855;

let passed = 0;
let failed = 0;

function check(name, condition, extra = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function run() {
  console.log(`Testing API at ${BASE}\n`);

  // 1. Create a report
  let r = await call('POST', '/api/reports', {
    title: '[TEST] Large pothole',
    category: 'pothole',
    severity: 'high',
    lat: LAT,
    lng: LNG,
  });
  check('create report returns 201', r.status === 201, JSON.stringify(r.data));
  const potholeId = r.data?.report?._id;

  // 2. Same category ~10 m away should become an upvote (duplicate detection)
  r = await call('POST', '/api/reports', {
    title: '[TEST] Same pothole, different person',
    category: 'pothole',
    lat: LAT + 0.00009,
    lng: LNG,
  });
  check('duplicate within 25 m returns 200 + duplicate:true', r.status === 200 && r.data?.duplicate === true, JSON.stringify(r.data));
  check('duplicate increments upvotes to 2', r.data?.report?.upvotes === 2);
  check('duplicate points at the original report', r.data?.report?._id === potholeId);

  // 3. Different category at the same spot is NOT a duplicate
  r = await call('POST', '/api/reports', {
    title: '[TEST] Flooding at same spot',
    category: 'flooding',
    lat: LAT,
    lng: LNG,
  });
  check('different category creates a new report', r.status === 201, JSON.stringify(r.data));

  // 4. Same category but ~1.1 km away is NOT a duplicate
  r = await call('POST', '/api/reports', {
    title: '[TEST] Pothole far away',
    category: 'pothole',
    lat: LAT + 0.01,
    lng: LNG,
  });
  check('same category 1 km away creates a new report', r.status === 201, JSON.stringify(r.data));
  const farId = r.data?.report?._id;

  // 5. Bounding box query
  const bbox = [LNG - 0.02, LAT - 0.02, LNG + 0.02, LAT + 0.02].join(',');
  r = await call('GET', `/api/reports?bbox=${bbox}`);
  const inBox = (r.data?.reports || []).filter((x) => x.title.startsWith('[TEST]'));
  check('bbox query finds the 3 test reports', r.status === 200 && inBox.length === 3, `got ${inBox.length}`);

  const farBbox = [LNG + 1, LAT + 1, LNG + 2, LAT + 2].join(',');
  r = await call('GET', `/api/reports?bbox=${farBbox}`);
  const outBox = (r.data?.reports || []).filter((x) => x.title.startsWith('[TEST]'));
  check('bbox elsewhere finds none of them', outBox.length === 0);

  // 6. Nearby query ($geoNear) within 500 m
  r = await call('GET', `/api/reports/nearby?lat=${LAT}&lng=${LNG}&radius=500`);
  const near = (r.data?.reports || []).filter((x) => x.title.startsWith('[TEST]'));
  check('nearby (500 m) finds 2 test reports', r.status === 200 && near.length === 2, `got ${near.length}`);
  check('nearby results include distance in meters', typeof near[0]?.distance === 'number' && near[0].distance < 5);

  // 7. Upvote
  r = await call('PATCH', `/api/reports/${potholeId}/upvote`);
  check('upvote returns 200 and upvotes = 3', r.status === 200 && r.data?.report?.upvotes === 3, JSON.stringify(r.data));

  // 8. Resolve
  r = await call('PATCH', `/api/reports/${farId}/resolve`);
  check('resolve sets status to resolved', r.status === 200 && r.data?.report?.status === 'resolved', JSON.stringify(r.data));

  r = await call('PATCH', `/api/reports/${farId}/upvote`);
  check('cannot upvote a resolved report (404)', r.status === 404);

  // 9. Validation and bad input
  r = await call('POST', '/api/reports', { title: 'x', category: 'nope', lat: 200, lng: 0 });
  check('invalid body returns 400 with details', r.status === 400 && Array.isArray(r.data?.details), JSON.stringify(r.data));

  r = await call('PATCH', '/api/reports/not-an-id/upvote');
  check('invalid id returns 400', r.status === 400);

  r = await call('GET', '/api/reports?bbox=1,2,3');
  check('malformed bbox returns 400', r.status === 400);
}

try {
  await run();
} catch (err) {
  failed++;
  console.error('\nTest run crashed. Is the server running?', err.message);
} finally {
  // Clean up the test data directly in the database
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    const { deletedCount } = await Report.deleteMany({ title: /^\[TEST\]/ });
    console.log(`\nCleaned up ${deletedCount} test reports.`);
  } catch (err) {
    console.error('Cleanup failed (delete [TEST] reports manually in Atlas):', err.message);
  }
  await mongoose.disconnect();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}