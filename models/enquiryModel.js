import mongoose from "mongoose";

const { Schema, model } = mongoose;

const enquirySchema = new Schema({
  business: {
    type: Schema.Types.ObjectId,
    ref: "Business",
    required: true,
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
  status: {
    type: String,
    enum: ["New Enquiry", "Proposal Done", "Dropped", "Mail Sent"],
  },
  isProposalDone: {
    type: Boolean,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: null,
  },
});

const Enquiry = model("Enquiry", enquirySchema);

export default Enquiry;
