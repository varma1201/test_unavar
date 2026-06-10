import mongoose from "mongoose";

const { Schema, model } = mongoose;

const BankDetailSchema = new Schema({
  bank_name: {
    type: String,
  },
  account_holder_name: {
    type: String,
  },
  account_number: {
    type: String,
  },
  ifsc_code: {
    type: String,
  },
  micr_code: {
    type: String,
  },
  branch_name: {
    type: String,
  },
});

const BankDetail = model("BankDetail", BankDetailSchema);

export default BankDetail;
