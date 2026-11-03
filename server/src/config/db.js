import mongoose from 'mongoose';
import Report from '../models/Report.js';

export async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri || uri.includes('your_connection_string_here')) {
    throw new Error('MONGO_URI is missing or still the placeholder. Check server/.env');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`MongoDB connected: ${mongoose.connection.name}`);

  // Make sure the collection and its 2dsphere index exist before serving requests
  await Report.init();
  console.log('Report indexes ready (2dsphere)');
}