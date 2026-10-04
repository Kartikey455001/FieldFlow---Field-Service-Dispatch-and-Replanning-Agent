import express from 'express';
import {
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} from '../controllers/assignmentController.js';

const router = express.Router();

router.get('/', getAssignments);
router.post('/', createAssignment);
router.put('/:assignmentId', updateAssignment);
router.delete('/:assignmentId', deleteAssignment);

export default router;
