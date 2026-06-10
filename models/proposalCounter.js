
import mongoose from "mongoose";

const proposalCounterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  value: { type: Number, required: true },
});

const ProposalCounter = mongoose.model(
  "ProposalCounter",
  proposalCounterSchema
);

export default ProposalCounter;