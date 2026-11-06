// Fills the database with realistic demo hazards around a point.
//
//   node scripts/seed.js                      -> uses the default point below
//   node scripts/seed.js <lat> <lng>          -> centers the data on your own area
//
// Use the same point as DEFAULT_CENTER in client/src/constants.js.
// WARNING: this deletes every existing report before inserting the demo data.
import 'dotenv/config';
import mongoose from 'mongoose';
import Report from '../src/models/Report.js';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const CENTER_LAT = Number(args[0] ?? 40.758);
const CENTER_LNG = Number(args[1] ?? -73.9855);

if (!Number.isFinite(CENTER_LAT) || !Number.isFinite(CENTER_LNG)) {
  console.error('Usage: node scripts/seed.js <lat> <lng>');
  process.exit(1);
}

// Small deterministic random generator, so everyone gets the same demo data
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// Random point within `meters` of a center. Returns GeoJSON order: [lng, lat]
function around([lng, lat], meters) {
  const angle = rand() * 2 * Math.PI;
  const dist = meters * Math.sqrt(rand());
  const dLat = (dist * Math.sin(angle)) / 111320;
  const dLng = (dist * Math.cos(angle)) / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lng + dLng, lat + dLat];
}

const TITLES = {
  pothole: ['Deep pothole in the left lane', 'Cracked road surface near the crossing', 'Pothole damaging tyres'],
  flooding: ['Water pooling after rain', 'Blocked drain flooding the road', 'Underpass holds water'],
  broken_streetlight: ['Streetlight out for several nights', 'Flickering light on the footpath', 'Dark stretch, no lighting'],
  transit_delay: ['Buses queueing at the junction', 'Signal fault causing long delays', 'Stop closed, no notice posted'],
  road_blockage: ['Fallen tree across one lane', 'Construction barrier blocking the road', 'Parked trucks narrowing the street'],
  damaged_infrastructure: ['Broken footpath slab', 'Bent guardrail by the bridge', 'Collapsed section of kerb'],
  garbage: ['Uncollected rubbish pile', 'Overflowing public bin', 'Dumped debris on the pavement'],
  other: ['Open manhole cover', 'Loose cables hanging low', 'Faded zebra crossing'],
};

const center = [CENTER_LNG, CENTER_LAT];
const docs = [];

function addReport(point, category, daysAgoMax = 14) {
  const severity = pick(['low', 'medium', 'medium', 'high']);
  docs.push({
    title: pick(TITLES[category]),
    description: '',
    category,
    severity,
    status: 'open',
    upvotes: 1 + Math.floor(rand() * rand() * 14),
    location: { type: 'Point', coordinates: point },
    createdAt: new Date(Date.now() - rand() * daysAgoMax * 86400000),
  });
}

// 5 hotspots (so clustering has something to show), each with a dominant problem type
const hotspotCategories = ['pothole', 'flooding', 'broken_streetlight', 'transit_delay', 'road_blockage'];
for (const cat of hotspotCategories) {
  const hotspot = around(center, 2500);
  for (let i = 0; i < 7; i++) addReport(around(hotspot, 120), rand() < 0.6 ? cat : pick(Object.keys(TITLES)));
}

// Scattered one-off reports across the wider area
for (let i = 0; i < 12; i++) addReport(around(center, 3500), pick(Object.keys(TITLES)));

// A few already-fixed reports (hidden from the default map view)
for (let i = 0; i < 4; i++) {
  docs[Math.floor(rand() * docs.length)].status = 'resolved';
}
for (const d of docs) if (d.status === 'resolved') d.resolvedAt = new Date();

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  await Report.init();
  await Report.deleteMany({});
  await Report.insertMany(docs);
  const open = docs.filter((d) => d.status === 'open').length;
  console.log(`Seeded ${docs.length} reports (${open} open) around ${CENTER_LAT}, ${CENTER_LNG}.`);
} catch (err) {
  console.error('Seeding failed:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}