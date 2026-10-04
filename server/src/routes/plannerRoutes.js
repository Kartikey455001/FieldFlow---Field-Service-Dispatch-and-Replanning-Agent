import express from 'express';
import {
  generatePlan,
  getLatestPlan,
  getProposals,
  getPlanById,
  modifyProposalAssignment,
  approvePlan,
  rejectPlan,
  technicianUnavailable,
  emergencyRequest,
} from '../controllers/plannerController.js';

const router = express.Router();

router.get('/latest', getLatestPlan);
router.get('/proposals', getProposals);
router.get('/:planId', getPlanById);

router.post('/generate', generatePlan);
router.post('/generate-revised', generatePlan);
router.patch('/:planId/assignments/:requestId', modifyProposalAssignment);
router.patch('/:planId/assignments', modifyProposalAssignment);
router.patch('/:planId', modifyProposalAssignment);
router.post('/:planId/approve', approvePlan);
router.post('/:planId/reject', rejectPlan);

router.post('/technician-unavailable', technicianUnavailable);
router.post('/emergency-request', emergencyRequest);

export default router;
