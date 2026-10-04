import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;

  if (isConnected) {
    return res.json({
      status: 'ok',
      database: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(503).json({
    status: 'error',
    database: 'disconnected',
  });
});

export default router;
