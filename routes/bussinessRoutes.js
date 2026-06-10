import express, { Router } from "express";
import { verifyToken } from "../middleware/auth.js";

import {
  saveBusiness,
  getBusinesses,
  saveOutlet,
  getAllBusinessDetails,
  countOutletsForBusinesses,
  deleteFields,
  sendEmail,
  getOutletDetailsById,
  updateBusiness,
  getBusinessDetailsById,
  deleteOutlets,
  getParticularOutletDetails,
  updateOutlet,
  getBranchNamesByBusinessId,
  getAllClientDetails,
  updateBusinessStatus,
  saveQuestionary,
  getQuestionaryByBusiness,
  updateQuestionary,
} from "../controller/clinetController.js";

const router = express.Router();

// Route to save Client data
router.post("/saveClientData", verifyToken, saveBusiness);

router.post("/saveQuestionary", verifyToken, saveQuestionary);

router.get(
  "/getQuestionaryByBusiness/:businessId",
  verifyToken,
  getQuestionaryByBusiness
);

router.put("/updateQuestionary/:businessId", verifyToken, updateQuestionary);

// Route to save Client data
router.put("/updateClientData", verifyToken, updateBusiness);

// Route to get the business name
router.get("/getAllBussinessName", verifyToken, getBusinesses);

// Route to get all Business details
router.get("/getAllBussinesDetails", verifyToken, getAllBusinessDetails);

// Route to fetch business details by form ID
router.get(
  "/getBusinessDataByFormId/:formId",
  verifyToken,
  getBusinessDetailsById
);

// Route to fetch business details by ID
router.get("/getBusinessDataById/:id", getBusinessDetailsById);

// Route to delete Business details
router.delete("/deleteSelectedFields", verifyToken, deleteFields);

// Route to delete the outlet
router.delete("/deleteOutletFields", verifyToken, deleteOutlets);

// Route to send the mail
router.post("/sendFormlink", verifyToken, sendEmail);

// Route to get total outlet
router.get("/getTotalOutlet", verifyToken, countOutletsForBusinesses);

// Route to save outlet
router.post("/saveOutlet", verifyToken, saveOutlet);

// Route to update outlet
router.put("/updateOutlet/:outletId", verifyToken, updateOutlet);

// Route to get Outlet Detail
router.get("/getOutletDetails/:businessId", verifyToken, getOutletDetailsById);

// Route to get particular outlet details
router.get(
  "/getParticularOutletDetails/:id",

  getParticularOutletDetails
);

// Route to get all the client name
router.get(
  "/getBranchNamesByBussinessId/:businessId",
  verifyToken,
  getBranchNamesByBusinessId
);

router.get("/getAllClientDetail", verifyToken, getAllClientDetails);

router.put("/updateBusinessStatus/:id", verifyToken, updateBusinessStatus);

export default router;
