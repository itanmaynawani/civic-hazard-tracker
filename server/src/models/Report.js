import mongoose from 'mongoose';

export const CATEGORIES = [
  'pothole',
  'flooding',
  'broken_streetlight',
  'transit_delay',
  'road_blockage',
  'damaged_infrastructure',
  'garbage',
  'other',
];

export const SEVERITIES = ['low', 'medium', 'high'];
export const STATUSES = ['open', 'resolved'];

const reportSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    category: {
      type: String,
      enum: CATEGORIES,
      required: true,
    },
    severity: {
      type: String,
      enum: SEVERITIES,
      default: 'medium',
    },
    status: {
      type: String,
      enum: STATUSES,
      default: 'open',
    },

    // GeoJSON Point. IMPORTANT: coordinates are [longitude, latitude] (not lat, lng!)
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (coords) =>
            Array.isArray(coords) &&
            coords.length === 2 &&
            coords[0] >= -180 &&
            coords[0] <= 180 &&
            coords[1] >= -90 &&
            coords[1] <= 90,
          message: 'coordinates must be [longitude, latitude] within valid ranges',
        },
      },
    },

    upvotes: { type: Number, default: 1, min: 0 },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

// The index that powers $near, $geoWithin and $geoNear queries
reportSchema.index({ location: '2dsphere' });

// Speeds up "open reports of category X" filters on the map
reportSchema.index({ status: 1, category: 1, createdAt: -1 });

const Report = mongoose.model('Report', reportSchema);

export default Report;