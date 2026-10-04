import express from 'express';
import {
  getVersions,
  getVersionById,
  compareVersions,
  rollbackVersion,
  simulateCancellation,
} from '../controllers/scheduleController.js';

const router = express.Router();

router.get('/versions', getVersions);
router.get('/versions/:versionId', getVersionById);
router.get('/compare/:from/:to', compareVersions);
router.post('/versions/:versionId/rollback', rollbackVersion);
router.post('/simulate-cancellation', simulateCancellation);

export default router;
