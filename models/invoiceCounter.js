import mongoose from "mongoose";

const invoiceCounterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  value: { type: Number, required: true },
});

const InvoiceCounter = mongoose.model("InvoiceCounter", invoiceCounterSchema);

export default InvoiceCounter;
