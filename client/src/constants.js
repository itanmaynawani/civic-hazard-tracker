export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Where the map opens. Change this to your own area.
export const DEFAULT_CENTER = [40.758, -73.9855];
export const DEFAULT_ZOOM = 13;

export const CATEGORIES = [
  ['pothole', 'Pothole'],
  ['flooding', 'Flooding'],
  ['broken_streetlight', 'Broken streetlight'],
  ['transit_delay', 'Transit delay'],
  ['road_blockage', 'Road blockage'],
  ['damaged_infrastructure', 'Damaged infrastructure'],
  ['garbage', 'Garbage'],
  ['other', 'Other'],
];

export const labelOf = (value) => CATEGORIES.find(([v]) => v === value)?.[1] ?? value;