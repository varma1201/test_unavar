import mongoose from "mongoose";

const { Schema, model } = mongoose;

const outletSchema = new Schema(
  {
    _id: {
      type: String, 
    },
    outlet_name: {
      type: String,
      required: true,
    },
    man_days: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
    },
    service: {
      type: String,
    },
    quantity: {
      type: Number,
      default: 0,
    },
    unit_cost: {
      type: Number,
      default: 0,
    },
    amount: {
      type: Number,
      default: function () {
        return this.quantity * this.unit_cost;
      },
    },
  },
  { _id: false }
);

const agreementSchema = new Schema({
  fbo_name: {
    type: String,
  },
  no_of_outlets: {
    type: Number, 
  },
  total_cost: {
    type: Number, 
  },
  outlets: {
    type: [outletSchema],
    required: true,
  },
  address: {
    type: String
  },
  status: {
    type: String,
    enum: ["Mail not sent", "Mail Sent", "Audit Planned Done", "Hold"], 
    default: "Mail not sent",
    required: true,
  },
  message: {
    type: String,
  },
  from_date: {
    type: Date,
    required: true,
  },
  to_date: {
    type: Date,
    required: true,
  },
  period: {
    type: String,
    required: true
  },
  proposalId: {
    type: Schema.Types.ObjectId,
    ref: "Proposal",
    required: true,
  },
   
} ,{ timestamps: true } );

const Agreement = model("Agreement", agreementSchema);

export default Agreement;
