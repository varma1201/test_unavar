import mongoose from "mongoose";

const { Schema, model } = mongoose;

const questionariesSchema = new Schema(
  {
    existing_consultancy_name: {
      type: String,
      required: true,

    },
    fostac_agency_name: {
      type: String,
      required: true,
    
    },
    other_certifications: {
      type: String,

    },
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
  },
  { timestamps: true }
);

const Questionaries = model("Questionaries", questionariesSchema);

export default Questionaries;
