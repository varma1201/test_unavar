// models/WorkLog.js
import mongoose from "mongoose";

const workLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    workType: {
      type: String,
      enum: [
        "audit",
        "wfh",
        "office",
        "onDuty",
        "absent",
        "leave",
        "permission",
      ],
      required: true,
    },
    leaveMode: {
      type: String,
      enum: ["FULL_DAY", "HALF_DAY", "PERMISSION"],
    },

    permissionHours: {
      type: Number,
      default: 0,
    },
    permissionDate: {
      type: Date,
      required: function () {
        return this.workType === "permission";
      },
    },
    fromDate: {
      type: Date,
      required: function () {
        return this.workType === "leave";
      },
    },
    toDate: {
      type: Date,
      required: function () {
        return this.workType === "leave";
      },
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    workDate: {
      type: Date,
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    leaveType: {
      type: String,
      enum: ["sickLeave", "casualLeave", "lop", "compensationLeave"],
    },
    leaveStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      required: function () {
        return ["leave", "permission"].includes(this.workType);
      },
    },
    reason: {
      type: String,
      required: function () {
        return ["leave", "permission"].includes(this.workType);
      },
    },
    leaveDays: {
      type: Number,
      default: 0,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lopDays: {
      type: Number,
      default: 0,
    },
    isLOP: {
      type: Boolean,
      default: false,
    },
    initiative: {
      type: String,
      enum: ["HR", "ERC", "BHOG", "CVM", "CSFH", "ERS", "TPA"],
    },
    mouType: {
      type: String,
      enum: ["Mou", "Non-Mou"],
    },
    auditNo: {
      type: Number,
      default: 0,
    },
    revenue: {
      type: Number,
      default: 0,
    },
    auditDetail: {
      type: String,
      trim: true,
    },
    proposalNumber: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const WorkLog = mongoose.model("WorkLog", workLogSchema);

export default WorkLog;
