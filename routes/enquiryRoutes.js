import express, { Router } from "express";
import { verifyToken } from "../middleware/auth.js";

import {
  saveEnquiryForm,
  getAllEnquiryDetails,
  deleteFields,
  updateEnquiryById,
  getEnquiryById,
  updateEnquiryProposalStatus
} from "../controller/enquiryController.js";

const router = express.Router();

router.post("/saveEnquiryForm",verifyToken, saveEnquiryForm);

router.get("/getAllEnquiryDetails",verifyToken, getAllEnquiryDetails);

router.get("/getEnquiryById/:id",verifyToken, getEnquiryById);

router.delete("/deleteFields",verifyToken, deleteFields);

router.put("/updateEnquiryById/:id", verifyToken,updateEnquiryById);

router.put("/updateEnquiryProposalStatus",verifyToken,updateEnquiryProposalStatus)






export default router;
