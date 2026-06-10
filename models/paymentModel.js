import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
      index: true, // ✅ Faster lookups
    },
    auditorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // ✅ Faster lookups
    },
    amountReceived: {
      type: Number,
      required: true,
      min: 0, // ✅ Ensures non-negative values
    },
    referenceDocument: {
      type: String,
      required: true,
    },
    referenceNumber: {
      type: String,
      required: true,
      uppercase: true, // ✅ Standardize format
      trim: true,
    },
    status: {
      type: String,
      enum: ["accepted", "rejected", "pending", "other"],
      required: true,
    },
  },
  { timestamps: true } // ✅ Automatically adds createdAt & updatedAt
);

export default mongoose.model("Payment", paymentSchema);
