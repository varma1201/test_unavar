import mongoose from "mongoose";

const { Schema, model } = mongoose;

const settingSchema = new Schema({
  proposal_note: {
    type: String,
  },
  invoice_note: {
    type: String,
  },
  proposal_email: {
    type: String,
  },
  invoice_email: {
    type: String,
  },
  agreement_email: {
    type: String,
  },
  formlink_email: {
    type: String,
  },
  proposal_cc: {
    type: [String],
  },
  invoice_cc: {
    type: [String], 
  },
  agreement_cc: {
    type: [String], 
  },
});

const Setting = model("Setting", settingSchema);

export default Setting;
