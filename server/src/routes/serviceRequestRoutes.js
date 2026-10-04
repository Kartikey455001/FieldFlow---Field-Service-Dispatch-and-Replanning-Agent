import express from 'express';
import {
  getRequests,
  getRequestById,
  createRequest,
  createEmergencyRequest,
  updateRequest,
  updateRequestStatus,
  deleteRequest,
} from '../controllers/serviceRequestController.js';

const router = express.Router();

router.get('/', getRequests);
router.post('/emergency', createEmergencyRequest);
router.get('/:requestId', getRequestById);
router.post('/', createRequest);
router.put('/:requestId', updateRequest);
router.patch('/:requestId/status', updateRequestStatus);
router.delete('/:requestId', deleteRequest);

export default router;
