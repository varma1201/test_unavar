import express, { Router } from "express";
import { verifyToken } from "../middleware/auth.js";

import {
  getOutletDetailsById,
  createProposalAndOutlet,
  getBusinessDetailsByEnquiryId,
  generateProposalNumber,
  getAllProposalDetails,
  getOutletsByProposalId,
  deleteFields,
  updateProposalStatus,
  getProposalById,
  updateProposalAndOutlet,
  proposalCount,
  getFilteredInvoices,
  getFilteredAgreements,
  getProposalNumbersWithoutSpecificServices,
} from "../controller/proposalController.js";

import { generateProposal } from "../controller/proposalGenerationController.js";

const router = express.Router();

router.get(
  "/getOutletDetailsById/:enquiryId",
  verifyToken,
  getOutletDetailsById
);

router.post("/createProposalAndOutlet", verifyToken, createProposalAndOutlet);

router.get(
  "/getBusinessDetailsByEnquiryId/:enquiryId",

  getBusinessDetailsByEnquiryId
);

router.get("/genrateProposalNumber", verifyToken, generateProposalNumber);

router.put(
  "/updateProposalAndOutlet/:proposalId",
  verifyToken,
  updateProposalAndOutlet
);

router.post("/generateProposal/:proposalId", verifyToken, generateProposal);

router.get("/getAllProposalDetails", verifyToken, getAllProposalDetails);

router.get("/getOutletsByProposalId/:proposalId", getOutletsByProposalId);

router.delete("/deleteFields", verifyToken, deleteFields);

router.put(
  "/updateProposalStatus/:proposalId",
  verifyToken,
  updateProposalStatus
);

router.get("/getProposalById/:proposalId", getProposalById);

router.get("/proposalCount", proposalCount);

router.get("/getFilteredInvoices/:invoiceId", getFilteredInvoices);

router.get("/getFilteredAgreements/:agreementId", getFilteredAgreements);

router.get(
  "/proposal-number/filter-without-services",
  getProposalNumbersWithoutSpecificServices
);


export default router;
