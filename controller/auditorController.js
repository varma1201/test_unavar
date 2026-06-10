import Proposal from "../models/proposalModel.js";
import Auditor from "../models/auditorModel.js";
import moment from "moment";
import { User, userRoles } from "../models/usersModel.js";
import AuditManagement from "../models/auditMangement.js";
import Question from "../models/questionSchema.js";
import Label from "../models/labelModel.js";
import CheckListCategory from "../models/checkListCategoryModel.js";
import AuditResponse from "../models/auditReponseModel.js";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import mongoose from "mongoose";



import ExcelJS from "exceljs";


const baseUrl = process.env.BASE_URL || "http://localhost:8000";
const bucketName = process.env.S3_BUCKET_NAME;

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Create a new auditor
export const createAuditor = async (req, res) => {
  try {
    const { auditor_name } = req.body;
    if (!auditor_name) {
      return res.status(400).json({ message: "Auditor name is required" });
    }

    const newAuditor = new Auditor({ auditor_name });
    await newAuditor.save();
    res.status(201).json(newAuditor);
  } catch (error) {
    res.status(500).json({ message: "Error creating auditor", error });
  }
};

// Get all auditors
export const getAllAuditors = async (req, res) => {
  try {
    const auditors = await Auditor.find();
    res.status(200).json(auditors);
  } catch (error) {
    res.status(500).json({ message: "Error fetching auditors", error });
  }
};

// Get a single auditor by ID
export const getAuditorById = async (req, res) => {
  try {
    const { id } = req.params;
    const auditor = await Auditor.findById(id);

    if (!auditor) {
      return res.status(404).json({ message: "Auditor not found" });
    }

    res.status(200).json(auditor);
  } catch (error) {
    res.status(500).json({ message: "Error fetching auditor", error });
  }
};

// Update an auditor by ID
export const updateAuditor = async (req, res) => {
  try {
    const { id } = req.params;
    const { auditor_name } = req.body;

    const updatedAuditor = await Auditor.findByIdAndUpdate(
      id,
      { auditor_name },
      { new: true }
    );

    if (!updatedAuditor) {
      return res.status(404).json({ message: "Auditor not found" });
    }

    res.status(200).json(updatedAuditor);
  } catch (error) {
    res.status(500).json({ message: "Error updating auditor", error });
  }
};

// Delete an auditor by ID
export const deleteAuditor = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedAuditor = await Auditor.findByIdAndDelete(id);

    if (!deletedAuditor) {
      return res.status(404).json({ message: "Auditor not found" });
    }

    res.status(200).json({ message: "Auditor deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting auditor", error });
  }
};

// Function to send outlet data to an external API
const sendOutletData = async (outletData) => {
  try {
    const response = await axios.post(
      "https://example.com/api/outlet",
      outletData
    );
    return { success: true, data: response.data };
  } catch (error) {
    console.error(
      `Error sending outlet data for ${outletData.outletName}:`,
      error.message
    );
    return { success: false, error: error.message };
  }
};

export const processProposalsWithOutlets = async (req, res) => {
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

    let query = Proposal.find().populate("enquiryId");

    // if (keyword) {
    //   const searchRegex = new RegExp(keyword, "i");
    //   query = query.where("fbo_name").regex(searchRegex);
    // }

    if (keyword) {
      const searchRegex = new RegExp(keyword, "i"); // Case-insensitive

      query = query.find({
        $or: [
          { fbo_name: { $regex: searchRegex } },
          { proposal_number: { $regex: searchRegex } }
        ]
      });
    }

    let sortQuery = {};
    switch (sort) {
      case "newproposal":
        sortQuery = { createdAt: -1 };
        break;
      case "oldproposal":
        sortQuery = { createdAt: 1 };
        break;
      default:
        sortQuery = { createdAt: 1 };
    }

    const proposals = await query.sort(sortQuery);

    const allOutlets = [];
    proposals.forEach((proposal) => {
      let auditCounter = 1;
      proposal.outlets.forEach((outlet) => {
        if (
          outlet.outlet_name === "Others" ||
          (outlet.description != "TPA" &&
            outlet.description != "Hygiene Rating")
        )
          return null;
        let location = proposal.address?.line2
          ?.replace(/,/, "/")
          .replace(/\s+/g, "");

        if (outlet.is_assignedAuditor === false) {
          allOutlets.push({
            audit_number: `${auditCounter}`,
            proposal_number: proposal.proposal_number,
            fbo_name: proposal.fbo_name,
            outlet_name: outlet.outlet_name,
            outlet_id: outlet._id,
            proposal_id: proposal._id,
            amount: outlet.amount,
            status: outlet.is_assignedAuditor,
            customer_type: proposal.customer_type,
            date_time: moment(proposal.createdAt).format(
              "MMMM Do YYYY, h:mm A"
            ),
            service: outlet.description || "",
            type_of_industry: outlet.type_of_industry,
            vertical_of_industry: outlet.vertical_of_industry,
            location: location,
          });
        }

        auditCounter++;
      });
    });

    const totalOutlets = allOutlets.length;
    const paginatedOutlets = allOutlets.slice(
      (pageNumber - 1) * sizePerPage,
      pageNumber * sizePerPage
    );
    const totalPages = Math.ceil(totalOutlets / sizePerPage);

    res.status(200).json({
      message: "Processed all proposals and outlets successfully",
      total: totalOutlets,
      totalpages: totalPages,
      currentPage: pageNumber,
      data: paginatedOutlets,
    });
  } catch (error) {
    console.error("Error processing proposals and outlets:", error);
    res
      .status(500)
      .json({ message: "Error processing proposals and outlets", error });
  }
};

export const updateOutletAssignedAuditor = async (req, res) => {
  const { proposalId, outletId } = req.params;

  try {
    const updatedProposal = await Proposal.updateOne(
      {
        _id: proposalId,
        "outlets._id": outletId,
      },
      {
        $set: { "outlets.$.is_assignedAuditor": true },
      }
    );

    if (updatedProposal.nModified === 0) {
      return res.status(404).json({
        success: false,
        message: "No matching proposal or outlet found to update.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Outlet updated successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update outlet.",
      error: error.message,
    });
  }
};

export const getAuditAdmins = async (req, res) => {
  try {
    const auditAdmins = await User.find({ roles: userRoles.AUDITOR }).select(
      "_id userName"
    );

    res.status(200).json({
      success: true,
      message: "Fetched all AUDIT_ADMIN users successfully",
      data: auditAdmins,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch AUDIT_ADMIN users",
      error: error.message,
    });
  }
};

export const saveAuditRecord = async (req, res) => {
  console.log(req.body);
  console.log("this is the body");

  try {
    const {
      user,
      proposalId,
      outletId,
      fbo_name,
      outlet_name,
      status,
      assigned_date,
      location,
      audit_number,
      proposal_number,
      service,
      customer_type,
      type_of_industry,
      vertical_of_industry,
    } = req.body;

    const updatedProposal = await Proposal.updateOne(
      {
        _id: proposalId,
        "outlets._id": outletId,
      },
      {
        $set: { "outlets.$.is_assignedAuditor": true },
      }
    );

    if (updatedProposal.nModified === 0) {
      return res.status(404).json({
        success: false,
        message: "Failed to update outlet. Proposal or outlet not found.",
      });
    }

    console.log("Outlet updated successfully!");

    const newAudit = new AuditManagement({
      proposalId,
      outletId,
      fbo_name,
      outlet_name,
      status,
      assigned_date,
      started_at: null,
      location,
      audit_number,
      user,
      proposal_number,
      service,
      customer_type,
      type_of_industry,
      vertical_of_industry,
    });

    const savedAudit = await newAudit.save();

    res.status(201).json({
      success: true,
      message: "Audit record saved successfully and outlet updated.",
      data: savedAudit,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to save audit record.",
      error: error.message,
    });
  }
};

export const getAudits = async (req, res) => {
  try {
    const { status, userId, searchQuery, page = 1, perPage = 10 } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const perPageNum = parseInt(perPage, 10) || 10;

    const query = {};
    if (status) query.status = status;
    if (userId) query.user = userId;

    if (searchQuery) {
      const regex = new RegExp(searchQuery, "i");
      query.$or = [
        { outlet_name: { $regex: regex } },
        { fbo_name: { $regex: regex } },
        { location: { $regex: regex } },
        { audit_number: { $regex: regex } },
        { proposal_number: { $regex: regex } },
      ];
    }

    const skip = (pageNum - 1) * perPageNum;

    const audits = await AuditManagement.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPageNum)
      .populate("user", "userName")
      .populate("proposalId", "proposal_number");

    const totalCount = await AuditManagement.countDocuments(query);

    const response = audits.map((audit) => ({
      _id: audit._id,
      userName: audit.user ? audit.user.userName : null,
      proposal_number: audit.proposal_number,
      outletId: audit.outletId,
      fbo_name: audit.fbo_name,
      outlet_name: audit.outlet_name,
      status: audit.status,
      started_at: audit.started_at,
      location: audit.location,
      audit_number: audit.audit_number,
      assigned_date: audit.assigned_date,
      status_changed_at: audit.status_changed_at,
      customer_type: audit.customer_type,
      createdAt: audit.createdAt,
      updatedAt: audit.updatedAt,
      service: audit.service,
      vertical_of_industry: audit.vertical_of_industry,

      credit_score: audit?.credit_score,
      maximum_score: audit?.maximum_score,
      total_score: audit?.total_score,
      __v: audit.__v,
    }));

    const totalPages = Math.ceil(totalCount / perPageNum);

    res.status(200).json({
      success: true,
      message: "Audits retrieved successfully.",
      data: response,
      pagination: {
        page: pageNum,
        perPage: perPageNum,
        total: totalCount,
        totalPages: totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve audits.",
      error: error.message,
    });
  }
};

export const getAuditsWorkLog = async (req, res) => {
  try {
    const { status, userId } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (userId) {
      query.user = userId;
    }

    const audits = await AuditManagement.find(query)
      .sort({ createdAt: -1 })
      .populate("user", "userName")
      .populate("proposalId", "proposal_number");

    const response = audits.map((audit) => ({
      _id: audit._id,
      userName: audit.user ? audit.user.userName : null,
      proposal_number: audit.proposalId
        ? audit.proposalId.proposal_number
        : null,
      outletId: audit.outletId,
      fbo_name: audit.fbo_name,
      outlet_name: audit.outlet_name,
      status: audit.status,
      started_at: audit.started_at,
      location: audit.location,
      audit_number: audit.audit_number,
      assigned_date: audit.assigned_date,
      status_changed_at: audit.status_changed_at,
      customer_type: audit.customer_type,
      service: audit.service,
      vertical_of_industry: audit.vertical_of_industry,
      createdAt: audit.createdAt,
      updatedAt: audit.updatedAt,
    }));

    res.status(200).json({
      success: true,
      message: "Audits retrieved successfully.",
      data: response,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve audits.",
      error: error.message,
    });
  }
};

export const getAuditById = async (req, res) => {
  try {
    const { id } = req.params;

    let query = AuditManagement.findById(id)
      .populate("user", "userName")
      .populate("proposalId", "proposal_number");

    const auditWithChecklist = await AuditManagement.findById(id);
    if (auditWithChecklist && auditWithChecklist.checklistCategory) {
      query = query.populate("checklistCategory", "name");
    }

    const audit = await query;

    if (!audit) {
      return res.status(404).json({
        success: false,
        message: "Audit not found.",
      });
    }

    const statusHistory = await Promise.all(
      (audit.statusHistory || []).map(async (statusEntry) => {
        if (statusEntry.status === "modified" && statusEntry.userId) {
          const user = await User.findById(statusEntry.userId).select(
            "userName"
          );
          return {
            ...statusEntry.toObject(),
            userName: user ? user.userName : null,
          };
        }
        return statusEntry.toObject();
      })
    );

    const formatDateTime = (date) =>
      date ? moment(date).format("DD-MM-YYYY HH:mm:ss") : null;

    const response = {
      userName: audit.user ? audit.user.userName : null,
      proposal_number: audit.proposalId
        ? audit.proposalId.proposal_number
        : null,
      outletId: audit.outletId,
      fbo_name: audit.fbo_name,
      outlet_name: audit.outlet_name,
      auditee_name: audit.auditee_name || null, // Added
      fostac_person: audit.fostac_person || null, // Added
      fostac_certificate_number: audit.fostac_certificate_number || null, // Added
      fostac_certificate_validity: audit.fostac_certificate_validity || null, // Added
      inspectedProducts: audit.inspectedProducts || [], // Added
      equipmentUsed: audit.equipmentUsed || [], // Added
      status: audit.status,
      started_at: audit.started_at,
      location: audit.location,
      audit_number: audit.audit_number,
      proposal_number: audit.proposal_number,
      audit_comments: audit.audit_comments,
      status_changed_at: formatDateTime(audit.status_changed_at),
      statusHistory,
      modificationHistory: audit.modificationHistory || null,
      changes: audit.changes || {},
      fssai_image_url: audit.fssai_image_url ? audit.fssai_image_url : null,
      fssai_number: audit.fssai_number ? audit.fssai_number : null,
      assigned_date: audit.assigned_date || null,
      type_of_industry: audit.type_of_industry,
      stepsStatus: audit.stepsStatus || null,
      physical_date: audit.physical_date || null,
      service: audit.service,
      checkListId: audit.checklistCategory || null,
      vertical_of_industry: audit.vertical_of_industry,
      // Removed: fssai_certificate_number and certificate_expiry (old fields)
      __v: audit.__v,
    };

    res.status(200).json({
      success: true,
      message: "Audit retrieved successfully.",
      data: response,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve audit.",
      error: error.message,
    });
  }
};

// export const updateAuditById = async (req, res) => {
//   console.log(req.body);
//   try {
//     const { id } = req.params;
//     const updates = req.body;
//     console.log(updates.assigned_date, "seee here");

//     const audit = await AuditManagement.findById(id);

//     if (!audit) {
//       return res.status(404).json({
//         success: false,
//         message: "Audit not found.",
//       });
//     }

//     if (updates.status) audit.status = updates.status;
//     if (updates.audit_comments) audit.audit_comments = updates.audit_comments;
//     if (updates.started_at) audit.started_at = updates.started_at;
//     if (updates.location) audit.location = updates.location;
//     if (updates.status_changed_at)
//       audit.status_changed_at = updates.status_changed_at;
//     if (updates.fbo_name) audit.fbo_name = updates.fbo_name;
//     if (updates.outlet_name) audit.outlet_name = updates.outlet_name;
//     if (updates.proposal_number)
//       audit.proposal_number = updates.proposal_number;
//     if (updates.audit_number) audit.audit_number = updates.audit_number;
//     if (updates.user) audit.user = updates.user;
//     if (updates.physical_date) audit.physical_date = updates.physical_date;
//     if (updates.vertical_of_industry)
//       audit.vertical_of_industry = updates.vertical_of_industry;
//     if (updates.assigned_date) audit.assigned_date = updates.assigned_date;

//     if (updates.changes) {
//       audit.changes = {
//         ...(audit.changes || {}),
//         ...updates.changes,
//       };
//     }

//     audit.modificationHistory = audit.modificationHistory || [];
//     audit.modificationHistory.push({
//       modifiedAt: new Date(),
//       changes: updates,
//     });

//     const updatedAudit = await audit.save();

//     res.status(200).json({
//       success: true,
//       message: "Audit updated successfully.",
//       data: updatedAudit,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Failed to update audit.",
//       error: error.message,
//     });
//   }
// };
export const updateAuditById = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, changes, comment, assigned_date, physical_date } = req.body;
    const userId = req.body.userId;
    console.log(req.body);

    const audit = await AuditManagement.findById(id);
    if (!audit) {
      return res.status(404).json({
        success: false,
        message: "Audit not found",
      });
    }

    // Date Modification
    if (assigned_date) {
      const parsedAssigned = moment.tz(
        assigned_date,
        "YYYY-MM-DD",
        true,
        "Asia/Kolkata"
      );

      if (!parsedAssigned.isValid()) {
        return res.status(400).json({
          success: false,
          message: "Invalid assigned_date format",
        });
      }

      audit.assigned_date = parsedAssigned.toDate();
    }

    if (physical_date) {
      const parsedPhysical = moment.tz(
        physical_date,
        "YYYY-MM-DD",
        true,
        "Asia/Kolkata"
      );

      if (!parsedPhysical.isValid()) {
        return res.status(400).json({
          success: false,
          message: "Invalid physical_date format",
        });
      }

      audit.physical_date = parsedPhysical.toDate();
    }

    // UPDATE CHANGES
    if (changes && typeof changes === "object") {
      Object.entries(changes).forEach(([step, value]) => {
        audit.changes.set(String(step), String(value));
      });
    }

    // STATUS HISTORY
    if (status === "modified") {
      audit.status = "modified";

      audit.statusHistory.push({
        status: "modified",
        changedAt: new Date(),
        userId,
        comment: comment || "Changes submitted",
      });
    }

    // MODIFICATION HISTORY
    if (changes && Object.keys(changes).length > 0) {
      audit.modificationHistory.push({
        modifiedAt: new Date(),
        modifiedBy: userId,
        stepChanges: changes,
        comment: comment || null,
      });
    }

    await audit.save();

    res.status(200).json({
      success: true,
      message: "Audit updated successfully",
      data: audit,
    });
  } catch (error) {
    console.error("updateAuditById error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update audit",
      error: error.message,
    });
  }
};

export const updateStatusHistoryByAuditId = async (req, res) => {
  console.log(req.body);
  const { auditId } = req.params;
  const { status, comment, userId } = req.body;

  try {
    if (
      ![
        "assigned",
        "draft",
        "modified",
        "submitted",
        "approved",
        "Physical Audit Completed",
        "Documentation Work On",
        "FSSAI Portal Updated",
      ].includes(status)
    ) {
      return res.status(400).json({ message: "Invalid status provided" });
    }

    const audit = await AuditManagement.findById(auditId);

    if (!audit) {
      return res.status(404).json({ message: "Audit not found" });
    }

    audit.status = status;

    if (status === "approved") {
      audit.approver = userId;
    }

    const statusHistoryEntry = {
      status,
      changedAt: new Date(),
      ...(status === "modified" || status === "approved"
        ? { comment, userId }
        : {}),
    };

    if (
      audit.statusHistory.length == 0 ||
      status !== audit.statusHistory.at(-1).status
    )
      audit.statusHistory.push(statusHistoryEntry);

    await audit.save();

    return res.status(200).json({
      success: true,
      message: "Status history updated successfully",
      audit,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating status history",
    });
  }
};

export const createCheckListCategory = async (req, res) => {
  try {
    const { name, service } = req.body;

    if (!name || !service) {
      return res.status(400).json({ message: "Name and Service are required" });
    }

    const existingCategory = await CheckListCategory.findOne({ name, service });
    if (existingCategory) {
      return res
        .status(400)
        .json({ message: "Category with this name already exists" });
    }

    const category = new CheckListCategory({ name, service });
    await category.save();

    res.status(201).json({
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error Creating Category:", error);
    res.status(500).json({ message: "Failed to create category", error });
  }
};

export const saveLabel = async (req, res) => {
  try {
    const { name, checklistCategory, position } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Label name is required." });
    }
    if (!checklistCategory) {
      return res
        .status(400)
        .json({ message: "Checklist Category is required." });
    }

    const label = new Label({ name, checklistCategory, position });
    await label.save();

    res.status(201).json({
      message: "Label created successfully",
      data: label,
    });
  } catch (error) {
    console.error("Error saving label:", error);
    res.status(500).json({ message: "Failed to create label", error });
  }
};

export const addQuestionToLabel = async (req, res) => {
  try {
    const { labelId, questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Questions array is required." });
    }

    const questionArray = [];

    questions.forEach((question) => {
      const { question_text, marks, position } = question;
      const newQuestion = new Question({
        question_text,
        marks,
        label: labelId,
        position,
      });
      questionArray.push(newQuestion);
    });

    const savedQuestions = await Question.insertMany(questionArray);

    res.status(201).json({
      message: "Question added to label successfully",
      data: savedQuestions,
    });
  } catch (error) {
    console.error("Error adding question to label:", error);
    res.status(500).json({ message: "Failed to add question to label", error });
  }
};

export const fetchAllChecklistCategories = async (req, res) => {
  try {
    const checklistCategories = await CheckListCategory.find();

    res.status(200).json(checklistCategories);
  } catch (error) {
    console.error("Error fetching checklist categories:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch checklist categories", error });
  }
};

export const fetchLabelsWithQuestions = async (req, res) => {
  try {
    const { checkListCategoryId } = req.params;

    const checklistCategoryInfo = await CheckListCategory.findById(
      checkListCategoryId
    );
    const labels = await Label.find({ checklistCategory: checkListCategoryId });

    const data = await Promise.all(
      labels
        .sort((a, b) => a.position - b.position)
        .map(async (label) => {
          const questions = await Question.find({ label: label._id });

          return {
            title: label.name,
            questions: questions.map((question, index) => ({
              questionId: question._id,
              // description: `${index + 1}. ${question.question_text}`,
              description: question.question_text,
              position: question.position,
              mark: question.marks,
            })),
          };
        })
    );

    res.status(200).json({
      categoryName: checklistCategoryInfo.name,
      service: checklistCategoryInfo.service,
      data,
    });
  } catch (error) {
    console.error("Error fetching labels with questions:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch labels with questions", error });
  }
};

// ---------- SAVE NEW AUDIT RESPONSES ----------
export const saveAuditResponses = async (req, res) => {
  try {
    const { data } = req.body;
    console.log(req.body, "here");

    const files = req.files || [];

    if (!data) return res.status(400).json({ message: "Missing data" });

    const parsed = JSON.parse(data);
    const {
      auditId,
      responses = [],
      status,
      fssai_number,
      auditee_name, // Added
      fostac_person, // Added
      fostac_certificate_number, // Added
      fostac_certificate_validity, // Added
      fssai_file,
      inspectedProducts = [],
      equipmentUsed = [],
      suggestions = [],
    } = parsed;

    // VERIFICATION: Log file compression status before upload
    files.forEach((file) => {
      console.log(`📄 File to upload: ${file.originalname}`);
      console.log(`   Compressed: ${file.compressed ? "YES" : "NO"}`);
      console.log(`   Size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      if (file.compressed && file.originalSize) {
        const reduction = (
          ((file.originalSize - file.size) / file.originalSize) *
          100
        ).toFixed(2);
        console.log(`   Compression reduction: ${reduction}%`);
      }
    });

    /* ---------- 1. Upload images to S3 ---------- */
    const uploaded = {};
    for (const file of files) {
      const key = `audit-images/${Date.now()}-${file.originalname}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );
      uploaded[
        file.originalname
      ] = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }

    /* ---------- 2. Save individual question responses ---------- */
    // const saved = await Promise.all(
    //   responses.map(({ questionId, comment, marks, file }) =>
    //     new AuditResponse({
    //       audit: auditId,
    //       question: questionId,
    //       comment,
    //       marks,
    //       image_url: file ? uploaded[file] || "" : "",
    //     }).save()
    //   )
    // );


    /* ---------- 2. Save individual question responses ---------- */

    let totalObtained = 0;
    let totalMaximum = 0;

    const saved = await Promise.all(
      responses.map(async ({ questionId, comment, marks, file }) => {
        // Get question to know maximum marks
        const question = await Question.findById(questionId);

        const maxMark = question?.marks || 0;
        const obtainedMark = Number(marks) || 0;

        totalMaximum += maxMark;
        totalObtained += obtainedMark;

        return new AuditResponse({
          audit: auditId,
          question: questionId,
          comment,
          marks: obtainedMark,
          image_url: file ? uploaded[file] || "" : "",
        }).save();
      })
    );

    // Calculate credit score percentage
    const creditScore =
      totalMaximum > 0
        ? ((totalObtained / totalMaximum) * 100).toFixed(2)
        : 0;

    /* ---------- 3. Update/Create audit document ---------- */
    const audit = await AuditManagement.findById(auditId);
    if (!audit) throw new Error("Audit not found");
    console.log("Before " + audit.suggestions);

    audit.status = status;
    audit.statusHistory.push({ status, changedAt: new Date() });
    audit.fssai_number = fssai_number;
    audit.auditee_name = auditee_name; // Added
    audit.fostac_person = fostac_person; // Added
    audit.fostac_certificate_number = fostac_certificate_number; // Added
    audit.fostac_certificate_validity = fostac_certificate_validity; // Added
    audit.inspectedProducts = inspectedProducts;
    audit.equipmentUsed = equipmentUsed;
    audit.suggestions = suggestions;
    console.log("After " + audit.suggestions);

    if (fssai_file) {
      audit.fssai_image_url = uploaded[fssai_file] || "";
    }
    audit.total_score = totalObtained;
    audit.maximum_score = totalMaximum;
    audit.credit_score = Number(creditScore);

    await audit.save();

    res.status(200).json({
      message: "Audit responses saved successfully.",
      data: saved,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// ---------- UPDATE EXISTING RESPONSES ----------
// export const updateAuditResponses = async (req, res) => {
//   try {
//     const { data } = req.body;
//     const files = req.files || [];

//     if (!data) return res.status(400).json({ message: "Missing data" });

//     const parsed = JSON.parse(data);
//     const { auditId, responses = [] } = parsed;

//     /* ---------- 1. handle image replacements ---------- */
//     const uploaded = {};
//     for (const file of files) {
//       const key = `audit-images/${Date.now()}-${file.originalname}`;
//       await s3Client.send(
//         new PutObjectCommand({
//           Bucket: bucketName,
//           Key: key,
//           Body: file.buffer,
//           ContentType: file.mimetype,
//         })
//       );
//       uploaded[
//         file.originalname
//       ] = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
//     }

//     /* ---------- 2. update each question response ---------- */
//     const updated = [];
//     for (const { questionId, comment, selectedMark, file } of responses) {
//       const existing = await AuditResponse.findOne({
//         audit: auditId,
//         question: questionId,
//       });
//       if (!existing) continue;

//       let img = existing.image_url;
//       if (file && !file.startsWith(`https://${bucketName}`)) {
//         const f = files.find((f) => f.originalname === file);
//         if (f) img = uploaded[f.originalname] || img;
//       }

//       await AuditResponse.updateOne(
//         { audit: auditId, question: questionId },
//         { $set: { comment, marks: selectedMark, image_url: img } }
//       );

//       updated.push({ questionId, comment, selectedMark, image_url: img });
//     }

//     /* ---------- 3. optionally update arrays on audit doc ---------- */
//     // If the FE also sends them during an update, uncomment below:
//     // await AuditManagement.findByIdAndUpdate(auditId, {
//     //   inspectedProducts: parsed.inspectedProducts || [],
//     //   equipmentUsed: parsed.equipmentUsed || [],
//     // });

//     res.status(200).json({
//       message: "Audit responses updated successfully.",
//       data: updated,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: err.message });
//   }
// };
export const updateAuditResponses = async (req, res) => {
  try {
    const { data } = req.body;
    console.log(data);
    const files = req.files || [];

    if (!data) return res.status(400).json({ message: "Missing data" });

    const parsed = JSON.parse(data);
    const {
      auditId,
      responses = [],
      deletedFiles = [],
      suggestions = [],
    } = parsed;

    // VERIFICATION: Log file compression status before upload
    files.forEach((file) => {
      console.log(`📄 File to upload: ${file.originalname}`);
      console.log(`   Compressed: ${file.compressed ? "YES" : "NO"}`);
      console.log(`   Size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      if (file.compressed && file.originalSize) {
        const reduction = (
          ((file.originalSize - file.size) / file.originalSize) *
          100
        ).toFixed(2);
        console.log(`   Compression reduction: ${reduction}%`);
      }
    });

    // 1 Handle file uploads
    const uploaded = {};
    for (const file of files) {
      const key = `audit-images/${Date.now()}-${file.originalname}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );
      uploaded[
        file.originalname
      ] = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }

    if (suggestions && Array.isArray(suggestions)) {
      console.log(`📝 Updating suggestions for audit ${auditId}:`, suggestions);
      await AuditManagement.findByIdAndUpdate(auditId, {
        $set: { suggestions: suggestions },
        $push: {
          modificationHistory: {
            modifiedAt: new Date(),
          },
        },
      });
      console.log(
        ` Updated ${suggestions.length} suggestions for audit ${auditId}`
      );
    }

    // 2 Handle each question response
    const updated = [];
    for (const { questionId, comment, selectedMark, file } of responses) {
      const existing = await AuditResponse.findOne({
        audit: auditId,
        question: questionId,
      });
      if (!existing) continue;

      let img = existing.image_url;

      // If file is in uploaded (new upload) -> replace
      if (file && uploaded[file]) {
        img = uploaded[file];
      }

      // If questionId is in deletedFiles -> remove file
      if (deletedFiles.includes(questionId)) {
        if (img) {
          // Delete old file from S3
          const key = img.split(`.amazonaws.com/`)[1]; // extract S3 key
          if (key) {
            try {
              await s3Client.send(
                new DeleteObjectCommand({
                  Bucket: bucketName,
                  Key: key,
                })
              );
            } catch (err) {
              console.error("S3 delete error:", err);
            }
          }
        }
        img = null; // clear the image
      }

      await AuditResponse.updateOne(
        { audit: auditId, question: questionId },
        { $set: { comment, marks: selectedMark, image_url: img } }
      );

      updated.push({ questionId, comment, selectedMark, image_url: img });
    }
    // 3 Recalculate total score after update

    const allResponses = await AuditResponse.find({ audit: auditId });

    let totalObtained = 0;
    let totalMaximum = 0;

    for (const response of allResponses) {
      const question = await Question.findById(response.question);

      const maxMark = question?.marks || 0;
      const obtainedMark = Number(response.marks) || 0;

      totalMaximum += maxMark;
      totalObtained += obtainedMark;
    }

    const creditScore =
      totalMaximum > 0
        ? ((totalObtained / totalMaximum) * 100).toFixed(2)
        : 0;

    // Update audit document with new scores
    await AuditManagement.findByIdAndUpdate(auditId, {
      total_score: totalObtained,
      maximum_score: totalMaximum,
      credit_score: Number(creditScore),
    });

    res.status(200).json({
      message: "Audit responses updated successfully.",
      data: updated,
      suggestionsUpdated: suggestions && suggestions.length > 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

export const fetchingQuestionAnswer = async (req, res) => {
  try {
    const { auditId } = req.params;
    const { checkListId } = req.query;

    if (!auditId) {
      return res.status(400).json({ message: "Audit ID is required" });
    }

    const auditManagement = await AuditManagement.findById(auditId);
    const suggestions = auditManagement.suggestions;

    const labels = await Label.find({ checklistCategory: checkListId });
    // console.log(labels);

    const data = await Promise.all(
      labels
        .sort((a, b) => a.position - b.position)
        .map(async (label) => {
          const questions = await Question.find({ label: label._id });

          const questionsWithAnswers = await Promise.all(
            questions.map(async (question, index) => {
              const auditResponse = await AuditResponse.findOne({
                audit: auditId,
                question: question._id,
              });

              return {
                questionId: question._id,
                // description: `${index + 1}. ${question.question_text}`,
                description: question.question_text,
                mark: question.marks,
                comment: auditResponse?.comment || "",
                marks: auditResponse?.marks || "",
                image_url: auditResponse?.image_url || "",
                position: question.position,
              };
            })
          );

          // console.log(questionsWithAnswers);

          return {
            title: label.name,
            questions: questionsWithAnswers,
          };
        })
    );

    res.status(200).json({
      data,
      suggestions,
    });
  } catch (error) {
    console.error(
      "Error fetching questions and audit responses:",
      error.message
    );
    res
      .status(500)
      .json({ message: "Failed to fetch data", error: error.message });
  }
};

export const getUserNameById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ userName: user.userName });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateStartedDate = async (req, res) => {
  console.log(req.body);
  const { audit_id, checkListId } = req.body;

  try {
    const currentDateTime = moment().toISOString();

    const updatedAuditManagement = await AuditManagement.findByIdAndUpdate(
      audit_id,
      {
        started_at: currentDateTime,
        checklistCategory: checkListId,
      },
      { new: true, runValidators: true }
    );

    if (!updatedAuditManagement) {
      return res
        .status(404)
        .json({ message: "AuditManagement record not found" });
    }

    res.status(200).json({
      message: "AuditManagement started_at updated successfully",
      data: updatedAuditManagement,
    });
  } catch (error) {
    console.error("Error updating started_at:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

export const deleteAuditById = async (req, res) => {
  const { id } = req.params;

  try {
    const audit = await AuditManagement.findById(id);

    if (!audit) {
      return res.status(404).json({ message: "Audit not found" });
    }

    const auditResponses = await AuditResponse.find({ audit: id });

    await Promise.all(
      auditResponses.map(async (response) => {
        if (
          response.image_url &&
          response.image_url.startsWith(`https://${bucketName}.s3.`)
        ) {
          const fileKey = response.image_url.split(`/${bucketName}/`)[1];
          try {
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket: bucketName,
                Key: fileKey,
              })
            );
            console.log("Deleted image from S3:", fileKey);
          } catch (error) {
            console.error("Error deleting image from S3:", error.message);
          }
        }
      })
    );

    if (
      audit.fssai_image_url &&
      audit.fssai_image_url.startsWith(`https://${bucketName}.s3.`)
    ) {
      const fileKey = audit.fssai_image_url.split(`/${bucketName}/`)[1];
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
          })
        );
        console.log("Deleted FSSAI image from S3:", fileKey);
      } catch (error) {
        console.error("Error deleting FSSAI image from S3:", error.message);
      }
    }

    const responseDeleteResult = await AuditResponse.deleteMany({ audit: id });
    const auditDeleteResult = await AuditManagement.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Audit and associated responses deleted successfully",
      auditDeleted: auditDeleteResult,
      responsesDeletedCount: responseDeleteResult.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting audit:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};

// export const updateFssaiDetails = async (req, res) => {
//   console.log(req.body);
//   const {
//     fssai_number,
//     audit_id,
//     deleteImage,
//     auditee_name, // Added
//     fostac_person, // Added
//     fostac_certificate_number, // Added
//     fostac_certificate_validity, // Added
//     inspectedProducts, // Added
//     equipmentUsed, // Added
//   } = req.body;

//   try {
//     if (!audit_id) {
//       return res.status(400).json({ message: "Audit ID is required." });
//     }

//     const existingRecord = await AuditManagement.findById(audit_id);
//     if (!existingRecord) {
//       return res.status(404).json({ message: "FSSAI record not found." });
//     }

//     // Handle image deletion
//     if (deleteImage === "true" && existingRecord.fssai_image_url) {
//       try {
//         const fileKey = existingRecord.fssai_image_url.split(
//           `/${bucketName}/`
//         )[1];
//         await s3Client.send(
//           new DeleteObjectCommand({
//             Bucket: bucketName,
//             Key: fileKey,
//           })
//         );
//         console.log("Deleted existing FSSAI image from S3:", fileKey);
//         existingRecord.fssai_image_url = "";
//       } catch (error) {
//         console.error("Error deleting FSSAI image from S3:", error.message);
//         return res.status(500).json({ message: "Image deletion failed." });
//       }
//     }

//     // Handle new image upload
//     let uploadedImageUrl = "";
//     if (req.file && req.file.buffer) {
//       try {
//         const timestamp = Date.now();
//         const fileName = `audit-images/${timestamp}-${req.file.originalname}`;

//         const params = {
//           Bucket: bucketName,
//           Key: fileName,
//           Body: req.file.buffer,
//           ContentType: req.file.mimetype,
//         };

//         await s3Client.send(new PutObjectCommand(params));
//         uploadedImageUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
//         console.log("Uploaded new FSSAI image to S3:", uploadedImageUrl);
//       } catch (uploadError) {
//         console.error("Error uploading FSSAI image to S3:", uploadError);
//         return res.status(500).json({ message: "File upload failed." });
//       }
//     }

//     // Prepare update data with all fields
//     const updateData = {
//       fssai_number: fssai_number || existingRecord.fssai_number,
//       auditee_name: auditee_name || existingRecord.auditee_name,
//       fostac_person: fostac_person || existingRecord.fostac_person,
//       fostac_certificate_number:
//         fostac_certificate_number || existingRecord.fostac_certificate_number,
//       fostac_certificate_validity:
//         fostac_certificate_validity ||
//         existingRecord.fostac_certificate_validity,
//     };

//     // Handle inspected products array
//     if (inspectedProducts) {
//       try {
//         const parsedProducts = JSON.parse(inspectedProducts);
//         updateData.inspectedProducts = Array.isArray(parsedProducts)
//           ? parsedProducts
//           : [];
//       } catch (error) {
//         console.error("Error parsing inspectedProducts:", error);
//         updateData.inspectedProducts = existingRecord.inspectedProducts || [];
//       }
//     }

//     // Handle equipment used array
//     if (equipmentUsed) {
//       try {
//         const parsedEquipment = JSON.parse(equipmentUsed);
//         updateData.equipmentUsed = Array.isArray(parsedEquipment)
//           ? parsedEquipment
//           : [];
//       } catch (error) {
//         console.error("Error parsing equipmentUsed:", error);
//         updateData.equipmentUsed = existingRecord.equipmentUsed || [];
//       }
//     }

//     // Handle image URL updates
//     if (uploadedImageUrl) {
//       updateData.fssai_image_url = uploadedImageUrl;
//     } else if (deleteImage === "true") {
//       updateData.fssai_image_url = "";
//     }

//     const updatedRecord = await AuditManagement.findByIdAndUpdate(
//       audit_id,
//       updateData,
//       { new: true }
//     );

//     return res.status(200).json({
//       message: "FSSAI details updated successfully.",
//       data: updatedRecord, // Changed from updatedRecord to data for consistency
//     });
//   } catch (err) {
//     console.error("Error updating FSSAI details:", err);
//     return res.status(500).json({
//       message: "An error occurred while updating FSSAI details.",
//       error: err.message,
//     });
//   }
// };
export const updateFssaiDetails = async (req, res) => {
  console.log("updateFssaiDetails: req.body =", req.body);

  if (req.file) {
    console.log(`File received: ${req.file.originalname}`);
    console.log(`File type: ${req.file.mimetype}`);
    console.log(`File size: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`);
    if (req.file.compressed) {
      console.log(
        `File compressed from ${(req.file.originalSize / 1024 / 1024).toFixed(
          2
        )}MB`
      );
    }
  }

  const {
    fssai_number,
    audit_id,
    deleteImage,
    auditee_name,
    fostac_person,
    fostac_certificate_number,
    fostac_certificate_validity,
    inspectedProducts,
    equipmentUsed,
  } = req.body;

  if (!audit_id) {
    return res.status(400).json({ message: "Audit ID is required." });
  }

  try {
    const existingRecord = await AuditManagement.findById(audit_id);
    if (!existingRecord) {
      return res.status(404).json({ message: "FSSAI record not found." });
    }

    // helper to compute S3 key robustly from a public URL
    const deriveS3KeyFromUrl = (fileUrl) => {
      if (!fileUrl) return null;
      try {
        // remove querystring and use pathname
        const parsed = new URL(fileUrl);
        // pathname begins with '/'
        let path = parsed.pathname || "";
        // If virtual-hosted style: https://bucket.s3.region.amazonaws.com/key -> pathname = /key
        // If path-style: https://s3.region.amazonaws.com/bucket/key -> pathname = /bucket/key
        // If your URL contains bucketName as a segment, remove it
        const bucketSegment = `/${bucketName}/`;
        if (path.startsWith(bucketSegment)) {
          path = path.slice(bucketSegment.length);
        } else if (path.startsWith("/")) {
          // remove leading slash
          path = path.slice(1);
        }
        // decode in case there are encoded chars
        return decodeURIComponent(path);
      } catch (err) {
        // fallback: naive split by bucket name, then last two segments
        try {
          if (fileUrl.includes(`/${bucketName}/`)) {
            return fileUrl.split(`/${bucketName}/`)[1].split(/[?#]/)[0];
          }
          // last-chance: everything after the last '/'
          return fileUrl.split("/").slice(-2).join("/").split(/[?#]/)[0];
        } catch (e) {
          return null;
        }
      }
    };

    // handle deleteImage flag (delete existing server file)
    if (deleteImage === "true" && existingRecord.fssai_image_url) {
      const fileUrl = existingRecord.fssai_image_url;
      const fileKey = deriveS3KeyFromUrl(fileUrl);

      if (!fileKey) {
        console.error("Could not derive S3 key from URL:", fileUrl);
        return res
          .status(500)
          .json({ message: "Failed to determine S3 object key for deletion." });
      }

      console.log(
        "Attempting to delete S3 object. bucket:",
        bucketName,
        " key:",
        fileKey
      );

      try {
        // OPTIONAL: verify the object exists (helps debug permission vs not-found)
        // Comment this out in production if you want fewer requests.
        /*
        try {
          await s3Client.send(new HeadObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
          }));
          console.log("HeadObject: object exists for key:", fileKey);
        } catch (headErr) {
          console.warn("HeadObject failed (object may not exist or no permission):", headErr.message);
        }
        */

        const deleteRes = await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
          })
        );

        console.log("DeleteObject returned:", deleteRes);
        // set model field to empty string on success
        existingRecord.fssai_image_url = "";
      } catch (error) {
        console.error("Error deleting FSSAI image from S3:", error);
        // return useful error info to client
        return res.status(500).json({
          message: "Image deletion failed.",
          error: error?.message || error,
        });
      }
    }

    // Handle new image upload (if any)
    let uploadedImageUrl = "";
    if (req.file && req.file.buffer) {
      try {
        const timestamp = Date.now();
        const safeName = (req.file.originalname || "file").replace(/\s+/g, "-");
        const fileName = `audit-images/${timestamp}-${safeName}`;

        // VERIFICATION: Log before S3 upload
        console.log(`⬆️ Uploading FSSAI file to S3:`);
        console.log(`   Key: ${fileName}`);
        console.log(`   Compressed: ${req.file.compressed ? "YES" : "NO"}`);
        console.log(
          `   Upload size: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`
        );

        const params = {
          Bucket: bucketName,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        };

        await s3Client.send(new PutObjectCommand(params));
        uploadedImageUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
        console.log("Uploaded new FSSAI image to S3:", uploadedImageUrl);
      } catch (uploadError) {
        console.error("Error uploading FSSAI image to S3:", uploadError);
        return res.status(500).json({
          message: "File upload failed.",
          error: uploadError?.message || uploadError,
        });
      }
    }

    // Prepare update data
    const updateData = {
      fssai_number: fssai_number || existingRecord.fssai_number,
      auditee_name: auditee_name || existingRecord.auditee_name,
      fostac_person: fostac_person || existingRecord.fostac_person,
      fostac_certificate_number:
        fostac_certificate_number || existingRecord.fostac_certificate_number,
      fostac_certificate_validity:
        fostac_certificate_validity ||
        existingRecord.fostac_certificate_validity,
    };

    // handle arrays
    if (inspectedProducts) {
      try {
        const parsedProducts = JSON.parse(inspectedProducts);
        updateData.inspectedProducts = Array.isArray(parsedProducts)
          ? parsedProducts
          : [];
      } catch (err) {
        console.error("Error parsing inspectedProducts:", err);
        updateData.inspectedProducts = existingRecord.inspectedProducts || [];
      }
    }
    if (equipmentUsed) {
      try {
        const parsedEquipment = JSON.parse(equipmentUsed);
        updateData.equipmentUsed = Array.isArray(parsedEquipment)
          ? parsedEquipment
          : [];
      } catch (err) {
        console.error("Error parsing equipmentUsed:", err);
        updateData.equipmentUsed = existingRecord.equipmentUsed || [];
      }
    }

    // set image URL if uploaded or cleared if deleteImage flag
    if (uploadedImageUrl) {
      updateData.fssai_image_url = uploadedImageUrl;
    } else if (deleteImage === "true") {
      updateData.fssai_image_url = "";
    }

    const updatedRecord = await AuditManagement.findByIdAndUpdate(
      audit_id,
      updateData,
      { new: true }
    );

    return res.status(200).json({
      message: "FSSAI details updated successfully.",
      data: updatedRecord,
    });
  } catch (err) {
    console.error("Error updating FSSAI details:", err);
    return res.status(500).json({
      message: "An error occurred while updating FSSAI details.",
      error: err.message || err,
    });
  }
};

const getDateRanges = (filter) => {
  switch (filter) {
    case "today":
      return {
        start: moment().startOf("day").toDate(),
        end: moment().endOf("day").toDate(),
      };
    case "week":
      return {
        start: moment().startOf("week").toDate(),
        end: moment().endOf("week").toDate(),
      };
    case "month":
      return {
        start: moment().startOf("month").toDate(),
        end: moment().endOf("month").toDate(),
      };
    case "overall":
      return null;
    default:
      throw new Error("Invalid filter");
  }
};

export const auditManagementCount = async (req, res) => {
  try {
    const { filter } = req.query;

    const dateRange = getDateRanges(filter);

    let count;
    const query = { "statusHistory.status": "approved" };

    if (dateRange) {
      query.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
    }

    count = await AuditManagement.countDocuments(query);

    console.log("Count result:", count);

    return res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Error counting audit management records:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to count audit management records",
      error: error.message,
    });
  }
};

export const getAuditorAuditCounts = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, keyword } = req.query;

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

    const matchFilter = {
      status: { $ne: "assigned" },
    };

    if (keyword) {
      const searchRegex = new RegExp(keyword, "i");
      matchFilter["userName"] = searchRegex;
    }

    const pipeline = [
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $addFields: {
          lastStatus: { $arrayElemAt: ["$statusHistory", -1] },
        },
      },
      {
        $group: {
          _id: "$user.userName",
          totalAssigned: {
            $sum: {
              $cond: [{ $eq: [{ $size: "$statusHistory" }, 0] }, 1, 0],
            },
          },
          totalDraft: {
            $sum: {
              $cond: [{ $eq: ["$lastStatus.status", "draft"] }, 1, 0],
            },
          },
          totalModified: {
            $sum: {
              $cond: [{ $eq: ["$lastStatus.status", "modified"] }, 1, 0],
            },
          },
          totalSubmitted: {
            $sum: {
              $cond: [{ $eq: ["$lastStatus.status", "submitted"] }, 1, 0],
            },
          },
          totalApproved: {
            $sum: {
              $cond: [{ $eq: ["$lastStatus.status", "approved"] }, 1, 0],
            },
          },
          totalStarted: {
            $sum: {
              $cond: [{ $eq: ["$lastStatus.status", "started"] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          userName: "$_id",
          totalAssigned: 1,
          totalDraft: 1,
          totalModified: 1,
          totalSubmitted: 1,
          totalApproved: 1,
          totalStarted: 1,
        },
      },
      {
        $skip: (pageNumber - 1) * sizePerPage,
      },
      {
        $limit: sizePerPage,
      },
    ];

    const auditorCounts = await AuditManagement.aggregate(pipeline);
    const totalAuditors = await User.countDocuments({
      roles: { $in: ["AUDITOR"] },
    });

    res.json({
      total: totalAuditors,
      currentPage: pageNumber,
      data: auditorCounts,
    });
  } catch (error) {
    console.error("Error fetching auditor audits:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateStepStatus = async (req, res) => {
  console.log("Received request body:", req.body);

  try {
    const { audit_id, stepsStatus, physical_date } = req.body;

    if (!audit_id) {
      console.error("Bad Request: Missing audit_id");
      return res
        .status(400)
        .json({ success: false, message: "Audit ID is required." });
    }

    if (!stepsStatus) {
      console.error("Bad Request: Missing stepsStatus");
      return res
        .status(400)
        .json({ success: false, message: "Step status is required." });
    }

    const updateData = { stepsStatus };

    updateData.physical_date = physical_date;

    const updatedAudit = await AuditManagement.findOneAndUpdate(
      { _id: audit_id },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedAudit) {
      console.error("Bad Request: Audit not found", { audit_id });
      return res
        .status(404)
        .json({ success: false, message: "Audit not found." });
    }

    console.log("Step status updated successfully:", updatedAudit);
    return res.status(200).json({
      success: true,
      message: "Step status updated successfully.",
      data: updatedAudit,
    });
  } catch (error) {
    console.error("Internal Server Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error." });
  }
};

export const getUserAuditSummary = async (req, res) => {
  try {
    const { id } = req.params; // userId from params

    // 1) Pull every audit where audit.user == id (ignore only "assigned")
    const pipeline = [
      {
        $match: {
          user: new mongoose.Types.ObjectId(id),
        },
      },

      // 3) group by status
      {
        $group: {
          _id: "$status",
          audits: { $push: "$$ROOT" },
        },
      },

      // 4) fold groups into one object:  { status: [audits], ... }
      {
        $group: {
          _id: null,
          grouped: {
            $mergeObjects: {
              $arrayToObject: [[{ k: "$_id", v: "$audits" }]],
            },
          },
        },
      },
      { $replaceRoot: { newRoot: "$grouped" } },
    ];

    const [data] = await AuditManagement.aggregate(pipeline);
    let totalAudits = 0;
    Object.keys(data).forEach((key) => (totalAudits += data[key].length));

    // 5) if no audits matched, send empty object
    const result = data || {};

    return res.status(200).json({ success: true, data: result, totalAudits });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// new controller 


export const exportAuditsByAuditors = async (req, res) => {
  try {
    const { auditorIds, startDate, endDate } = req.body;

    if (!auditorIds || !Array.isArray(auditorIds) || auditorIds.length === 0) {
      return res.status(400).json({ message: "Auditor IDs are required" });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required" });
    }

    // ✅ OVERALL ASSIGNED DATE FILTER
    const assignedDateFilter = {
      $gte: new Date(`${startDate}T00:00:00.000Z`),
      $lte: new Date(`${endDate}T23:59:59.999Z`),
    };

    const audits = await AuditManagement.find({
      user: { $in: auditorIds },
      assigned_date: assignedDateFilter,
    })
      .populate("user", "userName")
      .sort({ assigned_date: 1 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Audits");

    sheet.columns = [
      { header: "Auditor Name", key: "auditor", width: 25 },
      { header: "Audit Number", key: "audit_number", width: 15 },
      { header: "Proposal Number", key: "proposal_number", width: 20 },
      { header: "FBO Name", key: "fbo_name", width: 25 },
      { header: "Outlet Name", key: "outlet_name", width: 25 },
      { header: "Status", key: "status", width: 15 },
      { header: "Assigned Date", key: "assigned_date", width: 18 },
      { header: "Location", key: "location", width: 25 },
      { header: "Service", key: "service", width: 20 },
      { header: "Created At", key: "createdAt", width: 20 },
    ];

    audits.forEach((audit) => {
      sheet.addRow({
        auditor: audit.user?.userName || "",
        audit_number: audit.audit_number,
        proposal_number: audit.proposal_number,
        fbo_name: audit.fbo_name,
        outlet_name: audit.outlet_name,
        status: audit.status,
        assigned_date: audit.assigned_date
          ? new Date(audit.assigned_date).toLocaleDateString()
          : "",
        location: audit.location,
        service: audit.service,
        createdAt: new Date(audit.createdAt).toLocaleString(),
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Audit_Report_${startDate}_to_${endDate}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export audit error:", error);
    res.status(500).json({ message: "Failed to export audits" });
  }
};



