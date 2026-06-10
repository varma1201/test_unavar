import mongoose from "mongoose";

const { model, Schema } = mongoose;

const WebsiteCmsSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    originalLink: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const WebsiteCms = model("websiteCms", WebsiteCmsSchema);

export default WebsiteCms;
