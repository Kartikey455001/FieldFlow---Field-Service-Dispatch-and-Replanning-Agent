import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if not already populated (supports dev, test, and production environments)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Global cache across serverless warm invocations
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

function sanitizeMongoUri(uri) {
  if (!uri) return '<undefined>';
  return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
}

const connectDB = async () => {
  // If connection is already established and ready (1 = connected)
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    const errorMsg = 'MONGO_URI is not defined in environment variables. Check your server configuration.';
    console.error(`[MongoDB Error] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  if (!cached.promise) {
    const opts = {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      bufferCommands: true,
    };

    console.log(`[MongoDB] Initiating connection to ${sanitizeMongoUri(mongoUri)}...`);

    cached.promise = mongoose
      .connect(mongoUri, opts)
      .then((mongooseInstance) => {
        console.log(
          `[MongoDB Connected] Host: ${mongooseInstance.connection.host} · Database: ${mongooseInstance.connection.name}`
        );
        return mongooseInstance;
      })
      .catch((err) => {
        cached.promise = null;
        console.error(`[MongoDB Connection Error] Failed to connect: ${err.message}`);
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
};

export default connectDB;
