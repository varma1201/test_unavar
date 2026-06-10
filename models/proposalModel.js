import mongoose from "mongoose";

const { Schema, model } = mongoose;

const outletSchema = new Schema({
  outlet_name: {
    type: String,
    required: true,
  },
  man_days: {
    type: Number,
    default: 0,
  },
  city: {
    type: String,
  },
  description: {
    type: String,
  },
  unit: {
    type: Number,
  },
  no_of_production_line: {
    type: Number,
    default: 0,
  },
  quantity: {
    type: Number,
    default: 0,
  },
  unit_cost: {
    type: Number,
    default: 0,
  },
  amount: {
    type: Number,
    default: 0,
  },
  type_of_industry: {
    type: String,
    enum: ["Catering", "Manufacturing", "Trade and Retail", "Transportation"],
  },
  is_invoiced: {
    type: Boolean,
    default: false,
  },
  is_agreement: {
    type: Boolean,
    default: false,
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
  is_assignedAuditor: {
    type: Boolean,
    default: false,
  },
});

const proposalSchema = new Schema(
  {
    enquiryId: {
      type: Schema.Types.ObjectId,
      ref: "Enquiry", // Correct reference to the Enquiry model
      required: true,
    },
    representative: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fbo_name: {
      type: String,
    },
    proposal_date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "Mail not sent",
        "Mail Sent",
        "Partial Invoiced",
        "Sale closed",
        "Dropped",
        "Pending",
      ],
      default: "Mail not sent",
      required: true,
    },
    proposal_number: {
      type: String,
      required: true,
      unique: true,
    },
    address: {
      line1: {
        type: String,
        required: true,
      },
      line2: {
        type: String,
        required: false,
      },
    },
    gst_number: {
      type: String,
      // required: true,
    },
    contact_person: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    outlets: {
      type: [outletSchema],
      required: true,
    },
    pincode: {
      type: Number,
      required: true,
    },
    message: {
      type: String,
    },
    same_state: {
      type: Boolean,
      require: true,
    },
    note: {
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
      required: true, // Add this if the field is mandatory
    },
    customer_type: {
      type: String,
      enum: ["MOU", "Non-MOU"],
    },
    po_number: {
      type: String,
    },
    type_of_industry: {
      type: String,
      enum: ["Catering", "Manufacturing", "Trade and retail", "Transportation"],
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
    auditor_convenience_fee: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Proposal = model("Proposal", proposalSchema);

export default Proposal;
