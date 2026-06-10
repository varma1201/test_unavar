import express, { Router } from "express";
import { verifyToken } from "../middleware/auth.js";

import {
  createAgreement,
  deleteFields,
  getAllAgreementDetails,
  getAgreementById,
  updateAgreement,
  updateAgreementStatus,
  getAgreementsByProposalId
} from "../controller/agreementController.js";

import { generateagreement } from "../controller/agreementGenerationController.js";

const router = express.Router();

router.delete("/deleteFields", verifyToken, deleteFields);

router.post("/createAgreement", verifyToken, createAgreement);

router.get("/getAllAgreementDetails", getAllAgreementDetails);

router.post("/generateagreement/:agreementId", verifyToken, generateagreement);

router.get("/getAgreementById/:agreementId", verifyToken, getAgreementById);

router.put("/updateAgreement/:agreementId", verifyToken, updateAgreement);

router.put("/updateAgreementStatus/:agreementId", verifyToken, updateAgreementStatus);

router.get("/getAgreementsByProposalId/:proposalId", getAgreementsByProposalId);

export default router;
