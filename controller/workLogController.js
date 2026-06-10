import WorkLog from "../models/workLogModel.js";
// import moment from "moment";
import moment from "moment-timezone";
import mongoose from "mongoose";
import LeaveBalance from "../models/leaveBalanceSchema.js";
import {
  istStartOfDay,
  istEndOfDay,
  istNow,
  istDateOnly,
} from "../utils/dateUtils.js";

// Create Work Log
export const createWorkLog = async (req, res) => {
  console.log(req.body);
  try {
    const {
      userId,
      workType,
      startTime,
      endTime,
      date,
      description,
      reason,
      paidLeave,
      sickLeave,
    } = req.body;

    // Validate required fields
    if (!userId || !workType) {
      return res.status(400).json({
        message: "userId, workType, startTime, and endTime are required",
      });
    }

    if (!date || !moment(date, "DD-MM-YYYY", true).isValid()) {
      return res.status(400).json({
        message: "Valid work date is required",
      });
    }

    const workDate = istStartOfDay(date);
    console.log("Work Date: ", workDate);
    // Check for overlapping work logs for the same user on the same day
    if (startTime && endTime) {
      const start = moment.tz(startTime, "Asia/Kolkata").toDate();
      const end = moment.tz(endTime, "Asia/Kolkata").toDate();
      console.log(start + "-" + end);

      if (start >= end) {
        return res.status(400).json({
          message: "Start time must be before end time",
        });
      }

      // const dayStart = istStartOfDay(moment(start).format("YYYY-MM-DD"));
      // const dayEnd = istEndOfDay(moment(start).format("YYYY-MM-DD"));

      const overlappingLog = await WorkLog.findOne({
        userId,
        workDate,
        startTime: { $lt: end },
        endTime: { $gt: start },
        // createdAt: { $gte: dayStart, $lte: dayEnd },
      });
      if (overlappingLog) {
        return res.status(400).json({
          message:
            "Work log overlaps with an existing entry for this day. Please choose a different time range.",
        });
      }
    }

    // Create a new work log entry
    const workLog = new WorkLog({
      userId,
      workType,
      workDate,
      startTime,
      endTime,
      description,
      reason,
      paidLeave,
      sickLeave,
    });

    await workLog.save();
    res.status(201).json({ message: "Work log created successfully", workLog });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating work log", error: error.message });
  }
};

// Update Work Log
// export const updateWorkLog = async (req, res) => {
//   console.log(req.body);
//   try {
//     const { id } = req.params;
//     const updateData = req.body;
//     const { role } = req.user || {};

//     const workLog = await WorkLog.findById(id);
//     if (!workLog) {
//       return res.status(404).json({ message: "Work log not found" });
//     }

//     if (role === "AUDITOR") {
//       const today = moment().startOf("day");
//       const yesterday = moment().subtract(1, "day").startOf("day");
//       const workLogDate = moment(workLog.createdAt).startOf("day");

//       // Check if work log is from today OR yesterday
//       const isToday = workLogDate.isSame(today, "day");
//       const isYesterday = workLogDate.isSame(yesterday, "day");

//       if (!isToday && !isYesterday) {
//         return res.status(403).json({
//           message:
//             "Forbidden: Auditors can only update work logs from today and yesterday",
//         });
//       }
//     }
//     const currentWorkType = workLog.workType;
//     const newWorkType = updateData.workType;

//     if (currentWorkType === "absent" && newWorkType !== "absent") {
//       console.log("Resetting absent fields");
//       // Reset fields specific to absent type
//       updateData.reason = undefined;
//       updateData.leaveType = undefined;
//       updateData.leaveStatus = undefined;
//     } else if (currentWorkType !== "absent" && newWorkType === "absent") {
//       // Reset time-related fields for absent type
//       updateData.startTime = null;
//       updateData.endTime = null;
//       updateData.description = null;
//       updateData.fromDate = null;
//       updateData.toDate = null;
//     }

//     // Handle leave-specific validations
//     if (newWorkType === "leave") {
//       // Validate required fields for leave
//       if (!updateData.fromDate || !updateData.toDate || !updateData.reason) {
//         return res.status(400).json({
//           message: "fromDate, toDate, and reason are required for leave type",
//         });
//       }

//       // Set default leaveStatus if not provided
//       if (!updateData.leaveStatus) {
//         updateData.leaveStatus = "pending";
//       }
//     }

//     // Remove fields that don't exist in schema
//     delete updateData.paidLeave;
//     delete updateData.sickLeave;
//     console.log(updateData);
//     const updatedWorkLog = await WorkLog.findByIdAndUpdate(id, updateData, {
//       new: true,
//       runValidators: true, // Ensures validation rules are applied
//     });

//     res
//       .status(200)
//       .json({ message: "Work log updated successfully", updatedWorkLog });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Error updating work log", error: error.message });
//   }
// };
export const updateWorkLog = async (req, res) => {
  console.log(req.body, "updateworklog Req data");
  try {
    const { id } = req.params;
    const updateData = { ...req.body }; // Create a copy
    const { roles = [] } = req.user || {};

    const workLog = await WorkLog.findById(id);
    if (!workLog) {
      return res.status(404).json({ message: "Work log not found" });
    }

    // if (roles.includes("AUDITOR")) {
    //   const today = moment.tz("Asia/Kolkata").startOf("day");
    //   const yesterday = moment
    //     .tz("Asia/Kolkata")
    //     .subtract(1, "day")
    //     .startOf("day");
    //   const workLogDate = moment(workLog.workDate)
    //     .tz("Asia/Kolkata")
    //     .startOf("day");

    //   const isToday = workLogDate.isSame(today, "day");
    //   const isYesterday = workLogDate.isSame(yesterday, "day");

    //   if (!isToday && !isYesterday) {
    //     return res.status(403).json({
    //       message:
    //         "Forbidden: Auditors can only update work logs from today and yesterday",
    //     });
    //   }
    // }

    const currentWorkType = workLog.workType;
    const newWorkType = updateData.workType;

    // Handle empty enum fields - convert empty strings to undefined
    if (updateData.initiative === "") {
      updateData.initiative = undefined;
    }
    if (updateData.mouType === "") {
      updateData.mouType = undefined;
    }
    if (updateData.leaveType === "") {
      updateData.leaveType = undefined;
    }


    // Only reset fields if workType is actually changing
    if (currentWorkType !== newWorkType) {
      if (currentWorkType === "absent" && newWorkType !== "absent") {
        console.log("Resetting absent fields");
        updateData.reason = undefined;
        updateData.leaveType = undefined;
        updateData.leaveStatus = undefined;
        updateData.fromDate = undefined;
        updateData.toDate = undefined;

      }
      else if (newWorkType === "absent") {
        updateData.startTime = undefined;
        updateData.endTime = undefined;
        updateData.description = undefined;
        updateData.fromDate = undefined;
        updateData.toDate = undefined;
      }
      else if (newWorkType === "leave") {
        updateData.startTime = undefined;
        updateData.endTime = undefined;
      }
      else {
        updateData.reason = undefined;
        updateData.leaveType = undefined;
        updateData.leaveStatus = undefined;
        updateData.fromDate = undefined;
        updateData.toDate = undefined;
        updateData.proposalNumber = undefined;
      }
    }

    // Handle leave-specific validations
    if (newWorkType === "leave") {
      if (!updateData.fromDate || !updateData.toDate || !updateData.reason) {
        return res.status(400).json({
          message: "fromDate, toDate, and reason are required for leave type",
        });
      }

      if (!updateData.leaveStatus) {
        updateData.leaveStatus = "pending";
      }
    }

    // Remove fields that don't exist in schema
    delete updateData.paidLeave;
    delete updateData.sickLeave;

    console.log("Final update data:", updateData);

    const updatedWorkLog = await WorkLog.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res
      .status(200)
      .json({ message: "Work log updated successfully", updatedWorkLog });
  } catch (error) {
    console.error("Update error:", error);
    res
      .status(500)
      .json({ message: "Error updating work log", error: error.message });
  }
};

// Delete Work Log
export const deleteWorkLogs = async (req, res) => {
  console.log(req.body);
  try {
    const arrayOfWorkLogIds = req.body;
    const { roles = [] } = req.user || {};

    if (!Array.isArray(arrayOfWorkLogIds) || arrayOfWorkLogIds.length === 0) {
      return res.status(400).json({
        error: "Invalid input: Expected a non-empty array of WorkLog IDs",
      });
    }

    // Fetch work logs before deleting
    const workLogs = await WorkLog.find({ _id: { $in: arrayOfWorkLogIds } });

    if (!workLogs.length) {
      return res.status(404).json({ message: "No matching work logs found" });
    }

    // Auditor restriction: Can only delete today's work logs
    // if (roles.includes("AUDITOR")) {
    //   const todayStart = istStartOfDay(moment().format("YYYY-MM-DD"));
    //   const todayEnd = istEndOfDay(moment().format("YYYY-MM-DD"));

    //   const unauthorizedLogs = workLogs.some(
    //     (log) => log.workDate < todayStart || log.workDate > todayEnd
    //   );

    //   if (unauthorizedLogs) {
    //     return res.status(403).json({
    //       message:
    //         "Forbidden: Auditors can only delete work logs created today",
    //     });
    //   }
    // }

    // Delete work logs in bulk
    await WorkLog.deleteMany({ _id: { $in: arrayOfWorkLogIds } });

    res.status(200).json({ message: "WorkLogs deleted successfully" });
  } catch (err) {
    console.error("Error deleting work logs:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getAllWorkLogsByUser = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, sort, keyword, userId, date } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "UserId is required" });
    }

    const pageNumber = parseInt(page, 10);
    const sizePerPage = parseInt(pageSize, 10);

    if (
      isNaN(pageNumber) ||
      pageNumber < 1 ||
      isNaN(sizePerPage) ||
      sizePerPage < 1
    ) {
      return res
        .status(400)
        .json({ message: "Invalid page or pageSize parameter" });
    }
    let query = { userId };

    // Exclude leave type from query
    query.workType = { $nin: ["leave", "permission"] };

    // Add date filter if provided
    // if (date) {
    //   const startOfDay = istStartOfDay(date, "DD-MM-YYYY");
    //   const endOfDay = istEndOfDay(date, "DD-MM-YYYY");

    //   query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    // }

    if (date) {
      const startOfDay = istStartOfDay(date);
      const endOfDay = istEndOfDay(date);

      if (!startOfDay || !endOfDay) {
        return res.status(400).json({ message: "Invalid date value" });
      }

      // query.createdAt = { $gte: startOfDay, $lte: endOfDay };
      query.workDate = { $gte: startOfDay, $lte: endOfDay };
    }

    if (keyword) {
      query = {
        ...query,
        $or: [
          { workType: { $regex: keyword, $options: "i" } },
          { description: { $regex: keyword, $options: "i" } },
        ],
      };
    }

    let sortQuery = {};
    switch (sort) {
      case "alllist":
        sortQuery = { createdAt: 1 };
        break;
      case "newlyadded":
        sortQuery = { createdAt: -1 };
        break;
      default:
        sortQuery = { createdAt: -1 };
        break;
    }

    const workLogs = await WorkLog.find(query)
      .sort(sortQuery)
      .skip((pageNumber - 1) * sizePerPage)
      .limit(sizePerPage)
      .select("workType description startTime endTime createdAt workDate");

    const totalWorkLogs = await WorkLog.countDocuments(query);

    // res.status(200).json({
    //   data: workLogs.map((log) => ({
    //     ...log.toObject(),
    //     startTime: log.startTime
    //       ? moment(log.startTime).format("HH:mm A")
    //       : "N/A",
    //     endTime: log.endTime ? moment(log.endTime).format("HH:mm A") : "N/A",
    //     date: moment(log.createdAt).format("DD-MM-YYYY"), // Extracted date from createdAt
    //     dateAndTime: moment(log.createdAt).format("DD-MM-YYYY HH:mm A"), // Formatted timestamp
    //     totalHours: log.startTime
    //       ? moment
    //           .duration(moment(log.endTime).diff(moment(log.startTime)))
    //           .asHours()
    //           .toFixed(2)
    //           .toString() + " Hours"
    //       : "N/A",
    //   })),
    //   total: totalWorkLogs,
    //   page: pageNumber,
    //   pageSize: sizePerPage,
    //   totalPages: Math.ceil(totalWorkLogs / sizePerPage),
    // });

    res.status(200).json({
      data: workLogs.map((log) => ({
        ...log.toObject(),
        startTime: log.startTime
          ? moment(log.startTime).tz("Asia/Kolkata").format("HH:mm A")
          : "N/A",
        endTime: log.endTime
          ? moment(log.endTime).tz("Asia/Kolkata").format("HH:mm A")
          : "N/A",
        date: moment(log.workDate).tz("Asia/Kolkata").format("DD-MM-YYYY"),
        dateAndTime: moment(log.workDate)
          .tz("Asia/Kolkata")
          .format("DD-MM-YYYY HH:mm A"),
        totalHours:
          log.startTime && log.endTime
            ? (() => {
              const start = moment(log.startTime).tz("Asia/Kolkata");
              const end = moment(log.endTime).tz("Asia/Kolkata");
              const duration = moment.duration(end.diff(start));

              const hours = Math.floor(duration.asHours());
              const minutes = duration.minutes();

              return `${hours}H ${minutes}M`;
            })()
            : "N/A",
        initiative: log.initiative,
        mouType: log.mouType,
        auditNo: log.auditNo,
        revenue: log.revenue,
        auditDetail: log.auditDetail,
        proposalNumber: log.proposalNumber,
      })),
      total: totalWorkLogs,
      page: pageNumber,
      pageSize: sizePerPage,
      totalPages: Math.ceil(totalWorkLogs / sizePerPage),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
// Controller function to check if a work log already exists for today
export const isWorkLogAlreadyExist = async (req, res) => {
  try {
    const { userId } = req.query; // Get the userId from the query params

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // Get today's date (ignoring time)
    const todayStart = istStartOfDay(moment().format("YYYY-MM-DD"));
    const todayEnd = istEndOfDay(moment().format("YYYY-MM-DD"));

    // Check if a work log entry already exists for the user today
    const existingWorkLog = await WorkLog.findOne({
      userId,
      workDate: { $gte: todayStart, $lte: todayEnd }, // Check within today's date range
    });

    if (existingWorkLog) {
      return res
        .status(401)
        .json({ message: "Work log entry already exists for today" });
    }
    // Check if a work log entry already exists for the user today

    res.status(200).json({ message: "No work log entry found for today" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error checking work log", error: error.message });
  }
};

// export const getAllWorkLogs = async (req, res) => {
//   try {
//     let { page = 1, pageSize = 10, sort, userId, fromDate, toDate } = req.query;

//     const pageNumber = parseInt(page, 10);
//     const sizePerPage = parseInt(pageSize, 10);

//     if (
//       isNaN(pageNumber) ||
//       pageNumber < 1 ||
//       isNaN(sizePerPage) ||
//       sizePerPage < 1
//     ) {
//       return res
//         .status(400)
//         .json({ message: "Invalid page or pageSize parameter" });
//     }

//     let query = {};

//     // User filter
//     if (userId) {
//       if (!mongoose.Types.ObjectId.isValid(userId)) {
//         return res.status(400).json({ message: "Invalid userId" });
//       }
//       query.userId = userId;
//     }

//     // Exclude leave type from query
//     query.workType = { $nin: ["leave", "permission"] };

//     // Date filtering logic
//     // if (fromDate && !toDate) {
//     //   query.createdAt = {
//     //     $gte: istStartOfDay(fromDate),
//     //     $lte: istEndOfDay(fromDate),
//     //   };
//     // } else if (fromDate && toDate) {
//     //   query.createdAt = {
//     //     $gte: istStartOfDay(fromDate),
//     //     $lte: istEndOfDay(toDate),
//     //   };
//     // } else {
//     //   query.createdAt = {
//     //     $gte: istStartOfDay(moment().subtract(7, "days").format("YYYY-MM-DD")),
//     //     $lte: istEndOfDay(moment().format("YYYY-MM-DD")),
//     //   };
//     // }

//     // ✅ Date filtering logic (USE workDate)
//     if (fromDate && !toDate) {
//       query.workDate = {
//         $gte: istStartOfDay(fromDate),
//         $lte: istEndOfDay(fromDate),
//       };
//     } else if (fromDate && toDate) {
//       query.workDate = {
//         $gte: istStartOfDay(fromDate),
//         $lte: istEndOfDay(toDate),
//       };
//     } else {
//       query.workDate = {
//         $gte: istStartOfDay(moment().subtract(7, "days").format("YYYY-MM-DD")),
//         $lte: istEndOfDay(moment().format("YYYY-MM-DD")),
//       };
//     }

//     let sortQuery = { workDate: 1 }; // Default sorting (oldest first)
//     if (sort === "newlyadded") {
//       sortQuery = { workDate: -1 };
//     }

//     const workLogs = await WorkLog.find(query)
//       .sort(sortQuery)
//       .skip((pageNumber - 1) * sizePerPage)
//       .limit(sizePerPage)
//       .populate("userId", "userName")
//       .select(
//         "workType description startTime endTime createdAt userId paidLeave sickLeave"
//       );

//     const totalWorkLogs = await WorkLog.countDocuments(query);

//     // res.status(200).json({
//     //   data: workLogs.map((log) => ({
//     //     ...log.toObject(),
//     //     auditor_name: log.userId?.userName || "N/A",
//     //     startTime: log.startTime
//     //       ? moment(log.startTime).format("HH:mm A")
//     //       : "N/A",
//     //     endTime: log.endTime ? moment(log.endTime).format("HH:mm A") : "N/A",
//     //     date: moment(log.createdAt).format("DD-MM-YYYY"),
//     //     dateAndTime: moment(log.createdAt).format("DD-MM-YYYY HH:mm A"),
//     //     paidLeave: log.paidLeave,
//     //     sickLeave: log.sickLeave,
//     //     totalHours:
//     //       log.startTime && log.endTime
//     //         ? moment
//     //             .duration(moment(log.endTime).diff(moment(log.startTime)))
//     //             .asHours()
//     //             .toFixed(2) + " Hours"
//     //         : "N/A",
//     //   })),
//     //   total: totalWorkLogs,
//     //   page: pageNumber,
//     //   pageSize: sizePerPage,
//     //   totalPages: Math.ceil(totalWorkLogs / sizePerPage),
//     //   fromDate: fromDate || moment().subtract(7, "days").format("YYYY-MM-DD"),
//     //   toDate: toDate || moment().format("YYYY-MM-DD"),
//     // });
//     res.status(200).json({
//       data: workLogs.map((log) => ({
//         ...log.toObject(),
//         auditor_name: log.userId?.userName || "N/A",
//         startTime: log.startTime
//           ? moment(log.startTime).tz("Asia/Kolkata").format("HH:mm A")
//           : "N/A",
//         endTime: log.endTime
//           ? moment(log.endTime).tz("Asia/Kolkata").format("HH:mm A")
//           : "N/A",
//         date: moment(log.workDate).tz("Asia/Kolkata").format("DD-MM-YYYY"),
//         dateAndTime: moment(log.workDate)
//           .tz("Asia/Kolkata")
//           .format("DD-MM-YYYY HH:mm A"),
//         paidLeave: log.paidLeave,
//         sickLeave: log.sickLeave,
//         totalHours:
//           log.startTime && log.endTime
//             ? (() => {
//                 const start = moment(log.startTime).tz("Asia/Kolkata");
//                 const end = moment(log.endTime).tz("Asia/Kolkata");
//                 const duration = moment.duration(end.diff(start));

//                 const hours = Math.floor(duration.asHours());
//                 const minutes = duration.minutes();

//                 return `${hours}H ${minutes}M`;
//               })()
//             : "N/A",
//         initiative: log.initiative,
//         mouType: log.mouType,
//         auditNo: log.auditNo,
//         revenue: log.revenue,
//         auditDetail: log.auditDetail,
//       })),
//       total: totalWorkLogs,
//       page: pageNumber,
//       pageSize: sizePerPage,
//       totalPages: Math.ceil(totalWorkLogs / sizePerPage),
//       fromDate: fromDate || moment().subtract(7, "days").format("YYYY-MM-DD"),
//       toDate: toDate || moment().format("YYYY-MM-DD"),
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server error" });
//   }
// };



export const getAllWorkLogs = async (req, res) => {
  try {
    console.log("\n========= GET ALL WORK LOGS =========");
    console.log("Incoming Query Params:", req.query);

    let {
      page = 1,
      pageSize = 10,
      sort,
      userId,
      fromDate,
      toDate,
      date,
    } = req.query;

    // ------------------ Pagination validation ------------------
    const pageNumber = parseInt(page, 10);
    const sizePerPage = parseInt(pageSize, 10);

    if (
      isNaN(pageNumber) ||
      pageNumber < 1 ||
      isNaN(sizePerPage) ||
      sizePerPage < 1
    ) {
      return res
        .status(400)
        .json({ message: "Invalid page or pageSize parameter" });
    }

    // ------------------ Build base query ------------------
    let query = {};

    // ------------------ User filter ------------------
    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        // console.log(" Invalid userId:", userId);
        return res.status(400).json({ message: "Invalid userId" });
      }
      query.userId = userId;
    }

    // ------------------ Exclude leave & permission ------------------
    query.workType = { $nin: ["leave", "permission"] };

    // ------------------ DATE FILTERING (CORRECT PRIORITY) ------------------
    if (date) {
      // 1 Single date filter
      query.workDate = {
        $gte: istStartOfDay(date),
        $lte: istEndOfDay(date),
      };
      // console.log(" Applied Single Date Filter:", date);

    } else if (fromDate && toDate) {
      // 2 Date range filter
      query.workDate = {
        $gte: istStartOfDay(fromDate),
        $lte: istEndOfDay(toDate),
      };
      // console.log(" Applied Date Range Filter:", fromDate, "→", toDate);

    } else if (fromDate && !toDate) {
      // 3 Only fromDate
      query.workDate = {
        $gte: istStartOfDay(fromDate),
        $lte: istEndOfDay(fromDate),
      };
      // console.log(" Applied FromDate Only Filter:", fromDate);

    } else {
      // 4 Default last 7 days
      const defaultFrom = moment()
        .subtract(7, "days")
        .format("YYYY-MM-DD");
      const defaultTo = moment().format("YYYY-MM-DD");

      query.workDate = {
        $gte: istStartOfDay(defaultFrom),
        $lte: istEndOfDay(defaultTo),
      };

      console.log(
        " Applied Default Last 7 Days Filter:",
        defaultFrom,
        "→",
        defaultTo
      );
    }

    // ------------------ Sorting ------------------
    let sortQuery = { workDate: 1 }; // Oldest first
    if (sort === "newlyadded") {
      sortQuery = { workDate: -1 }; // Newest first
    }

    // console.log("Final Mongo Query:", JSON.stringify(query, null, 2));
    // console.log("Sort Query:", sortQuery);

    // ------------------ Fetch data ------------------
    const workLogs = await WorkLog.find(query)
      .sort(sortQuery)
      .skip((pageNumber - 1) * sizePerPage)
      .limit(sizePerPage)
      .populate("userId", "userName")
      .select(
        "workType description startTime endTime workDate createdAt userId paidLeave sickLeave initiative mouType auditNo revenue auditDetail"
      );

    const totalWorkLogs = await WorkLog.countDocuments(query);

    // console.log("Records fetched:", workLogs.length);
    // console.log("Total records:", totalWorkLogs);

    // ------------------ Response formatting ------------------
    const formattedData = workLogs.map((log) => ({
      ...log.toObject(),
      auditor_name: log.userId?.userName || "N/A",

      startTime: log.startTime
        ? moment(log.startTime).tz("Asia/Kolkata").format("HH:mm A")
        : "N/A",

      endTime: log.endTime
        ? moment(log.endTime).tz("Asia/Kolkata").format("HH:mm A")
        : "N/A",

      date: moment(log.workDate)
        .tz("Asia/Kolkata")
        .format("DD-MM-YYYY"),

      dateAndTime: moment(log.workDate)
        .tz("Asia/Kolkata")
        .format("DD-MM-YYYY HH:mm A"),

      totalHours:
        log.startTime && log.endTime
          ? (() => {
            const start = moment(log.startTime).tz("Asia/Kolkata");
            const end = moment(log.endTime).tz("Asia/Kolkata");
            const duration = moment.duration(end.diff(start));
            return `${Math.floor(duration.asHours())}H ${duration.minutes()}M`;
          })()
          : "N/A",
    }));

    // ------------------ Send response ------------------
    res.status(200).json({
      data: formattedData,
      total: totalWorkLogs,
      page: pageNumber,
      pageSize: sizePerPage,
      totalPages: Math.ceil(totalWorkLogs / sizePerPage),
    });

    console.log(" Response sent successfully");
  } catch (error) {
    console.error(" Server Error:", error.message);
    console.error(error.stack);
    res.status(500).json({ message: "Server error" });
  }
};


export const getWorkLogById = async (req, res) => {
  try {
    const { workLogId } = req.params; // Get work log ID from request params

    // Find work log by ID
    const workLog = await WorkLog.findById(workLogId);

    if (!workLog) {
      return res.status(404).json({ message: "Work log not found" });
    }

    // Format the work log data
    const formattedWorkLog = {
      ...workLog.toObject(),
      startTime: workLog.startTime,
      endTime: workLog.endTime,
      date: moment(workLog.workDate).format("DD-MM-YYYY"), // Extracted date from createdAt
      dateAndTime: moment(workLog.workDate).format("DD-MM-YYYY HH:mm A"), // Formatted timestamp
      totalHours: workLog.startTime
        ? moment
          .duration(moment(workLog.endTime).diff(moment(workLog.startTime)))
          .asHours()
          .toFixed(2) + " Hours"
        : "N/A",
      initiative: workLog.initiative,
      mouType: workLog.mouType,
      auditNo: workLog.auditNo,
      revenue: workLog.revenue,
      auditDetail: workLog.auditDetail,
    };

    res.status(200).json({ workLog: formattedWorkLog });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching work log", error: error.message });
  }
};

export const fetchWorkLogDates = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Fetch work logs for the given user
    const workLogs = await WorkLog.find({ userId });

    // Extract and format unique dates from timestamps
    const workLogDates = [
      ...new Set(
        workLogs.map((log) =>
          moment(log.workDate).tz("Asia/Kolkata").format("YYYY-MM-DD")
        )
      ),
    ];

    return res.json(workLogDates);
  } catch (error) {
    console.error("Error fetching work log dates:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// export const submitLeaveRequest = async (req, res) => {
//   console.log(req.body);
//   try {
//     const { userId, leaveType, reason, fromDate, toDate } = req.body;

//     if (!userId || !reason || !fromDate || !toDate) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }

//     // Check for leave balance or create if missing
//     let leaveBalance = await LeaveBalance.findOne({ userId });

//     if (!leaveBalance) {
//       leaveBalance = await LeaveBalance.create({
//         userId,
//         sickLeave: 12,
//         casualLeave: 12,
//         casualLeaveHistory: [],
//       });
//     }

//     // Check LOP
//     let isLOP = false;
//     if (leaveType) {
//       if (leaveType === "sickLeave" && leaveBalance.sickLeave <= 0)
//         isLOP = true;
//       if (leaveType === "casualLeave" && leaveBalance.casualLeave <= 0)
//         isLOP = true;
//     }

//     // Create work log (leave request)
//     const leaveRequest = new WorkLog({
//       userId,
//       workType: "leave",
//       leaveType: leaveType || "lop", // Default to unpaid if no leave type specified
//       reason,
//       startTime: new Date(fromDate),
//       endTime: new Date(toDate),
//       fromDate: new Date(fromDate),
//       toDate: new Date(toDate),
//       isLOP: leaveType ? isLOP : true, // If no leave type, it's automatically LOP
//       leaveStatus: "pending",
//     });

//     await leaveRequest.save();

//     res.status(201).json({
//       message: "Leave request submitted successfully",
//       leaveRequest,
//     });
//   } catch (error) {
//     console.error("Error submitting leave request:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

export const submitLeaveRequest = async (req, res) => {
  try {
    const {
      userId,
      leaveMode,
      leaveType,
      permissionHours,
      fromDate,
      toDate,
      reason,
      isApprover,
    } = req.body;

    console.log(req.body);

    if (!userId || !leaveMode || !reason) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if ((leaveMode === "FULL_DAY" || leaveMode === "HALF_DAY") && !leaveType) {
      return res.status(400).json({
        message: "leaveType is required for full or half day leave",
      });
    }

    if (leaveMode === "HALF_DAY") {
      if (!fromDate || !toDate) {
        return res.status(400).json({
          message: "fromDate and toDate are required for half-day leave",
        });
      }

      const from = moment.tz(fromDate, "Asia/Kolkata").startOf("day");
      const to = moment.tz(toDate, "Asia/Kolkata").startOf("day");

      if (!from.isSame(to, "day")) {
        return res.status(400).json({
          message: "Half day leave must be for a single date",
        });
      }
    }

    // Permission Hours (NO LEAVE DEDUCTION)
    // if (leaveMode === "PERMISSION") {
    //   if (permissionHours > 3) {
    //     return res.status(400).json({ message: "Max 3 hours allowed" });
    //   }

    //   const permissionLog = new WorkLog({
    //     userId,
    //     workType: "permission",
    //     leaveMode,
    //     permissionHours,
    //     reason,
    //     leaveStatus: "approved", // auto-approved
    //     isLOP: false,
    //   });

    //   await permissionLog.save();

    //   return res.status(201).json({
    //     message: "Permission recorded successfully",
    //   });
    // }

    // Permission Hours (NO LEAVE DEDUCTION)
    if (leaveMode === "PERMISSION") {
      if (!fromDate) {
        return res.status(400).json({
          message: "Permission date is required",
        });
      }

      if (permissionHours > 3) {
        return res.status(400).json({
          message: "Max 3 hours allowed",
        });
      }

      // Normalize ISO → IST date safely
      const permissionMoment = moment.tz(fromDate, "Asia/Kolkata");

      if (!permissionMoment.isValid()) {
        return res.status(400).json({ message: "Invalid permission date" });
      }

      const dateOnly = permissionMoment.format("YYYY-MM-DD");

      const dayStart = istStartOfDay(dateOnly);
      const dayEnd = istEndOfDay(dateOnly);

      const existingPermission = await WorkLog.findOne({
        userId,
        workType: "permission",
        permissionDate: { $gte: dayStart, $lte: dayEnd },
      });

      if (existingPermission) {
        return res.status(400).json({
          message: "Permission already taken for this date",
        });
      }

      const permissionLog = new WorkLog({
        userId,
        workType: "permission",
        leaveMode: "PERMISSION",
        workDate: dayStart,
        permissionHours,
        reason,
        permissionDate: dayStart,
        leaveStatus: isApprover ? "approved" : "pending",
        isLOP: false,
      });

      await permissionLog.save();

      return res.status(201).json({
        message: "Permission request submitted successfully",
      });
    }

    // Full / Half Day Leave
    const from = moment.tz(fromDate, "Asia/Kolkata");
    const to = moment.tz(toDate, "Asia/Kolkata");

    if (!from.isValid() || !to.isValid()) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    const leaveDays =
      leaveMode === "HALF_DAY"
        ? 0.5
        : moment(to).startOf("day").diff(moment(from).startOf("day"), "days") +
        1;

    const normalizedFromDate = istStartOfDay(from.format("YYYY-MM-DD"));
    const normalizedToDate = istEndOfDay(to.format("YYYY-MM-DD"));

    //  COMPENSATION LEAVE VALIDATION (ONLY ADD)
    if (leaveType === "compensationLeave") {
      const leaveBalance = await LeaveBalance.findOne({ userId });

      if (!leaveBalance || leaveBalance.compLeaveAvailable <= 0) {
        return res.status(400).json({
          message: "No Compensation Leave available",
        });
      }
    }

    const leaveRequest = new WorkLog({
      userId,
      workType: "leave",
      leaveMode,
      leaveType,
      fromDate: normalizedFromDate,
      toDate: normalizedToDate,
      workDate: normalizedFromDate,
      reason,
      leaveDays,
      leaveStatus: isApprover ? "approved" : "pending",
    });

    console.log(isApprover);
    // IF SUPER ADMIN IS ADDING LEAVE DIRECTLY
    if (isApprover) {
      const leaveBalance = await LeaveBalance.findOne({ userId });

      if (!leaveBalance) {
        return res.status(404).json({ message: "Leave balance not found" });
      }

      let lopDays = 0;
      let description = "";

      if (leaveType === "sickLeave") {
        let usable = Math.min(leaveBalance.sickLeaveAvailable, leaveDays);
        lopDays = leaveDays - usable;

        leaveBalance.sickLeaveAvailable -= usable;
        leaveBalance.sickLeaveOverall += usable;

        description =
          lopDays > 0
            ? `Approved with ${usable} Sick Leave and ${lopDays} LOP`
            : `Approved with ${usable} Sick Leave`;
      }

      else if (leaveType === "casualLeave") {
        let usable = Math.min(leaveBalance.casualLeaveAvailable, leaveDays);
        lopDays = leaveDays - usable;

        leaveBalance.casualLeaveAvailable -= usable;
        leaveBalance.casualLeaveOverall += usable;

        description =
          lopDays > 0
            ? `Approved with ${usable} Casual Leave and ${lopDays} LOP`
            : `Approved with ${usable} Casual Leave`;
      }
      else if (leaveType === "compensationLeave") {
        leaveBalance.compLeaveAvailable -= leaveDays;
        leaveBalance.compLeaveUsed += leaveDays;

        description = `Approved with ${leaveDays} Compensation Leave`;
      }
      else {
        lopDays = leaveDays;
        description = `Approved with ${lopDays} LOP`;
      }

      leaveRequest.isLOP = lopDays > 0;
      leaveRequest.lopDays = lopDays;
      leaveRequest.description = description;

      await leaveBalance.save();
    }

    console.log("Safe here - 1");
    await leaveRequest.save();
    console.log("Safe here - 2");

    res.status(201).json({
      message: "Leave request submitted",
      leaveRequest,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const addCompensationLeave = async (req, res) => {
  try {
    const { userId, count, reason } = req.body;

    if (!userId || !count || count <= 0) {
      return res.status(400).json({ message: "Invalid data" });
    }

    let leaveBalance = await LeaveBalance.findOne({ userId });

    if (!leaveBalance) {
      leaveBalance = await LeaveBalance.create({
        userId,
      });
    }

    //  ADD COMPENSATION LEAVE
    leaveBalance.compLeave += Number(count);
    leaveBalance.compLeaveAvailable += Number(count);

    await leaveBalance.save();

    return res.status(200).json({
      message: "Compensation leave added successfully",
      updatedBalance: leaveBalance,
    });
  } catch (error) {
    console.error("Add compensation leave error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// export const getAllLeaveRequests = async (req, res) => {
//   try {
//     let {
//       page = 1,
//       pageSize = 10,
//       sort,
//       userId,
//       fromDate,
//       toDate,
//       leaveStatus,
//       keyword, // ✅ NEW: keyword from query
//     } = req.query;

//     const pageNumber = parseInt(page, 10);
//     const sizePerPage = parseInt(pageSize, 10);

//     if (
//       isNaN(pageNumber) ||
//       pageNumber < 1 ||
//       isNaN(sizePerPage) ||
//       sizePerPage < 1
//     ) {
//       return res
//         .status(400)
//         .json({ message: "Invalid page or pageSize parameter" });
//     }

//     let query = { workType: { $in: ["leave", "permission"] } };

//     if (userId) {
//       if (!mongoose.Types.ObjectId.isValid(userId)) {
//         return res.status(400).json({ message: "Invalid userId" });
//       }
//       query.userId = userId;
//     }

//     if (leaveStatus) {
//       query.leaveStatus = leaveStatus;
//     }

//     // Date filters
//     if (fromDate) {
//       const start = istStartOfDay(fromDate);
//       const end = istEndOfDay(toDate || fromDate);

//       query.$or = [
//         {
//           workType: "leave",
//           fromDate: {
//             $gte: start,
//             $lte: end,
//           },
//         },
//         {
//           workType: "permission",
//           permissionDate: {
//             $gte: start,
//             $lte: end,
//           },
//         },
//       ];
//     } else {
//       query.createdAt = {
//         $gte: istStartOfDay(moment().subtract(7, "days").format("YYYY-MM-DD")),
//         $lte: istEndOfDay(moment().format("YYYY-MM-DD")),
//       };
//     }

//     let sortQuery = { createdAt: 1 };
//     if (sort === "newlyadded") {
//       sortQuery = { createdAt: -1 };
//     }

//     // Base query
//     let baseQuery = WorkLog.find(query)
//       .sort(sortQuery)
//       .skip((pageNumber - 1) * sizePerPage)
//       .limit(sizePerPage)
//       .populate("userId", "userName")
//       .select(
//         "userId leaveType leaveMode reason startTime endTime fromDate toDate permissionDate permissionHours isLOP leaveStatus createdAt"
//       );

//     // Apply keyword filtering after population
//     let leaveRequests = await baseQuery;

//     // Keyword search after fetching
//     if (keyword) {
//       const searchRegex = new RegExp(keyword, "i");
//       leaveRequests = leaveRequests.filter((log) => {
//         return (
//           searchRegex.test(log.leaveType) ||
//           searchRegex.test(log.reason) ||
//           searchRegex.test(log?.userId?.userName || "")
//         );
//       });
//     }

//     // Count total (with/without keyword)
//     const totalLeaveRequests = keyword
//       ? leaveRequests.length
//       : await WorkLog.countDocuments(query);

//     res.status(200).json({
//       data: leaveRequests.map((log) => ({
//         ...log.toObject(),
//         requester_name: log.userId?.userName || "N/A",
//         userId: log.userId._id,
//         startTime: log.startTime
//           ? moment(log.startTime).format("HH:mm A")
//           : "N/A",
//         endTime: log.endTime ? moment(log.endTime).format("HH:mm A") : "N/A",
//         fromDate: log.fromDate
//           ? moment(log.fromDate).format("DD-MM-YYYY")
//           : "N/A",
//         toDate: log.toDate ? moment(log.toDate).format("DD-MM-YYYY") : "N/A",
//         requestDate: moment(log.createdAt).format("DD-MM-YYYY"),
//         requestDateAndTime: moment(log.createdAt).format("DD-MM-YYYY HH:mm A"),
//         leaveType: log.leaveType,
//         reason: log.reason,
//         isLOP: log.isLOP,
//         leaveStatus: log.leaveStatus,
//         leaveMode: log.leaveMode,
//         permissionDate: log.permissionDate
//           ? moment(log.permissionDate).tz("Asia/Kolkata").format("DD-MM-YYYY")
//           : "N/A",
//         permissionHours: log.permissionHours,
//       })),
//       total: totalLeaveRequests,
//       page: pageNumber,
//       pageSize: sizePerPage,
//       totalPages: Math.ceil(totalLeaveRequests / sizePerPage),
//       fromDate: fromDate || moment().subtract(7, "days").format("YYYY-MM-DD"),
//       toDate: toDate || moment().format("YYYY-MM-DD"),
//     });
//   } catch (error) {
//     console.error("Error fetching leave requests:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

export const getAllLeaveRequests = async (req, res) => {
  try {
    console.log(" Incoming Request Query:", req.query);

    let {
      page = 1,
      pageSize = 10,
      sort,
      userId,
      fromDate,
      toDate,
      leaveStatus,
      keyword,
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const sizePerPage = parseInt(pageSize, 10);

    console.log(" Pagination:", {
      pageNumber,
      sizePerPage,
    });

    let query = {
      workType: { $in: ["leave", "permission"] },
    };

    // user filter
    if (userId) {
      console.log(" Filtering by userId:", userId);
      query.userId = userId;
    }

    // status filter
    if (leaveStatus) {
      console.log(" Filtering by leaveStatus:", leaveStatus);
      query.leaveStatus = leaveStatus;
    }

    // date filter (skip if all list)
    if (sort !== "alllist") {
      if (fromDate) {
        const start = istStartOfDay(fromDate);
        const end = istEndOfDay(toDate || fromDate);

        console.log(" Date filter applied:", { start, end });

        query.$or = [
          {
            workType: "leave",
            fromDate: { $gte: start, $lte: end },
          },
          {
            workType: "permission",
            permissionDate: { $gte: start, $lte: end },
          },
        ];
      } else {
        const start = istStartOfDay(
          moment().subtract(7, "days").format("YYYY-MM-DD")
        );
        const end = istEndOfDay(moment().format("YYYY-MM-DD"));

        console.log(" Default 7-day filter:", { start, end });

        query.createdAt = { $gte: start, $lte: end };
      }
    } else {
      console.log(" ALL LIST selected → NO date filter applied");
    }

    // keyword filter
    if (keyword) {
      console.log(" Keyword search:", keyword);
      const regex = new RegExp(keyword, "i");
      query.$or = [
        { leaveType: regex },
        { reason: regex },
      ];
    }

    console.log(" Final Mongo Query:", JSON.stringify(query, null, 2));

    // sorting
    let sortQuery = { createdAt: -1 };
    if (sort === "oldest") sortQuery = { createdAt: 1 };

    console.log(" Sort Query:", sortQuery);

    // total count
    const totalLeaveRequests = await WorkLog.countDocuments(query);
    console.log(" Total records in DB:", totalLeaveRequests);

    // fetch data
    const leaveRequests = await WorkLog.find(query)
      .populate("userId", "userName")
      .sort(sortQuery)
      .skip((pageNumber - 1) * sizePerPage)
      .limit(sizePerPage)
      .select(
        "userId leaveType leaveMode reason startTime endTime fromDate toDate permissionDate permissionHours isLOP leaveStatus createdAt"
      );

    console.log(" Records returned:", leaveRequests.length);

    res.status(200).json({
      data: leaveRequests.map((log) => ({
        ...log.toObject(),
        requester_name: log.userId?.userName || "N/A",
        userId: log.userId._id,
        startTime: log.startTime
          ? moment(log.startTime).format("HH:mm A")
          : "N/A",
        endTime: log.endTime ? moment(log.endTime).format("HH:mm A") : "N/A",
        fromDate: log.fromDate
          ? moment(log.fromDate).format("DD-MM-YYYY")
          : "N/A",
        toDate: log.toDate ? moment(log.toDate).format("DD-MM-YYYY") : "N/A",
        requestDate: moment(log.createdAt).format("DD-MM-YYYY"),
        requestDateAndTime: moment(log.createdAt).format("DD-MM-YYYY HH:mm A"),
        leaveType: log.leaveType,
        reason: log.reason,
        isLOP: log.isLOP,
        leaveStatus: log.leaveStatus,
        leaveMode: log.leaveMode,
        permissionDate: log.permissionDate
          ? moment(log.permissionDate).tz("Asia/Kolkata").format("DD-MM-YYYY")
          : "N/A",
        permissionHours: log.permissionHours,
      })),
      total: totalLeaveRequests,
      page: pageNumber,
      pageSize: sizePerPage,
      totalPages: Math.ceil(totalLeaveRequests / sizePerPage),
    });

    console.log(" Response sent successfully");

  } catch (error) {
    console.error(" Error fetching leave requests:", error);
    res.status(500).json({ message: "Server error" });
  }
};



export const approveLeaveRequest = async (req, res) => {
  console.log(req.body);

  try {
    const { id } = req.params;

    // 1. Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid leave request ID" });
    }

    // 2. Fetch leave request
    const leaveRequest = await WorkLog.findById(id);
    console.log("Fetched leave request:", leaveRequest);

    if (!leaveRequest) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    if (leaveRequest.leaveStatus === "approved") {
      return res.status(400).json({
        message: "Leave already approved",
      });
    }

    // 3. Handle permission approval separately
    if (leaveRequest.workType === "permission") {
      leaveRequest.leaveStatus = "approved";
      // console.log(req.user);
      // leaveRequest.approvedBy = req.user._id;

      await leaveRequest.save();

      return res.status(200).json({
        message: "Permission approved successfully",
        permission: leaveRequest,
      });
    }

    // 3. Ensure it's a leave request
    if (leaveRequest.workType !== "leave") {
      return res.status(400).json({ message: "This is not a leave request" });
    }

    const { userId, leaveType, fromDate, toDate } = leaveRequest;

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "Missing leave date range" });
    }

    const startDate = moment(fromDate).startOf("day");
    const endDate = moment(toDate).endOf("day");
    // const leaveDays = endDate.diff(startDate, "days") + 1;
    // console.log(`Leave Days: ${leaveDays}`);

    // 4. Get or create leave balance
    let leaveBalance = await LeaveBalance.findOne({ userId });
    if (!leaveBalance) {
      return res.status(404).json({ message: "Leave balance not found" });
    }

    // Check if leave spans multiple months
    const fromMonth = moment(fromDate).month();
    const toMonth = moment(toDate).month();
    const isDifferentMonth = fromMonth !== toMonth;

    // 5. Deduct leave or apply LOP
    // let lopDays = 0;
    // let leaveDescription = "";

    // if (leaveType === "sickLeave") {
    //   let available = leaveBalance.sickLeaveAvailable || 0;
    //   let allowedCarryForward = 0;

    //   if (isDifferentMonth && available < leaveDays) {
    //     allowedCarryForward = 1;
    //     available += 1; // Temporarily allow 1 extra
    //     leaveBalance.sickTakenNextMonth = true;
    //   }

    //   if (available >= leaveDays) {
    //     const totalUsed = leaveDays;
    //     leaveBalance.sickLeaveAvailable = Math.max(
    //       leaveBalance.sickLeaveAvailable - (totalUsed - allowedCarryForward),
    //       0
    //     );
    //     leaveBalance.sickLeaveTotalMonth += totalUsed;
    //     leaveBalance.sickLeaveOverall += totalUsed;
    //     leaveDescription = `Approved with ${totalUsed} SL`;
    //   } else {
    //     const usedSL = available;
    //     lopDays = leaveDays - usedSL;
    //     leaveBalance.sickLeaveAvailable = Math.max(
    //       leaveBalance.sickLeaveAvailable - (usedSL - allowedCarryForward),
    //       0
    //     );
    //     leaveBalance.sickLeaveTotalMonth += usedSL;
    //     leaveBalance.sickLeaveOverall += usedSL;
    //     leaveDescription = `Approved with ${usedSL} SL and ${lopDays} LOP`;
    //   }
    // } else if (leaveType === "casualLeave") {
    //   let available = leaveBalance.casualLeaveAvailable || 0;
    //   let allowedCarryForward = 0;

    //   if (isDifferentMonth && available < leaveDays) {
    //     allowedCarryForward = 1;
    //     available += 1; // Temporarily allow 1 extra
    //     leaveBalance.casualTakenNextMonth = true;
    //   }

    //   if (available >= leaveDays) {
    //     const totalUsed = leaveDays;
    //     leaveBalance.casualLeaveAvailable = Math.max(
    //       leaveBalance.casualLeaveAvailable - (totalUsed - allowedCarryForward),
    //       0
    //     );
    //     leaveBalance.casualLeaveTotalMonth += totalUsed;
    //     leaveBalance.casualLeaveOverall += totalUsed;
    //     leaveDescription = `Approved with ${totalUsed} CL`;
    //   } else {
    //     const usedCL = available;
    //     lopDays = leaveDays - usedCL;
    //     leaveBalance.casualLeaveAvailable = Math.max(
    //       leaveBalance.casualLeaveAvailable - (usedCL - allowedCarryForward),
    //       0
    //     );
    //     leaveBalance.casualLeaveTotalMonth += usedCL;
    //     leaveBalance.casualLeaveOverall += usedCL;
    //     leaveDescription = `Approved with ${usedCL} CL and ${lopDays} LOP`;
    //   }
    // } else {
    //   // Leave type not SL or CL = full LOP
    //   lopDays = leaveDays;
    //   leaveDescription = `Approved with ${leaveDays} LOP`;
    // }

    // 6. Update leave request
    // leaveRequest.leaveStatus = "approved";
    // leaveRequest.isLOP = lopDays > 0;
    // leaveRequest.lopDays = lopDays;
    // leaveRequest.description = leaveDescription;

    // 7. Save updates
    // const leaveBalanceSaved = await leaveBalance.save();
    // const leaveRequestSaved = await leaveRequest.save();

    // 5. Deduct leave or apply LOP
    const calculatedDays =
      moment
        .tz(leaveRequest.toDate, "Asia/Kolkata")
        .diff(moment.tz(leaveRequest.fromDate, "Asia/Kolkata"), "days") + 1;

    const leaveDays =
      leaveRequest.leaveMode === "HALF_DAY" ? 0.5 : calculatedDays;

    let lopDays = 0;
    let description = "";
    if (leaveType === "sickLeave") {
      let available = leaveBalance.sickLeaveAvailable;

      let usableSL = Math.min(available, leaveDays);
      lopDays = leaveDays - usableSL;

      leaveBalance.sickLeaveAvailable = Number(
        (leaveBalance.sickLeaveAvailable - usableSL).toFixed(2)
      );

      leaveBalance.sickLeaveOverall = Number(
        (leaveBalance.sickLeaveOverall + usableSL).toFixed(2)
      );

      description =
        lopDays > 0
          ? `Approved with ${usableSL} Sick Leave and ${lopDays} LOP`
          : `Approved with ${usableSL} Sick Leave`;
    }
    else if (leaveType === "casualLeave") {
      let available = leaveBalance.casualLeaveAvailable;

      let usableCL = Math.min(available, leaveDays);
      lopDays = leaveDays - usableCL;

      leaveBalance.casualLeaveAvailable = Number(
        (leaveBalance.casualLeaveAvailable - usableCL).toFixed(2)
      );

      leaveBalance.casualLeaveOverall = Number(
        (leaveBalance.casualLeaveOverall + usableCL).toFixed(2)
      );

      description =
        lopDays > 0
          ? `Approved with ${usableCL} Casual Leave and ${lopDays} LOP`
          : `Approved with ${usableCL} Casual Leave`;
    }
    else if (leaveRequest.leaveType === "compensationLeave") {
      if (leaveBalance.compLeaveAvailable < leaveDays) {
        return res.status(400).json({
          message: "Insufficient Compensation Leave balance",
        });
      }

      leaveBalance.compLeaveAvailable -= leaveDays;
      leaveBalance.compLeaveUsed += leaveDays;

      description = `Approved with ${leaveDays} Compensation Leave`;
    }
    else {
      lopDays = leaveDays;
      description = `Approved with ${lopDays} LOP`;
    }

    // 6. Update leave request
    leaveRequest.leaveStatus = "approved";
    leaveRequest.isLOP = lopDays > 0;
    leaveRequest.lopDays = lopDays;
    leaveRequest.description = description;

    // 7. Save updates
    const leaveBalanceSaved = await leaveBalance.save();
    const leaveRequestSaved = await leaveRequest.save();

    // 8. Respond
    return res.status(200).json({
      message: "Leave approved successfully",
      leaveRequest: leaveRequestSaved,
      updatedLeaveBalance: leaveBalanceSaved,
    });
  } catch (error) {
    console.error("Error in approveLeaveRequest:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

export const calculateLeaveData = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const startOfMonth = moment.tz("Asia/Kolkata").startOf("month").toDate();
    const endOfMonth = moment.tz("Asia/Kolkata").endOf("month").toDate();

    const objectUserId = new mongoose.Types.ObjectId(userId);

    let leaveBalance = await LeaveBalance.findOne({ userId: objectUserId });

    if (!leaveBalance) {
      const today = moment().toDate(); // or new Date()

      leaveBalance = await LeaveBalance.create({
        userId: objectUserId,
        sickLeave: 12,
        casualLeave: 12,
        sickLeaveAvailable: 12,
        casualLeaveAvailable: 12,
        sickLeaveTotalMonth: 0,
        sickLeaveOverall: 0,
        casualLeaveTotalMonth: 0,
        casualLeaveOverall: 0,
        lastMonthlyReset: moment().toDate(),
        lastFinancialYearReset: moment().toDate(), // or null if you prefer
      });
    }

    const today = moment();

    // Check if today is April 1st
    const isFinancialYearStart = today.date() === 1 && today.month() === 3;

    // Optional: Add this field in your LeaveBalance model if not present

    const lastFYReset = leaveBalance.lastFinancialYearReset
      ? moment(leaveBalance.lastFinancialYearReset)
      : null;
    const alreadyResetThisFY = lastFYReset?.isSame(today, "day");

    if (isFinancialYearStart && !alreadyResetThisFY) {
      // Reset overall balances
      leaveBalance.sickLeaveOverall = 0;
      leaveBalance.casualLeaveOverall = 0;

      // Reset available leave for new year
      leaveBalance.sickLeaveAvailable = 1;
      leaveBalance.casualLeaveAvailable = 1;

      leaveBalance.sickLeave = 1;
      leaveBalance.casualLeave = 1;

      // Also reset monthly leave counters for April
      leaveBalance.sickLeaveTotalMonth = 0;
      leaveBalance.casualLeaveTotalMonth = 0;

      leaveBalance.lastFinancialYearReset = today.toDate();
      await leaveBalance.save();
    }

    // Check if today is 1st day of any month
    const isFirstDayOfMonth = today.date() === 1;

    const lastMonthlyReset = leaveBalance.lastMonthlyReset
      ? moment(leaveBalance.lastMonthlyReset)
      : null;
    const alreadyResetThisMonth =
      lastMonthlyReset?.month() === today.month() &&
      lastMonthlyReset?.year() === today.year();

    // if (isFirstDayOfMonth && !alreadyResetThisMonth) {
    //   console.log("Resetting monthly leave usage");

    //   // Reset monthly leave usage
    //   leaveBalance.sickLeaveTotalMonth = 0;
    //   leaveBalance.casualLeaveTotalMonth = 0;

    //   // Add monthly leaves (e.g., 2 per month)
    //   leaveBalance.sickLeaveAvailable += 1;
    //   leaveBalance.casualLeaveAvailable += 1;

    //   leaveBalance.sickLeave = leaveBalance.sickLeaveAvailable;
    //   leaveBalance.casualLeave = leaveBalance.casualLeaveAvailable;

    //   leaveBalance.lastMonthlyReset = today.toDate();
    //   await leaveBalance.save();
    // }

    const approvedLeaves = await WorkLog.find({
      userId,
      workType: "leave",
      leaveStatus: "approved",
    });

    let leaveTaken = {
      thisMonth: { sick: 0, casual: 0, lop: 0 },
      overall: { sick: 0, casual: 0, lop: 0 },
    };

    approvedLeaves.forEach((leave) => {
      const from = moment(leave.fromDate);
      const to = moment(leave.toDate);
      const totalDays = to.diff(from, "days") + 1;

      const isThisMonth = from.isBetween(startOfMonth, endOfMonth, "day", "[]");

      const lopDays = leave.lopDays || 0;
      let approvedDays = 0;

      if (leave.leaveMode === "HALF_DAY") {
        approvedDays = 0.5;
      } else {
        approvedDays = Math.max(totalDays - lopDays, 0);
      }

      // Add LOP days
      leaveTaken.overall.lop += lopDays;
      if (isThisMonth) leaveTaken.thisMonth.lop += lopDays;

      // Add approved non-LOP days based on leaveType
      if (leave.leaveType === "casualLeave") {
        leaveTaken.overall.casual += approvedDays;
        if (isThisMonth) leaveTaken.thisMonth.casual += approvedDays;
      } else if (leave.leaveType === "sickLeave") {
        leaveTaken.overall.sick += approvedDays;
        if (isThisMonth) leaveTaken.thisMonth.sick += approvedDays;
      }
    });
    const latestLeave = await WorkLog.findOne({
      userId,
      workType: "leave",
    }).sort({ createdAt: -1 }); // Use createdAt if you're logging timestamps

    let latestLeaveStatus = "pending";
    if (latestLeave) {
      latestLeaveStatus =
        latestLeave.leaveStatus && latestLeave.leaveStatus === "approved"
          ? "approved"
          : "pending";
    }
    // const response = {
    //   nonLOPLeavesAvailable: {
    //     sick: {
    //       thisMonth: leaveBalance.sickLeaveTotalMonth,
    //       overall: leaveBalance.sickLeaveAvailable,
    //     },
    //     casual: {
    //       thisMonth: leaveBalance.casualLeaveTotalMonth,
    //       overall: leaveBalance.casualLeaveAvailable,
    //     },
    //   },
    //   totalLeavesTaken: {
    //     lop: {
    //       thisMonth: leaveTaken.thisMonth.lop,
    //       overall: leaveTaken.overall.lop,
    //     },
    //     sick: {
    //       thisMonth: leaveBalance.sickLeaveTotalMonth,
    //       overall: leaveBalance.sickLeaveOverall,
    //     },
    //     casual: {
    //       thisMonth: leaveBalance.casualLeaveTotalMonth,
    //       overall: leaveBalance.casualLeaveOverall,
    //     },
    //     status: latestLeaveStatus,
    //   },
    // };

    const response = {
      nonLOPLeavesAvailable: {
        sick: {
          thisMonth: leaveTaken.thisMonth.sick, // DYNAMIC MONTHLY
          overall: leaveBalance.sickLeaveAvailable, // YEARLY AVAILABLE
        },
        casual: {
          thisMonth: leaveTaken.thisMonth.casual, // DYNAMIC MONTHLY
          overall: leaveBalance.casualLeaveAvailable, // YEARLY AVAILABLE
        },
      },

      totalLeavesTaken: {
        lop: {
          thisMonth: leaveTaken.thisMonth.lop, // MONTHLY LOP
          overall: leaveTaken.overall.lop, // TOTAL LOP
        },
        sick: {
          thisMonth: leaveTaken.thisMonth.sick, // MONTHLY SICK
          overall: leaveBalance.sickLeaveOverall, // TOTAL SICK
        },
        casual: {
          thisMonth: leaveTaken.thisMonth.casual, // MONTHLY CASUAL
          overall: leaveBalance.casualLeaveOverall, // TOTAL CASUAL
        },
        status: latestLeaveStatus,
      },

      compensation: {
        available: leaveBalance.compLeaveAvailable,
        used: leaveBalance.compLeaveUsed,
        total: leaveBalance.compLeave,
      },

    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error in calculateLeaveData:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const checkLeaveBalanceLeftOrNot = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const leaveBalance = await LeaveBalance.findOne({ userId });

    if (!leaveBalance) {
      return res.status(404).json({ message: "Leave balance not found" });
    }

    // Check if any leave balance is left
    const hasLeaveBalance =
      leaveBalance.sickLeaveAvailable > 0 ||
      leaveBalance.casualLeaveAvailable > 0;

    res.status(200).json({ hasLeaveBalance });
  } catch (error) {
    console.error("Error in checkLeaveBalanceLeftOrNot:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const simulateCarryForward = async (req, res) => {
  // try {
  //   const { userId } = req.params;
  //   const userLeave = await LeaveBalance.findOne({ userId });
  //   if (!userLeave) {
  //     return res.status(404).json({ message: "User leave not found" });
  //   }
  //   // 1. Simulate carry forward logic
  //   // Carry forward 1 sick leave if not already taken from next month
  //   if (!userLeave.sickTakenNextMonth) {
  //     userLeave.sickLeaveAvailable += 1;
  //   }
  //   // 2. Reset casual leave every month (no carry forward)
  //   userLeave.casualLeaveAvailable = 1;
  //   // 3. Reset the monthly flags
  //   userLeave.sickTakenNextMonth = false;
  //   userLeave.casualTakenNextMonth = false;
  //   // Optional: Reset monthly totals (if needed)
  //   userLeave.sickLeaveTotalMonth = 0;
  //   userLeave.casualLeaveTotalMonth = 0;
  //   await userLeave.save();
  //   return res.status(200).json({
  //     message: "Leave balance updated with carry forward and reset",
  //     updatedSickLeaveBalance: userLeave.sickLeaveAvailable,
  //     resetCasualLeaveBalance: userLeave.casualLeaveAvailable,
  //   });
  // } catch (error) {
  //   console.error("Error in simulateCarryForward:", error);
  //   return res
  //     .status(500)
  //     .json({ message: "Server error", error: error.message });
  // }
};

export const getAllLeaveRequestsAuditor = async (req, res) => {
  try {
    let {
      page = 1,
      pageSize = 10,
      sort = "newproposal", // default
      fromDate,
      toDate,
      leaveStatus,
      keyword,
      auditorId,
    } = req.query;

    if (!auditorId) {
      return res.status(400).json({ message: "Auditor ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(auditorId)) {
      return res.status(400).json({ message: "Invalid auditor ID" });
    }

    const pageNumber = parseInt(page, 10);
    const sizePerPage = parseInt(pageSize, 10);

    if (
      isNaN(pageNumber) ||
      pageNumber < 1 ||
      isNaN(sizePerPage) ||
      sizePerPage < 1
    ) {
      return res
        .status(400)
        .json({ message: "Invalid page or pageSize parameter" });
    }

    
    let query = {
      workType: { $in: ["leave", "permission"] },
      userId: auditorId,
    };

    if (leaveStatus) {
      query.leaveStatus = leaveStatus;
    }

    // Explicit date filter (highest priority)
    if (fromDate) {
      const start = istStartOfDay(fromDate);
      const end = istEndOfDay(toDate || fromDate);

      query.$or = [
        {
          workType: "leave",
          fromDate: { $gte: start, $lte: end },
        },
        {
          workType: "permission",
          permissionDate: { $gte: start, $lte: end },
        },
      ];
    }
    // NEW PROPOSAL → last 7 days only
    else if (sort === "newproposal") {
      query.createdAt = {
        $gte: istStartOfDay(
          moment().subtract(7, "days").format("YYYY-MM-DD")
        ),
        $lte: istEndOfDay(moment().format("YYYY-MM-DD")),
      };
    }
    
    let sortQuery = { createdAt: -1 }; // newest first

    
    let leaveRequests = await WorkLog.find(query)
      .sort(sortQuery)
      .skip((pageNumber - 1) * sizePerPage)
      .limit(sizePerPage)
      .populate("userId", "userName")
      .select(
        "userId leaveType leaveMode reason startTime endTime fromDate toDate permissionDate permissionHours isLOP leaveStatus createdAt"
      );

  
    if (keyword) {
      const searchRegex = new RegExp(keyword, "i");
      leaveRequests = leaveRequests.filter((log) => {
        return (
          searchRegex.test(log.leaveType) ||
          searchRegex.test(log.reason) ||
          searchRegex.test(log?.userId?.userName || "")
        );
      });
    }

    const totalLeaveRequests = keyword
      ? leaveRequests.length
      : await WorkLog.countDocuments(query);

  
    res.status(200).json({
      data: leaveRequests.map((log) => ({
        ...log.toObject(),
        requester_name: log.userId?.userName || "N/A",
        userId: log.userId?._id,
        startTime: log.startTime
          ? moment(log.startTime).format("HH:mm A")
          : "N/A",
        endTime: log.endTime
          ? moment(log.endTime).format("HH:mm A")
          : "N/A",
        fromDate: log.fromDate
          ? moment(log.fromDate).format("DD-MM-YYYY")
          : "N/A",
        toDate: log.toDate
          ? moment(log.toDate).format("DD-MM-YYYY")
          : "N/A",
        requestDate: moment(log.createdAt).format("DD-MM-YYYY"),
        requestDateAndTime: moment(log.createdAt).format(
          "DD-MM-YYYY HH:mm A"
        ),
        leaveType: log.leaveType,
        reason: log.reason,
        isLOP: log.isLOP,
        leaveStatus: log.leaveStatus,
        leaveMode: log.leaveMode,
        permissionDate: log.permissionDate
          ? moment(log.permissionDate)
            .tz("Asia/Kolkata")
            .format("DD-MM-YYYY")
          : "N/A",
        permissionHours: log.permissionHours,
      })),
      total: totalLeaveRequests,
      page: pageNumber,
      pageSize: sizePerPage,
      totalPages: Math.ceil(totalLeaveRequests / sizePerPage),
      sort,
      //  fromDate: fromDate || moment().subtract(7, "days").format("YYYY-MM-DD"),
      // toDate: toDate || moment().format("YYYY-MM-DD"),
    });
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    res.status(500).json({ message: "Server error" });
  }
};


export const runCarryForwardForAllUsers = async () => {
  // try {
  //   const allUsers = await LeaveBalance.find({});
  //   for (const userLeave of allUsers) {
  //     // Skip if already used next month's sick leave
  //     if (!userLeave.sickTakenNextMonth) {
  //       userLeave.sickLeaveAvailable += 1;
  //     }
  //     // Reset casual leave (no carry forward)
  //     userLeave.casualLeaveAvailable = 1;
  //     // Reset flags
  //     userLeave.sickTakenNextMonth = false;
  //     userLeave.casualTakenNextMonth = false;
  //     // Reset monthly usage
  //     userLeave.sickLeaveTotalMonth = 0;
  //     userLeave.casualLeaveTotalMonth = 0;
  //     await userLeave.save();
  //   }
  //   console.log("✔️ Monthly leave carry forward completed.");
  // } catch (error) {
  //   console.error("❌ Error in carry forward process:", error.message);
  // }
};

// export const resetFinancialYearLeave = async () => {
//   try {
//     const allUsers = await LeaveBalance.find({});

//     for (const userLeave of allUsers) {
//       userLeave.sickLeaveAvailable = 1;
//       userLeave.casualLeaveAvailable = 1;

//       // Optional: Reset usage counters
//       userLeave.sickLeaveTotalMonth = 0;
//       userLeave.sickLeaveOverall = 0;
//       userLeave.casualLeaveTotalMonth = 0;
//       userLeave.casualLeaveOverall = 0;

//       // Optional: Reset flags
//       userLeave.sickTakenNextMonth = false;
//       userLeave.casualTakenNextMonth = false;

//       await userLeave.save();
//     }

//     console.log("✅ Leave reset for financial year completed.");
//   } catch (error) {
//     console.error("❌ Error resetting leave balances:", error.message);
//   }
// };

export const resetFinancialYearLeave = async () => {
  try {
    const users = await LeaveBalance.find({});

    for (const u of users) {
      // carry forward remaining balance
      const carrySick = u.sickLeaveAvailable;
      const carryCasual = u.casualLeaveAvailable;

      // yearly quota + carry forward
      u.sickLeaveAvailable = 12 + carrySick;
      u.casualLeaveAvailable = 12 + carryCasual;

      // reset yearly usage
      u.sickLeaveOverall = 0;
      u.casualLeaveOverall = 0;

      // reset monthly cache fields
      u.sickLeaveTotalMonth = 0;
      u.casualLeaveTotalMonth = 0;

      u.lastFinancialYearReset = new Date();
      await u.save();
    }

    console.log("🎉 YEARLY RESET DONE");
  } catch (err) {
    console.log("Error in yearly reset", err);
  }
};

export const getPermissionHistory = async (req, res) => {
  try {
    const { userId, fromDate, toDate } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "UserId required" });
    }

    const query = {
      userId,
      workType: "permission",
    };

    if (fromDate && toDate) {
      query.permissionDate = {
        $gte: istStartOfDay(fromDate),
        $lte: istEndOfDay(toDate),
      };
    }

    const permissions = await WorkLog.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      data: permissions.map((p) => ({
        date: moment(p.permissionDate).tz("Asia/Kolkata").format("DD-MM-YYYY"),
        hours: p.permissionHours,
        reason: p.reason,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
