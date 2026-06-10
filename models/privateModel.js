import mongoose from "mongoose";

const { Schema, model } = mongoose;

const privateCompanySchema = new Schema({
  fssai_license_number: String,
  no_of_food_handlers: String,
  Vertical_of_industry: {
    type: String,
    enum: [
      "Star hotel",
      "Ethnic restaurant",
      "QSR",
      "Industrial catering",
      "Meat Retail",
      "Sweet Retail",
      "Bakery",
      "Restaurant",
      "Others",
    ],
  },
  contact_number: {
    type: String,
  },
  contact_person: {
    type: String,
  },
  gst_number: String,
});

const PrivateCompany = model("PrivateCompany", privateCompanySchema);

export default PrivateCompany;
