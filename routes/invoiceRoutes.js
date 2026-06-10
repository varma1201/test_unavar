import express, { Router } from "express";
import { verifyToken } from "../middleware/auth.js";

import {
  generateInvoiceNumber,
  getProposalById,
  createInvoice,
  getAllInvoiceDetail,
  deleteFields,
  getInvoiceById,
  updateInvoice,
  updateInvoiceStatus,
  getInvoicesByProposalId,
  invoiceCount,
} from "../controller/invoiceController.js";

import { generateInvoice } from "../controller/invoicesGenerationController.js";

const router = express.Router();

router.get("/generateInvoiceNumber", verifyToken, generateInvoiceNumber);

router.post("/generateInvoice/:invoiceId", verifyToken, generateInvoice);

router.get("/getProposalById/:proposalId", verifyToken, getProposalById);

router.get("/getAllInvoiceDeatails", verifyToken, getAllInvoiceDetail);

router.delete("/deleteFields", verifyToken, deleteFields);

router.post("/createInvoice", verifyToken, createInvoice);

router.get("/getInvoiceById/:invoiceId", getInvoiceById);

router.put("/updateInvoice/:invoiceId", verifyToken, updateInvoice);

router.put("/updateInvoieStatus/:invoiceId", verifyToken, updateInvoiceStatus);

router.get(
  "/getInvoicesByProposalId/:proposalId",
  verifyToken,
  getInvoicesByProposalId
);

router.get("/invoiceCount", verifyToken, invoiceCount);

export default router;
