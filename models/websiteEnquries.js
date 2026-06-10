import mongoose from "mongoose";

const { Schema, model } = mongoose;

const WebsiteEnquiresSchema = new Schema(
  {
    businessName: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    mobileNumber: {
      type: Number,
      required: true,
    },
    service: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isDeleted: {
      type: Boolean,
      enum: [true, false],
      default: false,
    },
  },
  { timestamps: true }
);

const WebsiteEnquires = model("WebsiteEnquires", WebsiteEnquiresSchema);

export default WebsiteEnquires;
