import mongoose from "mongoose";

const auditCounterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  value: { type: Number, required: true },
});

const AuditCounter = mongoose.model("AuditCounter", auditCounterSchema);

export default AuditCounter;
