import mongoose from "mongoose";

const AuditorPaymentSchema = new mongoose.Schema(
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
      min: 0, // ✅ Prevents negative values
    },
    referenceNumber: {
      type: String,
      required: true,
      uppercase: true, // ✅ Standardized format
      trim: true, // ✅ Avoids accidental spaces
    },
    referenceDocument: {
      type: String,
      required: true, // ✅ Ensures file is uploaded
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending", // ✅ Default status
    },
  },
  { timestamps: true } // ✅ Adds `createdAt` & `updatedAt`
);

const AuditorPayment = mongoose.model("AuditorPayment", AuditorPaymentSchema);
export default AuditorPayment;
