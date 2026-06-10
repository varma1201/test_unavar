import Payment from "../models/paymentModel.js";
import Proposal from "../models/proposalModel.js";
import multer from "multer";
import AuditManagement from "../models/auditMangement.js";
import AuditorPayment from "../models/auditorPaymentModel.js";
import { User } from "../models/usersModel.js";
import moment from "moment";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// S3 configuration
const bucketName = process.env.S3_BUCKET_NAME;
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer memory storage for handling file uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Create a new payment
export const createPayment = async (req, res) => {
  try {
    const payment = new Payment(req.body);
    await payment.save();
    res.status(201).json({
      success: true,
      message: "Payment created successfully",
      payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating payment",
      error: error.message,
    });
  }
};

// Get all payments
export const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find();
    res.status(200).json({ success: true, payments });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching payments",
      error: error.message,
    });
  }
};

// Get a single payment by ID
export const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment)
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });

    res.status(200).json({ success: true, payment });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching payment",
      error: error.message,
    });
  }
};

// Update a payment by ID
export const updatePayment = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!payment)
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });

    res.status(200).json({
      success: true,
      message: "Payment updated successfully",
      payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating payment",
      error: error.message,
    });
  }
};

// Delete a payment by ID
export const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment)
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });

    res
      .status(200)
      .json({ success: true, message: "Payment deleted successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting payment",
      error: error.message,
    });
  }
};

export const getAllProposalDetailsWithPayment = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, sort, keyword } = req.query;

    const pageNumber = parseInt(page, 10);
    const sizePerPage = parseInt(pageSize, 10);

    if (
      isNaN(pageNumber) ||
      pageNumber < 1 ||
      isNaN(sizePerPage) ||
      sizePerPage < 1
    ) {
      return res
        .status(400)
        .json({ message: "Invalid page or pageSize parameter" });
    }

    let query = Proposal.find();

    if (keyword) {
      const searchRegex = new RegExp(keyword, "i");
      query = query.where("fbo_name").regex(searchRegex);
    }

    let sortQuery = {};
    switch (sort) {
      case "newproposal":
        sortQuery = { createdAt: -1 };
        break;
      case "alllist":
        sortQuery = { createdAt: 1 };
        break;
      default:
        sortQuery = { createdAt: 1 };
        break;
    }

    const totalProposals = await Proposal.countDocuments(query.getQuery());

    const proposals = await query
      .skip((pageNumber - 1) * sizePerPage)
      .limit(sizePerPage)
      .sort(sortQuery)
      .select(
        "proposal_number fbo_name outlets proposal_date status createdAt updatedAt"
      );

    const proposalsWithCounts = await Promise.all(
      proposals.map(async (proposal) => {
        const totalOutlets = proposal.outlets.length;
        const notInvoicedOutlets = proposal.outlets.filter(
          (outlet) => !outlet.is_invoiced
        ).length;

        const total = proposal.outlets.reduce(
          (acc, outlet) =>
            acc + parseFloat(outlet.amount?.$numberInt || outlet.amount || 0),
          0
        );
        const gst = total * 0.18;
        const overallTotal = total + gst;

        const payments = await AuditorPayment.find({
          proposalId: proposal._id,
          status: "accepted",
        });
        const paymentReceived = payments.reduce(
          (sum, payment) => sum + parseFloat(payment.amountReceived || 0),
          0
        );

        const noOfPayments = await AuditorPayment.countDocuments({
          proposalId: proposal._id,
          status: "accepted",
        });

        return {
          _id: proposal._id,
          proposal_number: proposal.proposal_number,
          fbo_name: proposal.fbo_name,
          totalOutlets,
          notInvoicedOutlets,
          Proposal_value: `₹${overallTotal.toFixed(2)}` || "₹0.00",
          paymentReceived: `₹${paymentReceived.toFixed(2)}` || "₹0.00",
          balanceAmount: `₹${(overallTotal - paymentReceived).toFixed(2)}`,
          noOfPayments: noOfPayments || 0,
        };
      })
    );

    res.json({
      total: totalProposals,
      currentPage: pageNumber,
      data: proposalsWithCounts,
    });
  } catch (error) {
    console.error("Error fetching proposals:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllProposalDetails = async (req, res) => {
  try {
    const { auditor_id } = req.params;
    const { page = 1, pageSize = 10, sort, keyword } = req.query;

    const pageNumber = parseInt(page, 10);
    const sizePerPage = parseInt(pageSize, 10);

    if (
      isNaN(pageNumber) ||
      pageNumber < 1 ||
      isNaN(sizePerPage) ||
      sizePerPage < 1
    ) {
      return res
        .status(400)
        .json({ message: "Invalid page or pageSize parameter" });
    }

    const auditRecords = await AuditManagement.find({
      user: auditor_id,
    }).select("proposalId");
    const proposalIds = auditRecords.map((audit) => audit.proposalId);

    let query = Proposal.find({ _id: { $in: proposalIds } });

    if (keyword) {
      const searchRegex = new RegExp(keyword, "i");
      query = query.where("fbo_name").regex(searchRegex);
    }

    let sortQuery = {};
    switch (sort) {
      case "newproposal":
        sortQuery = { createdAt: -1 };
        break;
      case "alllist":
        sortQuery = { createdAt: 1 };
        break;
      default:
        sortQuery = { createdAt: 1 };
        break;
    }

    const totalProposals = await Proposal.countDocuments(query.getQuery());

    const proposals = await query
      .skip((pageNumber - 1) * sizePerPage)
      .limit(sizePerPage)
      .sort(sortQuery)
      .select(
        "proposal_number fbo_name outlets proposal_date status createdAt updatedAt"
      );

    const proposalsWithCounts = await Promise.all(
      proposals.map(async (proposal) => {
        const totalOutlets = proposal.outlets.length;
        const notInvoicedOutlets = proposal.outlets.filter(
          (outlet) => !outlet.is_invoiced
        ).length;

        const total = proposal.outlets.reduce(
          (acc, outlet) =>
            acc + parseFloat(outlet.amount?.$numberInt || outlet.amount || 0),
          0
        );
        const gst = total * 0.18;
        const overallTotal = total + gst;

        const payments = await AuditorPayment.find({
          proposalId: proposal._id,
          status: "accepted",
        });
        const paymentReceived = payments.reduce(
          (sum, payment) => sum + parseFloat(payment.amountReceived || 0),
          0
        );

        return {
          _id: proposal._id,
          proposal_number: proposal.proposal_number,
          fbo_name: proposal.fbo_name,
          totalOutlets,
          notInvoicedOutlets,
          Proposal_value: `₹${overallTotal.toFixed(2)}` || "₹0.00",
          paymentReceived: `₹${paymentReceived.toFixed(2)}` || "₹0.00",
          balanceAmount: `₹${(overallTotal - paymentReceived).toFixed(2)}`,
        };
      })
    );

    res.json({
      total: totalProposals,
      currentPage: pageNumber,
      data: proposalsWithCounts,
    });
  } catch (error) {
    console.error("Error fetching proposals:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllProposalDetailsForPayment = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, sort, keyword, status } = req.query;

    const pageNumber = parseInt(page, 10);
    const sizePerPage = parseInt(pageSize, 10);

    if (
      isNaN(pageNumber) ||
      pageNumber < 1 ||
      isNaN(sizePerPage) ||
      sizePerPage < 1
    ) {
      return res
        .status(400)
        .json({ message: "Invalid page or pageSize parameter" });
    }

    let paymentQuery = {};
    if (status) {
      paymentQuery.status = status;
    }

    const payments = await AuditorPayment.find(paymentQuery).select(
      "proposalId amountReceived referenceNumber status"
    );
    const validPayments = payments.filter((payment) => payment.proposalId);
    const proposalIds = validPayments.map((payment) =>
      payment.proposalId.toString()
    );

    if (proposalIds.length === 0) {
      return res.json({ total: 0, currentPage: pageNumber, data: [] });
    }

    let query = Proposal.find({ _id: { $in: proposalIds } });

    if (keyword) {
      const searchRegex = new RegExp(keyword, "i");
      query = query.where("fbo_name").regex(searchRegex);
    }

    let sortQuery = {};
    switch (sort) {
      case "newproposal":
        sortQuery = { createdAt: -1 };
        break;
      case "alllist":
        sortQuery = { createdAt: 1 };
        break;
      default:
        sortQuery = { createdAt: 1 };
        break;
    }

    const totalProposals = await Proposal.countDocuments(query.getQuery());

    const proposals = await query
      .skip((pageNumber - 1) * sizePerPage)
      .limit(sizePerPage)
      .sort(sortQuery)
      .select(
        "proposal_number fbo_name outlets proposal_date status createdAt updatedAt"
      );

    const paymentMap = new Map();
    validPayments.forEach((payment) => {
      paymentMap.set(payment.proposalId.toString(), payment);
    });

    const proposalsWithPayments = proposals.map((proposal) => {
      const totalOutlets = proposal.outlets.length;
      const notInvoicedOutlets = proposal.outlets.filter(
        (outlet) => !outlet.is_invoiced
      ).length;

      const total = proposal.outlets.reduce(
        (acc, outlet) =>
          acc + parseFloat(outlet.amount?.$numberInt || outlet.amount || 0),
        0
      );
      const gst = total * 0.18;
      const overallTotal = total + gst;

      const payment = paymentMap.get(proposal._id.toString()) || {};

      return {
        _id: proposal._id,
        proposal_number: proposal.proposal_number,
        fbo_name: proposal.fbo_name,
        totalOutlets,
        notInvoicedOutlets,
        Proposal_value: `₹${overallTotal.toFixed(2)}` || "₹0.00",
        amountReceived: payment.amountReceived || 0,
        referenceNumber: payment.referenceNumber || "N/A",
        paymentStatus: payment.status || "pending",
        balanceAmount: `₹${(
          overallTotal - (payment.amountReceived || 0)
        ).toFixed(2)}`,
      };
    });

    res.json({
      total: totalProposals,
      currentPage: pageNumber,
      data: proposalsWithPayments,
    });
  } catch (error) {
    console.error("Error fetching proposals for payment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const saveAuditorPayment = async (req, res) => {
  console.log("Request Body:", req.body);
  console.log("Uploaded File:", req.file || "No file uploaded");

  try {
    const { proposalId, amountReceived, referenceNumber, auditor_id } =
      req.body;

    if (!proposalId || !amountReceived || !referenceNumber || !auditor_id) {
      return res.status(400).json({ message: "All fields are required." });
    }

    let referenceDocument = "";
    if (req.file) {
      const timestamp = Date.now();
      const fileName = `payment-reference/${timestamp}-${req.file.originalname}`;

      const params = {
        Bucket: bucketName,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      await s3Client.send(new PutObjectCommand(params));
      referenceDocument = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      console.log(
        "Uploaded payment reference document to S3:",
        referenceDocument
      );
    }

    const newPayment = new AuditorPayment({
      proposalId,
      amountReceived,
      referenceNumber,
      referenceDocument,
      auditorId: auditor_id,
    });

    await newPayment.save();

    res
      .status(201)
      .json({ message: "Auditor payment details saved successfully!" });
  } catch (error) {
    console.error("Error saving auditor payment:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateAuditorPayment = async (req, res) => {
  console.log(
    "Request Body:",
    req.body,
    "------------------------------------------------------"
  );
  console.log("Uploaded File:", req.file || "No file uploaded");

  try {
    const { paymentId, proposalId, amountReceived, referenceNumber } = req.body;

    if (!paymentId || !proposalId || !amountReceived || !referenceNumber) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existingPayment = await AuditorPayment.findById(paymentId);
    console.log("Existing Payment:", existingPayment);

    if (!existingPayment) {
      return res.status(404).json({ message: "Payment not found." });
    }

    // Delete old file from S3 if new file is uploaded and old one exists
    if (req.file && existingPayment.referenceDocument) {
      const fileUrl = existingPayment.referenceDocument;
      const fileKey = fileUrl.split(".amazonaws.com/")[1]; // updated line

      if (fileKey) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: fileKey,
            })
          );
          console.log(
            "Deleted existing payment reference document from S3:",
            fileKey
          );
        } catch (err) {
          console.error("Error deleting old reference document from S3:", err);
        }
      } else {
        console.warn("Could not extract file key from URL:", fileUrl);
      }
    }

    // Upload new file if provided
    let referenceDocument = existingPayment.referenceDocument;
    if (req.file) {
      const timestamp = Date.now();
      const fileName = `payment-reference/${timestamp}-${req.file.originalname}`;

      const params = {
        Bucket: bucketName,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      await s3Client.send(new PutObjectCommand(params));
      referenceDocument = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      console.log(
        "Uploaded new payment reference document to S3:",
        referenceDocument
      );
    }

    // Update DB fields
    existingPayment.proposalId = proposalId;
    existingPayment.amountReceived = amountReceived;
    existingPayment.referenceNumber = referenceNumber;
    existingPayment.referenceDocument = referenceDocument;

    await existingPayment.save();

    res.status(200).json({
      message: "Auditor payment details updated successfully!",
    });
  } catch (error) {
    console.error("Error updating auditor payment:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAuditorPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Payment ID is required." });
    }

    const payment = await AuditorPayment.findOne({ _id: id }).populate({
      path: "auditorId",
      model: User,
      select: "userName roles",
    });

    if (!payment) {
      return res
        .status(404)
        .json({ message: "Pending payment details not found." });
    }

    res.status(200).json({
      ...payment.toObject(),
      auditor_name: payment.auditorId ? payment.auditorId.userName : null,
    });
  } catch (error) {
    console.error("Error fetching pending auditor payment details:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateAuditorPaymentStatus = async (req, res) => {
  console.log("Request Body:", req.body);
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || !status) {
      return res
        .status(400)
        .json({ message: "Auditor ID and status are required." });
    }

    const validStatuses = ["pending", "accepted", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const payment = await AuditorPayment.findOneAndUpdate(
      { _id: id },
      { status },
      { new: true, runValidators: true }
    );

    if (!payment) {
      return res.status(404).json({ message: "Auditor payment not found." });
    }

    res.status(200).json({
      message: "Auditor payment status updated successfully.",
      payment,
    });
  } catch (error) {
    console.error("Error updating auditor payment status:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAllProposalDetailsAdmin = async (req, res) => {
  try {
    console.log("Request body:", req.body);

    const { page = 1, pageSize = 10, sort, status, keyword } = req.query;

    const pageNumber = parseInt(page, 10);
    const sizePerPage = parseInt(pageSize, 10);

    if (
      isNaN(pageNumber) ||
      pageNumber < 1 ||
      isNaN(sizePerPage) ||
      sizePerPage < 1
    ) {
      return res
        .status(400)
        .json({ message: "Invalid page or pageSize parameter" });
    }

    let sortQuery = { createdAt: 1 };
    if (sort === "newproposal") sortQuery = { createdAt: -1 };
    else if (sort === "alllist") sortQuery = { createdAt: 1 };

    let filterQuery = {};

    if (status) {
      const statusArray = Array.isArray(status) ? status : status.split(",");
      filterQuery.status = { $in: statusArray };
    }

    if (keyword) {
      filterQuery.$or = [
        { "proposalId.proposal_number": { $regex: new RegExp(keyword, "i") } },
        { "proposalId.fbo_name": { $regex: new RegExp(keyword, "i") } },
      ];
    }

    console.log("Filter Query:", JSON.stringify(filterQuery, null, 2));

    // const auditorPayments = await AuditorPayment.find(filterQuery)
    //   .populate({
    //     path: "auditorId",
    //     model: User,
    //     select: "userName",
    //   })
    //   .populate({
    //     path: "proposalId",
    //     select:
    //       "proposal_number fbo_name outlets proposal_date status createdAt updatedAt",
    //   })
    //   .sort(sortQuery)
    //   .skip((pageNumber - 1) * sizePerPage)
    //   .limit(sizePerPage);

    const auditorPayments = await AuditorPayment.aggregate([
      {
        $lookup: {
          from: "proposals",
          localField: "proposalId",
          foreignField: "_id",
          as: "proposal",
        },
      },
      { $unwind: "$proposal" },
      {
        $lookup: {
          from: "users",
          localField: "auditorId",
          foreignField: "_id",
          as: "auditor",
        },
      },
      { $unwind: "$auditor" },
      {
        $match: {
          ...(status
            ? {
                status: {
                  $in: Array.isArray(status) ? status : status.split(","),
                },
              }
            : {}),
          ...(keyword
            ? {
                $or: [
                  {
                    "proposal.proposal_number": {
                      $regex: new RegExp(keyword, "i"),
                    },
                  },
                  { "proposal.fbo_name": { $regex: new RegExp(keyword, "i") } },
                ],
              }
            : {}),
        },
      },
      { $sort: sortQuery },
      { $skip: (pageNumber - 1) * sizePerPage },
      { $limit: sizePerPage },
    ]);

    // const validAuditorPayments = auditorPayments.filter((p) => p.proposalId);

    console.log("Fetched AuditorPayments:", auditorPayments);

    if (!auditorPayments.length) {
      return res.json({ total: 0, currentPage: pageNumber, data: [] });
    }

    const proposalsWithAuditor = await Promise.all(
      auditorPayments.map(async (payment) => {
        console.log("d " + payment);
        const proposal = payment.proposal;

        const auditor = payment.auditor;

        let totalProposalValue = 0;
        let gst = 0;
        let overallTotal = 0;
        let totalReceived = 0;

        if (proposal) {
          totalProposalValue = proposal.outlets.reduce(
            (acc, outlet) =>
              acc + parseFloat(outlet.amount?.$numberInt || outlet.amount || 0),
            0
          );
          gst = totalProposalValue * 0.18;
          overallTotal = totalProposalValue + gst;

          const paymentReceived = await AuditorPayment.aggregate([
            {
              $match: {
                proposalId: proposal._id,
                status: "accepted",
              },
            },
            {
              $group: {
                _id: null,
                totalReceived: { $sum: "$amountReceived" },
              },
            },
          ]);
          totalReceived = paymentReceived?.[0]?.totalReceived || 0;
        }

        return {
          _id: proposal ? proposal._id : null,
          proposal_number: proposal ? proposal.proposal_number : "N/A",
          auditor_paymentId: payment._id,
          fbo_name: proposal ? proposal.fbo_name : "N/A",
          totalOutlets: proposal ? proposal.outlets.length : 0,
          notInvoicedOutlets: proposal
            ? proposal.outlets.filter((outlet) => !outlet.is_invoiced).length
            : 0,
          status: payment.status,
          auditor_id: auditor ? auditor._id : "N/A",
          auditor_name: auditor ? auditor.userName : "N/A",
          Proposal_value: proposal ? `₹${overallTotal.toFixed(2)}` : "N/A",
          paymentReceived: `₹${totalReceived.toFixed(2)}`,
          amounToVerify: `₹${payment.amountReceived.toFixed(2)}`,
        };
      })
    );

    const totalCount = await AuditorPayment.countDocuments(filterQuery);

    res.json({
      total: totalCount,
      currentPage: pageNumber,
      data: proposalsWithAuditor,
    });
  } catch (error) {
    console.error("Error fetching proposals:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteFields = async (req, res) => {
  try {
    const arrayOfAuditorPaymentIds = req.body;

    if (!Array.isArray(arrayOfAuditorPaymentIds)) {
      return res.status(400).json({
        error: "Invalid input: Expected an array of AuditorPayment IDs",
      });
    }

    const auditorPayments = await AuditorPayment.find({
      _id: { $in: arrayOfAuditorPaymentIds },
    });

    await Promise.all(
      auditorPayments.map(async (payment) => {
        if (
          payment.referenceDocument &&
          payment.referenceDocument.startsWith(`https://${bucketName}.s3.`)
        ) {
          const fileKey = payment.referenceDocument.split(`/${bucketName}/`)[1];
          try {
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket: bucketName,
                Key: fileKey,
              })
            );
            console.log("Deleted payment reference document from S3:", fileKey);
          } catch (err) {
            console.error(`Failed to delete file from S3: ${fileKey}`, err);
          }
        }
      })
    );

    await AuditorPayment.deleteMany({ _id: { $in: arrayOfAuditorPaymentIds } });

    res.status(200).json({
      message: "Auditor Payments and associated documents deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting AuditorPayments:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getNoOfPayment = async (req, res) => {
  try {
    const { proposalId } = req.params;

    if (!proposalId) {
      return res.status(400).json({ message: "Proposal ID is required." });
    }

    const payments = await AuditorPayment.find({
      proposalId,
      status: "accepted",
    })
      .populate({
        path: "auditorId",
        model: User,
        select: "userName roles",
      })
      .select("amountReceived auditorId");

    const result = payments.map((payment) => ({
      _id: payment._id,
      auditorName: payment.auditorId ? payment.auditorId.userName : null,
      amountReceived: payment.amountReceived,
    }));

    res.status(200).json({ payments: result });
  } catch (error) {
    console.error("Error fetching number of payments:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAllProposalDetailsAuditor = async (req, res) => {
  try {
    console.log("Request body:", req.body);

    const {
      page = 1,
      pageSize = 10,
      sort,
      status,
      keyword,
      auditorId,
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const sizePerPage = parseInt(pageSize, 10);

    if (
      isNaN(pageNumber) ||
      pageNumber < 1 ||
      isNaN(sizePerPage) ||
      sizePerPage < 1
    ) {
      return res
        .status(400)
        .json({ message: "Invalid page or pageSize parameter" });
    }

    let sortQuery = { createdAt: 1 };
    if (sort === "newproposal") sortQuery = { createdAt: -1 };
    else if (sort === "alllist") sortQuery = { createdAt: 1 };

    let filterQuery = {};

    if (auditorId) {
      filterQuery.auditorId = auditorId;
    }

    if (status) {
      const statusArray = Array.isArray(status) ? status : status.split(",");
      filterQuery.status = { $in: statusArray };
    }

    if (keyword) {
      filterQuery.$or = [
        { "proposalId.proposal_number": { $regex: new RegExp(keyword, "i") } },
        { "proposalId.fbo_name": { $regex: new RegExp(keyword, "i") } },
      ];
    }

    console.log("Filter Query:", JSON.stringify(filterQuery, null, 2));

    const auditorPayments = await AuditorPayment.find(filterQuery)
      .populate({
        path: "auditorId",
        model: User,
        select: "userName roles",
      })
      .populate({
        path: "proposalId",
        select:
          "proposal_number fbo_name outlets proposal_date status createdAt updatedAt",
      })
      .sort(sortQuery)
      .skip((pageNumber - 1) * sizePerPage)
      .limit(sizePerPage);

    console.log("Fetched AuditorPayments:", auditorPayments.length);

    if (!auditorPayments.length) {
      return res.json({ total: 0, currentPage: pageNumber, data: [] });
    }

    const proposalsWithAuditor = await Promise.all(
      auditorPayments.map(async (payment) => {
        const proposal = payment.proposalId;
        const auditor = payment.auditorId;

        let totalProposalValue = 0;
        let gst = 0;
        let overallTotal = 0;
        let totalReceived = 0;

        if (proposal) {
          totalProposalValue = proposal.outlets.reduce(
            (acc, outlet) =>
              acc + parseFloat(outlet.amount?.$numberInt || outlet.amount || 0),
            0
          );
          gst = totalProposalValue * 0.18;
          overallTotal = totalProposalValue + gst;

          const paymentReceived = await AuditorPayment.aggregate([
            {
              $match: {
                proposalId: proposal._id,
                status: "accepted",
              },
            },
            {
              $group: {
                _id: null,
                totalReceived: { $sum: "$amountReceived" },
              },
            },
          ]);
          totalReceived = paymentReceived?.[0]?.totalReceived || 0;
        }

        return {
          _id: proposal ? proposal._id : null,
          proposal_number: proposal ? proposal.proposal_number : "N/A",
          auditor_paymentId: payment._id,
          fbo_name: proposal ? proposal.fbo_name : "N/A",
          totalOutlets: proposal ? proposal.outlets.length : 0,
          notInvoicedOutlets: proposal
            ? proposal.outlets.filter((outlet) => !outlet.is_invoiced).length
            : 0,
          status: payment.status,
          auditor_id: auditor ? auditor._id : "N/A",
          auditor_name: auditor ? auditor.userName : "N/A",
          Proposal_value: proposal ? `₹${overallTotal.toFixed(2)}` : "N/A",
          paymentReceived: `₹${totalReceived.toFixed(2)}`,
          amounToVerify: `₹${payment.amountReceived.toFixed(2)}`,
        };
      })
    );

    const totalCount = await AuditorPayment.countDocuments(filterQuery);

    res.json({
      total: totalCount,
      currentPage: pageNumber,
      data: proposalsWithAuditor,
    });
  } catch (error) {
    console.error("Error fetching proposals:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
