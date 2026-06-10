import { Router } from 'express';
import { generateProposalExcel } from "../controller/summaryController.js";
const router = Router();

// Example: GET /summary
router.get('/generateProposalExcel', generateProposalExcel);

export default router;
