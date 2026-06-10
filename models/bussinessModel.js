import mongoose from "mongoose";

const { Schema, model } = mongoose;

const businessSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  contact_person: {
    type: String,
    required: true,
  },
  type_of_industry: {
    type: [String],
    enum: ["Catering", "Manufacturing", "Trade and retail", "Transportation"],
  },
  vertical_of_industry: {
    type: [String],
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
  fssai_license_number: {
    type: String,
  },
  phone: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  gst_number: {
    type: String,
  },
  address: {
    line1: { type: String },
    line2: { type: String },
    state: { type: String },
    city: { type: String },
    pincode: { type: String },
  },
  added_by: {
    type: String,
    enum: ["Manual", "Web Enquiry", "Client Form", "Form"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: null,
  },
  gst_enable: {
    type: Boolean,
    default: false,
  },
  place_of_supply: {
    type: String,
  },
  customer_type: {
    type: String,
    enum: ["MOU", "Non-MOU"],
  },
  po_number: {
    type: String,
  },
});

const Business = model("Business", businessSchema);

export default Business;
