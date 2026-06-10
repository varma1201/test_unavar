import mongoose from "mongoose";

const auditSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
    },
    outletId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    fbo_name: {
      type: String,
      required: true,
    },
    outlet_name: {
      type: String,
      required: true,
    },
    auditee_name: {
      // Added for auditeeName
      type: String,
    },
    fostac_person: {
      // Added for fostacPerson
      type: String,
    },
    fostac_certificate_number: {
      // Added for fostacCertificate
      type: String,
    },
    fostac_certificate_validity: {
      // Added for fostacCertificateValidity
      type: Date,
    },
    status: {
      type: String,
      enum: [
        "assigned",
        "started",
        "draft",
        "modified",
        "submitted",
        "approved",
        "rejected",
        "Physical Audit Completed",
        "Documentation Work On",
        "FSSAI Portal Updated",
      ],
      default: "assigned",
    },
    started_at: {
      type: Date,
    },
    checklistCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CheckListCategory",
    },
    customer_type: {
      type: String,
      enum: ["MOU", "Non-MOU"],
    },
    assigned_date: {
      type: Date,
      default: Date.now,
    },
    physical_date: {
      type: Date,
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: [
            "assigned",
            "started",
            "draft",
            "modified",
            "submitted",
            "approved",
            "rejected",
            "Physical Audit Completed",
            "Documentation Work On",
            "FSSAI Portal Updated",
          ],
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        comment: String,
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    stepsStatus: {
      type: String,
      enum: [
        "Not Started",
        "Physical Audit Completed",
        "Documentation Work On",
        "FSSAI Portal Updated",
      ],
      default: "Not Started",
    },
    modificationHistory: [
      {
        modifiedAt: {
          type: Date,
          default: Date.now,
        },
        modifiedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        stepChanges: {
          type: Map,
          of: String,
          default: {},
        },
        comment: {
          type: String,
        },
      },
    ],
    changes: {
      type: Map,
      of: String,
      default: {},
    },
    location: {
      type: String,
      required: true,
      // default: ""
    },
    audit_number: {
      type: String,
      required: true,
    },
    proposal_number: {
      type: String,
      required: true,
    },
    fssai_number: {
      type: String,
    },
    approver: {
      type: String,
    },
    inspectedProducts: [String], // Array of product names
    equipmentUsed: [String], // Array of equipment names
    fssai_image_url: {
      type: String,
    },
    service: {
      type: String,
      enum: [
        "TPA",
        "Hygiene Rating",
        "Eat Right Station",
        "Clean and Fresh Fruit and Vegetable Market",
        "Clean Street Food Hub",
        "Eat Right Campus",
        "BHOG (Blissful Hygienic Offering to God)",
      ],
      required: true,
    },
    type_of_industry: {
      type: String,
      enum: ["Catering", "Manufacturing", "Trade and Retail", "Transportation"],
    },
    vertical_of_industry: {
      type: String,
      enum: [
        "Sweet Shop",
        "Meat Retail",
        "Hub",
        "Market",
        "General Manufacturing",
        "Meat & Meat Processing",
        "Dairy Processing",
        "Catering",
        "Transportation",
        "Storage/Warehouse",
        "Institute Canteen",
        "Industrial Canteen",
        "Temple Kitchen",
        "Bakery",
        "Restaurant",
      ],
    },
    suggestions: {
      type: [String],
      default: [],
    },
    total_score: {
      type: Number,
      default: 0,
    },
    maximum_score: {
      type: Number,
      default: 0,
    },
    credit_score: {
      type: Number,
      default: 0,
    },

  },
  {
    timestamps: true,
  }
);

const AuditManagement = mongoose.model("AuditManagement", auditSchema);

export default AuditManagement;
