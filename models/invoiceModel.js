import mongoose from "mongoose";

const { Schema, model } = mongoose;

const outletSchema = new Schema(
  {
    _id: {
      type: String,
    },
    outlet_name: {
      type: String,
      required: true,
    },
    man_days: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
    },
    service: {
      type: String,
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
  },
  { _id: false }
); // Disable automatic ID creation

const invoiceSchema = new Schema(
  {
    fbo_name: {
      type: String,
      required: true,
    },
    invoice_date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Unpaid", "Paid", "Hold", "Void"],
      default: "Unpaid",
      required: true,
    },
    mail_status: {
      type: String,
      enum: ["Mail Sent", "Mail Not Sent"],
      default: "Mail Not Sent",
      required: true,
    },
    proposal_number: {
      type: String,
      required: true,
    },
    invoice_number: {
      type: String,
      required: true,
      unique: true,
    },
    place_of_supply: {
      type: String,
      required: true,
    },
    field_executive_name: {
      type: String,
      required: true,
    },
    team_leader_name: {
      type: String,
      required: true,
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
    phone: {
      type: Number,
      required: false,
    },
    email: {
      type: String,
      required: false,
    },
    pincode: {
      type: Number,
      required: false,
    },
    outlets: {
      type: [outletSchema],
      required: true,
    },
    message: {
      type: String,
    },
    same_state: {
      type: Boolean,
      require: true,
    },
    proposalId: {
      type: Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
    },
    gst_number: {
      type: String,
      // required: true,
    },
    remark: {
      type: String,
    },
    po_number:{
      type: String
    },
  },
  {
    timestamps: true,
  }
);

const Invoice = model("Invoice", invoiceSchema);

export default Invoice;
