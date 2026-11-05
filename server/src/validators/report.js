import { z } from 'zod';
import { CATEGORIES, SEVERITIES, STATUSES } from '../models/Report.js';

const lat = z.coerce.number().min(-90).max(90);
const lng = z.coerce.number().min(-180).max(180);

// POST /api/reports
export const createReportSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().max(500).optional().default(''),
  category: z.enum(CATEGORIES),
  severity: z.enum(SEVERITIES).default('medium'),
  lat,
  lng,
});

// GET /api/reports?bbox=west,south,east,north
export const bboxQuerySchema = z.object({
  bbox: z
    .string()
    .transform((s) => s.split(',').map(Number))
    .refine(
      (a) => a.length === 4 && a.every(Number.isFinite),
      'bbox must be four numbers: west,south,east,north'
    ),
  category: z.enum(CATEGORIES).optional(),
  status: z.enum([...STATUSES, 'all']).default('open'),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

// GET /api/reports/nearby?lat=..&lng=..&radius=..
export const nearbyQuerySchema = z.object({
  lat,
  lng,
  radius: z.coerce.number().min(10).max(20000).default(1000), // meters
  category: z.enum(CATEGORIES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});