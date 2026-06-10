import express, { Router } from "express";
import { verifyToken } from "../middleware/auth.js";

import {
  createSetting,
 getSetting,
 updateSetting,
  deleteSetting,
  saveOrUpdateProfile,
  getCompanyDetail,
  saveAndUpdateBankDetail,
  getTheBankDetails,
} from "../controller/settingController.js";

const router = express.Router();

// Create a new setting
router.post("/createSetting", verifyToken, createSetting);

// Get all settings
router.get("/getSetting", getSetting);


// Update a setting by ID
router.post("/updateSetting", updateSetting);

// Delete a setting by ID
router.delete("/deleteSetting/:id", verifyToken, deleteSetting);

// Save or update profile settings
router.post("/saveOrUpdateProfile", saveOrUpdateProfile);

router.post("/saveAndUpdateBankDetail", saveAndUpdateBankDetail);

// Get profile settings
router.get("/getCompanyDetail", getCompanyDetail);

router.get("/getTheBankDetails", getTheBankDetails);

export default router;
