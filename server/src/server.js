import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import connectDB from './config/db.js';
import app from './app.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('[FieldFlow Backend] Initializing server bootstrap...');

    // 2. Connect to MongoDB (must succeed before starting server)
    await connectDB();

    // 3. Start Express server only after successful DB connection
    const server = app.listen(PORT, () => {
      console.log(`[FieldFlow Backend] Server running on port ${PORT}`);
      console.log(`[FieldFlow Backend] Health check available at: http://localhost:${PORT}/api/health`);
    });

    // Graceful shutdown handling
    const handleShutdown = async (signal) => {
      console.log(`\n[FieldFlow Backend] Received ${signal}. Shutting down gracefully...`);
      server.close(() => {
        console.log('[FieldFlow Backend] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error) {
    // 5. Handle connection failure cleanly
    console.error('[FieldFlow Backend] Startup failed: Could not connect to database.');
    console.error(`[FieldFlow Backend Error] ${error.message}`);
    process.exit(1);
  }
}

startServer();
