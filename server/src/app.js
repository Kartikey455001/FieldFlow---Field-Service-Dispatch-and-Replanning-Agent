import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/healthRoutes.js';
import serviceRequestRoutes from './routes/serviceRequestRoutes.js';
import technicianRoutes from './routes/technicianRoutes.js';
import assignmentRoutes from './routes/assignmentRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import plannerRoutes from './routes/plannerRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// CORS configuration
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || origin === clientUrl || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/requests', serviceRequestRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/schedule', scheduleRoutes); // Support singular alias
app.use('/api/planner', plannerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Catch-all 404 for unmatched API routes
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: `API endpoint not found: [${req.method}] ${req.originalUrl}`,
      code: 'NOT_FOUND',
    });
  }
  next();
});

// Centralized error handler
app.use(errorHandler);

export default app;
