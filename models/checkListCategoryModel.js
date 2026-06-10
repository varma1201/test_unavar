import mongoose from "mongoose";

const { Schema } = mongoose;

// ChecklistCategory Schema
const CheckListCategorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true, // Ensures no extra spaces in the name
      // unique: true,
    },
    service: {
      type: String,
      required: true,
      trim: true, // Ensures no extra spaces in the name
      // unique: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

// Models
const CheckListCategory = mongoose.model(
  "CheckListCategory",
  CheckListCategorySchema
);

export default CheckListCategory;
