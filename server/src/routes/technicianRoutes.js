import express from 'express';
import {
  getTechnicians,
  getTechnicianById,
  createTechnician,
  updateTechnician,
  updateAvailability,
} from '../controllers/technicianController.js';

const router = express.Router();

router.get('/', getTechnicians);
router.get('/:technicianId', getTechnicianById);
router.post('/', createTechnician);
router.put('/:technicianId', updateTechnician);
router.patch('/:technicianId/availability', updateAvailability);

export default router;
