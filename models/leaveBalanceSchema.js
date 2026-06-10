import mongoose from "mongoose";

const leaveBalanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    sickLeave: {
      type: Number,
      default: 12, // Yearly Sick Leave Quota
    },

    casualLeave: {
      type: Number,
      default: 12, // Yearly casual leave quota
    },

    sickLeaveAvailable: {
      type: Number,
      default: 12, // Available sick leave balance
    },

    casualLeaveAvailable: {
      type: Number,
      default: 12, // Available casual leave balance
    },

    sickLeaveTotalMonth: {
      type: Number,
      default: 0, // Cumulative total of sick leave taken
    },

    sickLeaveOverall: {
      type: Number,
      default: 0, // Overall sick leave taken
    },

    // COMPENSATION LEAVE
    compLeave: {
      type: Number,
      default: 0
    },
    compLeaveAvailable: {
      type: Number,
      default: 0
    },
    compLeaveUsed: {
      type: Number,
      default: 0
    },


    casualLeaveTotalMonth: {
      type: Number,
      default: 0, // Cumulative total of casual leave taken
    },
    casualLeaveOverall: {
      type: Number,
      default: 0, // Overall casual leave taken
    },
    sickTakenNextMonth: { type: Boolean, default: false },
    casualTakenNextMonth: { type: Boolean, default: false },

    lastMonthlyReset: { type: Date, default: null },
    lastFinancialYearReset: { type: Date, default: null },
  },
  { timestamps: true }
);

const LeaveBalance = mongoose.model("LeaveBalance", leaveBalanceSchema);

export default LeaveBalance;
