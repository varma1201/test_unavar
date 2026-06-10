import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  createWorkLog,
  deleteWorkLogs,
  getAllWorkLogsByUser,
  isWorkLogAlreadyExist,
  getAllWorkLogs,
  getWorkLogById,
  updateWorkLog,
  fetchWorkLogDates,
  submitLeaveRequest,
  getAllLeaveRequests,
  approveLeaveRequest,
  calculateLeaveData,
  checkLeaveBalanceLeftOrNot,
  simulateCarryForward,
  getAllLeaveRequestsAuditor,
  getPermissionHistory,
  addCompensationLeave,
} from "../controller/workLogController.js";

const router = express.Router();

// Route to create a new work log (protected)
router.post("/createWorkLog", createWorkLog);

// Route to update an existing work log by ID (protected)
router.put("/updateWorkLog/:id", verifyToken, updateWorkLog);

// Route to delete a work log by ID (protected)
router.delete("/deleteFields", verifyToken, deleteWorkLogs);

router.get("/getAllWorkLogsByUser", getAllWorkLogsByUser);

router.get("/getAllWorkLogs", getAllWorkLogs);

router.get("/isWorkLogAlreadyExist", isWorkLogAlreadyExist);

router.get("/getWorkLogById/:workLogId", getWorkLogById);

router.put("/updateWorkLogById/:id", verifyToken, updateWorkLog);

router.get("/fetchWorkLogDates/:userId", fetchWorkLogDates);

router.post("/submitLeaveRequest", submitLeaveRequest);

router.post("/add-compensation-leave", verifyToken, addCompensationLeave);

router.get("/getAllLeaveRequests", getAllLeaveRequests);

router.get("/getAllLeaveRequestsAuditor", getAllLeaveRequestsAuditor);

router.put("/approveLeaveRequest/:id", approveLeaveRequest);

router.get("/getWorkLogById/:workLogId", getWorkLogById);

router.get("/calculateLeaveData/:userId", calculateLeaveData);

router.get("/checkLeaveBalnceLeftOrNot/:userId", checkLeaveBalanceLeftOrNot);

router.put("/simulateCarryForward/:userId", simulateCarryForward);

router.get("/permission-history", getPermissionHistory);

export default router;
