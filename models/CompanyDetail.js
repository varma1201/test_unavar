import mongoose from "mongoose";

const { Schema, model } = mongoose;

const CompanyDetailSchema = new Schema({
  company_name: {
    type: String,
  },
  company_address: {
    line1: {
      type: String,
    },
    line2: {
      type: String, // Address Line 2 is optional
    },
    state: {
      type: String,
    },
    city: {
      type: String,
    },
    pincode: {
      type: Number,
    },
  },
  contact_number: {
    type: String,
  },
  email: {
    type: String,
  },
  gstin: {
    type: String,
  },
  pan: {
    type: String,
  }
 
});

const CompanyDetail = model("CompanyDetail", CompanyDetailSchema);

export default CompanyDetail;
