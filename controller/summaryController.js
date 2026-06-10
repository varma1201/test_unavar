import ExcelJS from "exceljs";
import moment from "moment";
import Proposal from "../models/proposalModel.js";
import Invoice from "../models/invoiceModel.js";
import AuditorPayment from "../models/auditorPaymentModel.js";
import WorkLog from "../models/workLogModel.js";
import { User } from "../models/usersModel.js";
import LeaveBalance from "../models/leaveBalanceSchema.js";

/**
 * Generates an Excel file with 6 different sheets
 * Query Parameters:
 * @param {string} startDate - Format: 'YYYY-MM-DD'
 * @param {string} endDate   - Format: 'YYYY-MM-DD'
 */

function getLeaveDates(fromDate, leaveDays) {
  const dates = [];
  let current = moment(fromDate).startOf("day");

  for (let i = 0; i < (leaveDays || 1); i++) {
    dates.push(current.clone());
    current.add(1, "day");
  }

  return dates;
}


export const generateProposalExcel = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    console.log(startDate + " " + endDate);
    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Both startDate and endDate are required in YYYY-MM-DD format",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        message: "Invalid date format. Please use YYYY-MM-DD format",
      });
    }
    // Fetch proposals in date range

    // Fetch proposals in date range - UPDATED to populate representative
    const proposals = await Proposal.find({
      proposal_date: { $gte: start, $lte: end },
    })
      .populate({
        path: "enquiryId",
      })
      .populate({
        path: "representative",
        select: "userName",
      })
      .lean()
      .then((proposals) => {
        return proposals.map((proposal) => {
          // Calculate total proposal value including GST
          const totalValue = proposal.outlets
            ? proposal.outlets.reduce((sum, outlet) => {
              const outletValue = outlet.quantity * outlet.unit_cost;
              return sum + outletValue;
            }, 0)
            : 0;

          const totalWithGST = totalValue + totalValue * 0.18; // Adding 18% GST

          return {
            ...proposal,
            outletCount: proposal.outlets ? proposal.outlets.length : 0,
            totalValue: totalValue,
            totalWithGST: totalWithGST,
          };
        });
      });

    // const proposals = await Proposal.find({
    //   proposal_date: { $gte: start, $lte: end },
    // })
    //   .populate({
    //     path: "enquiryId",
    //   })
    //   .lean()
    //   .then((proposals) => {
    //     return proposals.map((proposal) => {
    //       // Calculate total proposal value including GST
    //       const totalValue = proposal.outlets
    //         ? proposal.outlets.reduce((sum, outlet) => {
    //             const outletValue = outlet.quantity * outlet.unit_cost;
    //             return sum + outletValue;
    //           }, 0)
    //         : 0;

    //       const totalWithGST = totalValue + totalValue * 0.18; // Adding 18% GST

    //       return {
    //         ...proposal,
    //         outletCount: proposal.outlets ? proposal.outlets.length : 0,
    //         totalValue: totalValue,
    //         totalWithGST: totalWithGST,
    //       };
    //     });
    //   });

    // Fetch all auditor payments for these proposals
    const proposalIds = proposals.map((p) => p._id);
    const auditorPayments = await AuditorPayment.find({
      proposalId: { $in: proposalIds },
    })
      .populate("auditorId")
      .lean();

    // Create a map of proposal payments
    const proposalPaymentsMap = auditorPayments.reduce((map, payment) => {
      if (!map[payment.proposalId]) {
        map[payment.proposalId] = [];
      }
      map[payment.proposalId].push(payment);
      return map;
    }, {});

    // Determine the maximum number of accepted payments for any proposal
    let maxPayments = 0;
    for (const proposalId in proposalPaymentsMap) {
      const payments = proposalPaymentsMap[proposalId];
      const acceptedCount = payments.filter(
        (p) => p.status === "accepted"
      ).length;
      if (acceptedCount > maxPayments) {
        maxPayments = acceptedCount;
      }
    }

    // Fetch invoices in date range
    const invoices = await Invoice.find({
      invoice_date: { $gte: start, $lte: end },
    }).lean();

    // Fetch daily work logs in date range
    // Fetch daily work logs in date range - UPDATED to include all necessary fields
    const workLogs = await WorkLog.find({
      workDate: {
        $gte: moment(start).startOf("day").toDate(),
        $lte: moment(end).endOf("day").toDate(),
      },
    })
      .populate("userId", "userName")
      .select(
        "workType description startTime endTime workDate createdAt userId initiative mouType auditNo revenue auditDetail leaveType leaveStatus isLOP reason permissionHours fromDate permissionDate leaveDays leaveMode proposalNumber"
      ) // Added necessary fields
      .lean();

    console.log("sample dailyworklog:", workLogs[0]?.proposalNumber, workLogs[0]);
    // Fetch all representatives
    const representatives = await User.find({})
      .select("_id userName userId")
      .lean();

    // Fetch all leave balances
    const leaveBalances = await LeaveBalance.find({
      userId: { $ne: null },
    })
      .populate("userId", "_id")
      .lean();

    // Create map for quick lookup
    const leaveBalanceMap = {};

    leaveBalances.forEach((lb) => {
      if (lb.userId && lb.userId._id) {
        leaveBalanceMap[lb.userId._id.toString()] = lb;
      }
    });

    // Group work logs by date
    // Process work logs for Daily Work Sample - each work log in separate row
    // const dailyWorkData = workLogs
    //   .filter((log) => {
    //     if (log.workType === "leave" && log.leaveStatus !== "approved") {
    //       return false;
    //     }

    //     if (log.workType === "permission" && log.leaveStatus !== "approved") {
    //       return false;
    //     }

    //     return true;
    //   })
    //   .map((log) => {
    //     // Handle leave descriptions separately
    //     // let workPlan = "";
    //     // let workDetails = "";

    //     // if (log.workType === "leave" && log.leaveStatus === "approved") {
    //     //   // Handle leave descriptions
    //     //   let leaveDesc = "";
    //     //   if (log.leaveType === "sickLeave") {
    //     //     leaveDesc = "Sick Leave";
    //     //   } else if (log.leaveType === "casualLeave") {
    //     //     leaveDesc = "Casual Leave";
    //     //   }
    //     //   if (log.isLOP) {
    //     //     leaveDesc += leaveDesc ? " + LOP" : "LOP";
    //     //   }
    //     //   workPlan = leaveDesc; // ADD THIS LINE
    //     //   workDetails = ""; // Leave details go in workPlan only
    //     // } else {
    //     //   // For non-leave work types, split between workPlan and workDetails
    //     //   workPlan = log.description || "";
    //     //   workDetails = log.auditDetail || "";
    //     // }

    //     let workPlan = "";
    //     let workDetails = "";
    //     let workDate;

    //     if (
    //       log.workType === "leave" &&
    //       log.leaveStatus === "approved" &&
    //       log.fromDate
    //     ) {
    //       let leaveText = "";
    //       workDate = log.fromDate;
    //       if (log.leaveType === "sickLeave") {
    //         leaveText = "Sick Leave";
    //       } else if (log.leaveType === "casualLeave") {
    //         leaveText = "Casual Leave";
    //       } else {
    //         leaveText = "LOP";
    //       }

    //       const leaveDays =
    //         log.leaveMode === "HALF_DAY" ? 0.5 : log.leaveDays || 1;

    //       if (log.leaveMode === "HALF_DAY") {
    //         leaveText = `Half Day – ${leaveText}`;
    //       }

    //       leaveText += ` (${leaveDays} ${leaveDays === 1 ? "Day" : "Days"})`;

    //       if (log.isLOP && log.leaveType !== "lop") {
    //         leaveText += " (LOP)";
    //       }

    //       workPlan = leaveText;
    //       workDetails = log.reason;
    //     } else if (
    //       log.workType === "permission" &&
    //       log.leaveStatus === "approved" &&
    //       log.permissionDate
    //     ) {
    //       const hours = log.permissionHours || 0;
    //       workPlan = `Permission (${hours} Hrs)`;
    //       workDetails = log.reason;
    //       workDate = log.permissionDate;
    //     } else {
    //       workPlan = log.description || "";
    //       workDetails = log.auditDetail || "";
    //       workDate = log.workDate || log.createdAt;
    //     }

    //     // Initialize initiative data
    //     const initiativeData = {
    //       hrMOU: "",
    //       hrNonMou: "",
    //       hrRevenueMOU: "",
    //       hrRevenueNonMou: "",
    //       ercMOU: "",
    //       ercNonMou: "",
    //       ercRevenueMOU: "",
    //       ercRevenueNonMou: "",
    //       bhogMOU: "",
    //       bhogNonMou: "",
    //       bhogRevenueMOU: "",
    //       bhogRevenueNonMou: "",
    //       csfhMOU: "",
    //       csfhNonMou: "",
    //       csfhRevenueMOU: "",
    //       csfhRevenueNonMou: "",
    //       cvmMOU: "",
    //       cvmNonMou: "",
    //       cvmRevenueMOU: "",
    //       cvmRevenueNonMou: "",
    //       ersMOU: "",
    //       ersNonMou: "",
    //       ersRevenueMOU: "",
    //       ersRevenueNonMou: "",
    //       tpaMOU: "",
    //       tpaNonMou: "",
    //       tpaRevenueMOU: "",
    //       tpaRevenueNonMou: "",
    //       totalUnavarRevenueMOU: "",
    //       totalUnavarRevenueNonMou: "",
    //     };

    //     // Populate audit numbers and revenue based on initiative and MOU type
    //     if (log.initiative && log.mouType) {
    //       const initiativeKey = log.initiative.toLowerCase();

    //       if (log.mouType === "Mou" && log.auditNo) {
    //         // Set audit number in appropriate MOU column
    //         switch (initiativeKey) {
    //           case "hr":
    //             initiativeData.hrMOU = log.auditNo;
    //             initiativeData.hrRevenueMOU = log.revenue || "";
    //             break;
    //           case "erc":
    //             initiativeData.ercMOU = log.auditNo;
    //             initiativeData.ercRevenueMOU = log.revenue || "";
    //             break;
    //           case "bhog":
    //             initiativeData.bhogMOU = log.auditNo;
    //             initiativeData.bhogRevenueMOU = log.revenue || "";
    //             break;
    //           case "csfh":
    //             initiativeData.csfhMOU = log.auditNo;
    //             initiativeData.csfhRevenueMOU = log.revenue || "";
    //             break;
    //           case "cvm":
    //             initiativeData.cvmMOU = log.auditNo;
    //             initiativeData.cvmRevenueMOU = log.revenue || "";
    //             break;
    //           case "ers":
    //             initiativeData.ersMOU = log.auditNo;
    //             initiativeData.ersRevenueMOU = log.revenue || "";
    //             break;
    //           case "tpa":
    //             initiativeData.tpaMOU = log.auditNo;
    //             initiativeData.tpaRevenueMOU = log.revenue || "";
    //             break;
    //         }
    //         initiativeData.totalUnavarRevenueMOU = log.revenue || "";
    //       } else if (log.mouType === "Non-Mou" && log.auditNo) {
    //         // Set audit number in appropriate Non-MOU column
    //         switch (initiativeKey) {
    //           case "hr":
    //             initiativeData.hrNonMou = log.auditNo;
    //             initiativeData.hrRevenueNonMou = log.revenue || "";
    //             break;
    //           case "erc":
    //             initiativeData.ercNonMou = log.auditNo;
    //             initiativeData.ercRevenueNonMou = log.revenue || "";
    //             break;
    //           case "bhog":
    //             initiativeData.bhogNonMou = log.auditNo;
    //             initiativeData.bhogRevenueNonMou = log.revenue || "";
    //             break;
    //           case "csfh":
    //             initiativeData.csfhNonMou = log.auditNo;
    //             initiativeData.csfhRevenueNonMou = log.revenue || "";
    //             break;
    //           case "cvm":
    //             initiativeData.cvmNonMou = log.auditNo;
    //             initiativeData.cvmRevenueNonMou = log.revenue || "";
    //             break;
    //           case "ers":
    //             initiativeData.ersNonMou = log.auditNo;
    //             initiativeData.ersRevenueNonMou = log.revenue || "";
    //             break;
    //           case "tpa":
    //             initiativeData.tpaNonMou = log.auditNo;
    //             initiativeData.tpaRevenueNonMou = log.revenue || "";
    //             break;
    //         }
    //         initiativeData.totalUnavarRevenueNonMou = log.revenue || "";
    //       }
    //     }

    //     return {
    //       date: moment(workDate).tz("Asia/Kolkata").format("YYYY-MM-DD"),
    //       executiveName: log.userId?.userName || "N/A",
    //       workPlan: workPlan, // Changed from description
    //       workDetails: workDetails, // New field for audit detail
    //       remarks: log.remarks || "",
    //       ...initiativeData,
    //     };
    //   });

    // STEP 1: Group worklogs by Date + Executive
    const groupedLogs = {};

    // workLogs.forEach((log) => {
    //   // Ignore unapproved leave/permission
    //   if (
    //     (log.workType === "leave" || log.workType === "permission") &&
    //     log.leaveStatus !== "approved"
    //   ) {
    //     return;
    //   }

    //   const workDate =
    //     log.workType === "leave"
    //       ? log.fromDate
    //       : log.workType === "permission"
    //         ? log.permissionDate
    //         : log.workDate || log.createdAt;

    //   if (!workDate || !log.userId?._id) return;

    //   const dateKey = moment(workDate).tz("Asia/Kolkata").format("YYYY-MM-DD");
    //   const groupKey = `${dateKey}_${log.userId._id}`;

    //   if (!groupedLogs[groupKey]) {
    //     groupedLogs[groupKey] = {
    //       date: dateKey,
    //       executiveName: log.userId.userName,
    //       proposalNumber: [],
    //       workPlan: [],
    //       workDetails: [],
    //       remarks: [],
    //       initiativeData: {
    //         hrMOU: "",
    //         hrNonMou: "",
    //         hrRevenueMOU: "",
    //         hrRevenueNonMou: "",
    //         ercMOU: "",
    //         ercNonMou: "",
    //         ercRevenueMOU: "",
    //         ercRevenueNonMou: "",
    //         bhogMOU: "",
    //         bhogNonMou: "",
    //         bhogRevenueMOU: "",
    //         bhogRevenueNonMou: "",
    //         csfhMOU: "",
    //         csfhNonMou: "",
    //         csfhRevenueMOU: "",
    //         csfhRevenueNonMou: "",
    //         cvmMOU: "",
    //         cvmNonMou: "",
    //         cvmRevenueMOU: "",
    //         cvmRevenueNonMou: "",
    //         ersMOU: "",
    //         ersNonMou: "",
    //         ersRevenueMOU: "",
    //         ersRevenueNonMou: "",
    //         tpaMOU: "",
    //         tpaNonMou: "",
    //         tpaRevenueMOU: "",
    //         tpaRevenueNonMou: "",
    //         totalUnavarRevenueMOU: 0,
    //         totalUnavarRevenueNonMou: 0,
    //       },
    //     };
    //   }

    //   const group = groupedLogs[groupKey];

    //   // ---------- WORK PLAN ----------
    //   // if (log.workType === "leave") {
    //   //   let txt =
    //   //     log.leaveType === "sickLeave"
    //   //       ? "Sick Leave"
    //   //       : log.leaveType === "casualLeave"
    //   //         ? "Casual Leave"
    //   //         : "LOP";
    //   if (log.workType === "leave") {
    //     let txt =
    //       log.leaveType === "sickLeave"
    //         ? "Sick Leave"
    //         : log.leaveType === "casualLeave"
    //           ? "Casual Leave"
    //           : log.leaveType === "compensationLeave"
    //             ? "Compensation Leave"
    //             : "LOP";

    //     if (log.leaveMode === "HALF_DAY") txt = `Half Day - ${txt}`;
    //     group.workPlan.push(txt);
    //     if (log.reason) group.workDetails.push(log.reason);
    //   } else if (log.workType === "permission") {
    //     group.workPlan.push(`Permission (${log.permissionHours || 0} Hrs)`);
    //     if (log.reason) group.workDetails.push(log.reason);
    //   } else {
    //     if (log.description) group.workPlan.push(log.description);
    //     if (log.auditDetail) group.workDetails.push(log.auditDetail);
    //   }

    //   if (log.remarks) group.remarks.push(log.remarks);

    //   // ---------- INITIATIVE DATA ----------
    //   if (log.initiative && log.mouType && log.auditNo) {
    //     const key = log.initiative.toLowerCase();
    //     const revenue = Number(log.revenue) || 0;

    //     if (log.mouType === "Mou") {
    //       group.initiativeData[`${key}MOU`] = group.initiativeData[`${key}MOU`]
    //         ? `${group.initiativeData[`${key}MOU`]}, ${log.auditNo}`
    //         : log.auditNo;

    //       group.initiativeData[`${key}RevenueMOU`] =
    //         (Number(group.initiativeData[`${key}RevenueMOU`]) || 0) + revenue;

    //       group.initiativeData.totalUnavarRevenueMOU += revenue;
    //     } else {
    //       group.initiativeData[`${key}NonMou`] = group.initiativeData[
    //         `${key}NonMou`
    //       ]
    //         ? `${group.initiativeData[`${key}NonMou`]}, ${log.auditNo}`
    //         : log.auditNo;

    //       group.initiativeData[`${key}RevenueNonMou`] =
    //         (Number(group.initiativeData[`${key}RevenueNonMou`]) || 0) +
    //         revenue;

    //       group.initiativeData.totalUnavarRevenueNonMou += revenue;
    //     }
    //   }

    //   // ---------------PROPOSAL NUMBER-----------
    //   if (log.proposalNumber) {
    //     if (!group.proposalNumber.includes(log.proposalNumber)) {
    //       group.proposalNumber.push(log.proposalNumber);
    //     }
    //   }
    // });

    workLogs.forEach((log) => {
      // Ignore unapproved leave/permission
      if (
        (log.workType === "leave" || log.workType === "permission") &&
        log.leaveStatus !== "approved"
      ) {
        return;
      }

      let datesToProcess = [];

      //  CHANGE: expand leave date range
      // if (log.workType === "leave" && log.fromDate && log.toDate) {
      //   datesToProcess = getDateRange(log.fromDate, log.toDate);
      // } 

      if (log.workType === "leave" && log.fromDate) {
        datesToProcess = getLeaveDates(
          log.fromDate,
          log.leaveMode === "HALF_DAY" ? 1 : log.leaveDays || 1
        );
      }

      else {
        const singleDate =
          log.workType === "permission"
            ? log.permissionDate
            : log.workDate || log.createdAt;

        if (singleDate) {
          datesToProcess = [moment(singleDate)];
        }
      }

      datesToProcess.forEach((dateMoment) => {
        if (!log.userId?._id) return;

        const dateKey = dateMoment
          .tz("Asia/Kolkata")
          .format("YYYY-MM-DD");

        const groupKey = `${dateKey}_${log.userId._id}`;

        if (!groupedLogs[groupKey]) {
          groupedLogs[groupKey] = {
            date: dateKey,
            executiveName: log.userId.userName,
            proposalNumber: [],
            workPlan: [],
            workDetails: [],
            remarks: [],
            initiativeData: {
              hrMOU: "",
              hrNonMou: "",
              hrRevenueMOU: "",
              hrRevenueNonMou: "",
              ercMOU: "",
              ercNonMou: "",
              ercRevenueMOU: "",
              ercRevenueNonMou: "",
              bhogMOU: "",
              bhogNonMou: "",
              bhogRevenueMOU: "",
              bhogRevenueNonMou: "",
              csfhMOU: "",
              csfhNonMou: "",
              csfhRevenueMOU: "",
              csfhRevenueNonMou: "",
              cvmMOU: "",
              cvmNonMou: "",
              cvmRevenueMOU: "",
              cvmRevenueNonMou: "",
              ersMOU: "",
              ersNonMou: "",
              ersRevenueMOU: "",
              ersRevenueNonMou: "",
              tpaMOU: "",
              tpaNonMou: "",
              tpaRevenueMOU: "",
              tpaRevenueNonMou: "",
              totalUnavarRevenueMOU: 0,
              totalUnavarRevenueNonMou: 0,
            },
          };
        }

        const group = groupedLogs[groupKey];

        // 🔹 EXISTING logic (UNCHANGED)
        if (log.workType === "leave") {
          let txt =
            log.leaveType === "sickLeave"
              ? "Sick Leave"
              : log.leaveType === "casualLeave"
                ? "Casual Leave"
                : log.leaveType === "compensationLeave"
                  ? "Compensation Leave"
                  : "LOP";

          if (log.leaveMode === "HALF_DAY") txt = `Half Day - ${txt}`;
          group.workPlan.push(txt);
          if (log.reason) group.workDetails.push(log.reason);
        } else if (log.workType === "permission") {
          group.workPlan.push(`Permission (${log.permissionHours || 0} Hrs)`);
          if (log.reason) group.workDetails.push(log.reason);
        } else {
          if (log.description) group.workPlan.push(log.description);
          if (log.auditDetail) group.workDetails.push(log.auditDetail);
        }

        if (log.remarks) group.remarks.push(log.remarks);


        // ---------- INITIATIVE DATA ----------
        if (log.initiative && log.mouType && log.auditNo) {
          const key = log.initiative.toLowerCase();
          const revenue = Number(log.revenue) || 0;

          if (log.mouType === "Mou") {
            group.initiativeData[`${key}MOU`] = group.initiativeData[`${key}MOU`]
              ? `${group.initiativeData[`${key}MOU`]}, ${log.auditNo}`
              : log.auditNo;

            group.initiativeData[`${key}RevenueMOU`] =
              (Number(group.initiativeData[`${key}RevenueMOU`]) || 0) + revenue;

            group.initiativeData.totalUnavarRevenueMOU += revenue;
          } else {
            group.initiativeData[`${key}NonMou`] = group.initiativeData[
              `${key}NonMou`
            ]
              ? `${group.initiativeData[`${key}NonMou`]}, ${log.auditNo}`
              : log.auditNo;

            group.initiativeData[`${key}RevenueNonMou`] =
              (Number(group.initiativeData[`${key}RevenueNonMou`]) || 0) +
              revenue;

            group.initiativeData.totalUnavarRevenueNonMou += revenue;
          }
        }

        // ---------------PROPOSAL NUMBER-----------

        if (log.proposalNumber && !group.proposalNumber.includes(log.proposalNumber)) {
          group.proposalNumber.push(log.proposalNumber);
        }
      });
    });


    const dailyWorkData = Object.values(groupedLogs)
      .map((g) => ({
        date: g.date,
        executiveName: g.executiveName,
        proposalNumber: g.proposalNumber.join(", "),
        workPlan: g.workPlan.join("\n\n"),
        workDetails: g.workDetails.join("\n\n"),
        remarks: g.remarks.join("\n\n"),
        ...g.initiativeData,
      }))
      .sort((a, b) => moment(a.date).valueOf() - moment(b.date).valueOf());

    dailyWorkData.sort((a, b) => {
      return (
        moment(a.date, "YYYY-MM-DD").valueOf() -
        moment(b.date, "YYYY-MM-DD").valueOf()
      );
    });
    // console.log("dailyWorkData:", dailyWorkData);

    // console.log(proposals);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();

    // 1. Proposal Sheet (updated columns from image)
    const proposalSheet = workbook.addWorksheet("Proposal Sheet");
    proposalSheet.columns = [
      { header: "Date", key: "date", width: 15 },
      { header: "Proposal Number", key: "number", width: 18 },
      { header: "Client Name", key: "clientName", width: 30 },

      // { header: "Location", key: "location", width: 20 },

      { header: "Email Id", key: "emailId", width: 35 },
     

      { header: "Phone No", key: "phone", width: 18 },
      { header: "GST No", key: "gstNo", width: 20 },

      { header: "Address", key: "address", width: 45 },
      { header: "City & State", key: "state", width: 20 },
      { header: "Pincode", key: "pincode", width: 12 },


      { header: "Scope", key: "scope", width: 20 },
      { header: "Outlet Count", key: "count", width: 15 },
      { header: "ProposalValue", key: "value", width: 12 },
      { header: "Representative", key: "representative", width: 25 },
    ];

    // 2. Invoice Format Sheet (updated columns from image)
    const invoiceSheet = workbook.addWorksheet("Invoice Format");
    invoiceSheet.columns = [
      { header: "Sr. No/Invoice Number", key: "invoiceNumber", width: 28 },
      { header: "Date", key: "date", width: 22 },
      { header: "Field Executive Name", key: "fieldExecutiveName", width: 30 },
      { header: "Team Leader Name", key: "teamLeaderName", width: 30 },
      { header: "Client Name", key: "clientName", width: 35 },

      { header: "Email Id", key: "emailId", width: 40 },
      { header: "Phone No", key: "phone", width: 18 },
      { header: "GST No", key: "gstNo", width: 20 },

      { header: "Address", key: "address", width: 55 },
      { header: "State", key: "state", width: 20 },
      { header: "Pincode", key: "pincode", width: 12 },
      // { header: "Location", key: "location", width: 25 },
      // { header: "Zone", key: "zone", width: 20 },
      ...Array.from(
        {
          length: Math.max(...invoices.map((inv) => inv.outlets?.length || 0)),
        },
        (_, index) => [
          {
            header: `WORK ${index + 1}`,
            key: `work${index + 1}service`,
            width: 20,
          },
          {
            header: `WORK ${index + 1}: Qty`,
            key: `work${index + 1}Qty`,
            width: 10,
          },
          { header: "Unit Cost", key: `work${index + 1}UnitCost`, width: 20 },
          {
            header: `Total WORK ${index + 1}`,
            key: `work${index + 1}Total`,
            width: 22,
          },
        ]
      ).flat(),
      { header: "Overall Total", key: "overallTotal", width: 15 },
      { header: "GST (18%)", key: "gst", width: 10 },
      {
        header: "Bill Value including GST",
        key: "billValueWithGST",
        width: 30,
      },
      { header: "Amount Receivable", key: "amountReceivable", width: 15 },

      {
        header: "Invoice sent to client",
        key: "invoiceSentToClient",
        width: 30,
      },
      { header: "Payment status", key: "paymentStatus", width: 15 },
    ];

    // 3. Proposal Wise Payment Summary
    const paymentSummarySheet = workbook.addWorksheet("Payment Summary");
    paymentSummarySheet.columns = [
      { header: "Proposal Number", key: "proposalNumber", width: 15 },
      { header: "FBO Name", key: "fboName", width: 30 },
      { header: "No. of Payments", key: "paymentCount", width: 15 },
      { header: "Proposal Value", key: "proposalValue", width: 15 },
      { header: "Payment Received", key: "paymentReceived", width: 15 },
      { header: "Balance Amount", key: "balanceAmount", width: 15 },
      ...Array.from({ length: maxPayments }).flatMap((_, idx) => [
        { header: `Payment ${idx + 1}`, key: `Payment ${idx + 1}`, width: 15 },
        {
          header: `Auditor Name ${idx + 1}`,
          key: `Auditor Name ${idx + 1}`,
          width: 20,
        },
      ]),
    ];

    // 4. Daily Work Sample
    const dailyWorkSheet = workbook.addWorksheet("Daily Work");

    // Define the two-row header
    const headerRow1 = [
      "Date",
      "Executive Name",
      "Proposal Number",
      "Work Plan",
      "Work Details/Description",
      "HR",
      "", // This will be merged later
      "HR Revenue",
      "",
      "ERC",
      "",
      "ERC Revenue",
      "",
      "BHOG",
      "",
      "BHOG Revenue",
      "",
      "CSFH",
      "",
      "CSFH Revenue",
      "",
      "CVM",
      "",
      "CVM Revenue",
      "",
      "ERS",
      "",
      "ERS Revenue",
      "",
      "TPA",
      "",
      "TPA Revenue",
      "",
      "Total Unavar Revenue",
      "",
      "Remarks",
    ];

    const headerRow2 = [
      "",
      "",
      "", // For Date, Executive Name, Description
      "", // For Work Details/Description
      "",
      "MOU",
      "Non Mou",
      "MOU",
      "Non Mou",
      "MOU",
      "Non Mou",
      "MOU",
      "Non Mou",
      "MOU",
      "Non Mou",
      "MOU",
      "Non Mou",
      "MOU",
      "Non Mou",
      "MOU",
      "Non Mou",
      "MOU",
      "Non Mou",
      "MOU",
      "Non Mou",
      "MOU",
      "Non Mou",
      "MOU",
      "Non Mou",
      "MOU",
      "Non Mou",
      "MOU",
      "Non Mou",
      "MOU",
      "Non Mou",
      "",
    ];
    dailyWorkSheet.addRow(headerRow1);
    const headerRow2Actual = dailyWorkSheet.addRow(headerRow2);

    // Define the columns for data rows (based on the second header row)
    dailyWorkSheet.columns = [
      { key: "date", width: 15 },
      { key: "executiveName", width: 25 },
      { key: "proposalNumber", width: 25 },
      { key: "workPlan", width: 30 },
      { key: "workDetails", width: 50 },
      { key: "hrMOU", width: 10 },
      { key: "hrNonMou", width: 10 },
      { key: "hrRevenueMOU", width: 10 },
      { key: "hrRevenueNonMou", width: 10 },
      { key: "ercMOU", width: 10 },
      { key: "ercNonMou", width: 10 },
      { key: "ercRevenueMOU", width: 10 },
      { key: "ercRevenueNonMou", width: 10 },
      { key: "bhogMOU", width: 10 },
      { key: "bhogNonMou", width: 10 },
      { key: "bhogRevenueMOU", width: 10 },
      { key: "bhogRevenueNonMou", width: 10 },
      { key: "csfhMOU", width: 10 },
      { key: "csfhNonMou", width: 10 },
      { key: "csfhRevenueMOU", width: 10 },
      { key: "csfhRevenueNonMou", width: 10 },
      { key: "cvmMOU", width: 10 },
      { key: "cvmNonMou", width: 10 },
      { key: "cvmRevenueMOU", width: 10 },
      { key: "cvmRevenueNonMou", width: 10 },
      { key: "ersMOU", width: 10 },
      { key: "ersNonMou", width: 10 },
      { key: "ersRevenueMOU", width: 10 },
      { key: "ersRevenueNonMou", width: 10 },
      { key: "tpaMOU", width: 10 },
      { key: "tpaNonMou", width: 10 },
      { key: "tpaRevenueMOU", width: 10 },
      { key: "tpaRevenueNonMou", width: 10 },
      { key: "totalUnavarRevenueMOU", width: 10 },
      { key: "totalUnavarRevenueNonMou", width: 10 },
      { key: "remarks", width: 25 },
    ];

    // Merge cells for the first header row - UPDATED MERGES
    // dailyWorkSheet.mergeCells("A1:A2"); // Date
    // dailyWorkSheet.mergeCells("B1:B2"); // Executive Name
    // dailyWorkSheet.mergeCells("C1:C2"); // Work Plan
    // dailyWorkSheet.mergeCells("D1:D2"); // Work Details/Description - NEW MERGE
    // dailyWorkSheet.mergeCells("E1:F1"); // HR
    // dailyWorkSheet.mergeCells("G1:H1"); // HR Revenue
    // dailyWorkSheet.mergeCells("I1:J1"); // ERC
    // dailyWorkSheet.mergeCells("K1:L1"); // ERC Revenue
    // dailyWorkSheet.mergeCells("M1:N1"); // BHOG
    // dailyWorkSheet.mergeCells("O1:P1"); // BHOG Revenue
    // dailyWorkSheet.mergeCells("Q1:R1"); // CSFH
    // dailyWorkSheet.mergeCells("S1:T1"); // CSFH Revenue
    // dailyWorkSheet.mergeCells("U1:V1"); // CVM
    // dailyWorkSheet.mergeCells("W1:X1"); // CVM Revenue
    // dailyWorkSheet.mergeCells("Y1:Z1"); // ERS
    // dailyWorkSheet.mergeCells("AA1:AB1"); // ERS Revenue
    // dailyWorkSheet.mergeCells("AC1:AD1"); // TPA
    // dailyWorkSheet.mergeCells("AE1:AF1"); // TPA Revenue
    // dailyWorkSheet.mergeCells("AG1:AH1"); // Total Unavar Revenue
    // dailyWorkSheet.mergeCells("AI1:AI2"); // Remarks - UPDATED POSITION
    // // dailyWorkSheet.mergeCells("AJ1:AJ2"); // Remarks - UPDATED POSITION

    // Fixed columns
    dailyWorkSheet.mergeCells("A1:A2"); // Date
    dailyWorkSheet.mergeCells("B1:B2"); // Executive Name
    dailyWorkSheet.mergeCells("C1:C2"); // Proposal Number
    dailyWorkSheet.mergeCells("D1:D2"); // Work Plan
    dailyWorkSheet.mergeCells("E1:E2"); // Work Details

    // HR
    dailyWorkSheet.mergeCells("F1:G1");
    dailyWorkSheet.mergeCells("H1:I1");

    // ERC
    dailyWorkSheet.mergeCells("J1:K1");
    dailyWorkSheet.mergeCells("L1:M1");

    // BHOG
    dailyWorkSheet.mergeCells("N1:O1");
    dailyWorkSheet.mergeCells("P1:Q1");

    // CSFH
    dailyWorkSheet.mergeCells("R1:S1");
    dailyWorkSheet.mergeCells("T1:U1");

    // CVM
    dailyWorkSheet.mergeCells("V1:W1");
    dailyWorkSheet.mergeCells("X1:Y1");

    // ERS
    dailyWorkSheet.mergeCells("Z1:AA1");
    dailyWorkSheet.mergeCells("AB1:AC1");

    // TPA
    dailyWorkSheet.mergeCells("AD1:AE1");
    dailyWorkSheet.mergeCells("AF1:AG1");

    // Total Revenue
    dailyWorkSheet.mergeCells("AH1:AI1");

    // Remarks
    dailyWorkSheet.mergeCells("AJ1:AJ2");


    // Style header rows
    const headerRow1Style = dailyWorkSheet.getRow(1);
    headerRow1Style.font = { bold: true };
    headerRow1Style.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFC0CB" }, // Light red/pink
    };
    headerRow1Style.alignment = { vertical: "middle", horizontal: "center" };

    const headerRow2Style = dailyWorkSheet.getRow(2);
    headerRow2Style.font = { bold: true };
    headerRow2Style.alignment = { vertical: "middle", horizontal: "center" };

    // Apply specific colors to MOU and Non Mou cells in the second header row
    headerRow2Actual.eachCell((cell) => {
      if (cell.value === "MOU") {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF00B0F0" }, // Blue
        };
      } else if (cell.value === "Non Mou") {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF92D050" }, // Green
        };
      }
    });

    // Add data to Proposal Sheet (example, update mapping as per your model)
    proposals.forEach((proposal) => {
      proposalSheet.addRow({
        date: proposal.proposal_date
          ? moment(proposal.proposal_date).format("DD.MM.YYYY")
          : "",
        number: proposal.proposal_number || "",
        clientName: proposal.fbo_name || "",

        emailId: proposal.email || "",

        // location: proposal.address?.line2 || "",

        phone: proposal.phone || "",
        gstNo: proposal.gst_number || "",

        address: proposal.address?.line1 || "",


        //  You don't have state in schema → handle safely
        state: proposal.address?.line2 || "",

        pincode: proposal.pincode || "",



        scope: proposal.enquiryId?.service || "",

        count: proposal.outletCount || "",
        value: proposal.totalWithGST || "",
        representative: proposal.representative?.userName || "N/A",
      });
    });
    // Add data to Invoice Format sheet
    invoices.forEach((invoice) => {
      // Calculate totals for outlets (WORK 1-6)
      const workData = Array(6).fill({ qty: "", unitCost: "", total: "" });
      if (invoice.outlets && invoice.outlets.length) {
        invoice.outlets.slice(0, 6).forEach((outlet, idx) => {
          workData[idx] = {
            qty: outlet.quantity || "",
            unitCost: outlet.unit_cost || "",
            total:
              outlet.amount ||
              (outlet.quantity && outlet.unit_cost
                ? outlet.quantity * outlet.unit_cost
                : ""),
          };
        });
      }

      // Calculate overall total (sum of outlet amounts)
      const overallTotal = invoice.outlets
        ? invoice.outlets.reduce((sum, o) => sum + (o.amount || 0), 0)
        : 0;
      // Calculate GST (18% of overall total)
      const gst = overallTotal * 0.18;
      // Calculate bill value with GST
      const billValueWithGST = overallTotal + gst;

      // Prepare dynamic work columns for each outlet (WORK 1, WORK 2, ...)
      const maxWorks = Math.max(
        ...invoices.map((inv) => inv.outlets?.length || 0),
        6
      ); // fallback to 6
      const workColumns = {};
      for (let i = 0; i < maxWorks; i++) {
        const outlet = invoice.outlets && invoice.outlets[i];
        workColumns[`work${i + 1}service`] = outlet
          ? outlet.description || ""
          : "";
        workColumns[`work${i + 1}Qty`] = outlet ? outlet.quantity || "" : "";
        workColumns[`work${i + 1}UnitCost`] = outlet
          ? outlet.unit_cost || ""
          : "";
        workColumns[`work${i + 1}Total`] = outlet
          ? outlet.amount ||
          (outlet.quantity && outlet.unit_cost
            ? outlet.quantity * outlet.unit_cost
            : "")
          : "";
      }

      invoiceSheet.addRow({
        invoiceNumber: invoice.invoice_number || "",
        date: invoice.invoice_date
          ? moment(invoice.invoice_date).format("DD.MM.YYYY")
          : "",
        fieldExecutiveName: invoice.field_executive_name || "",
        teamLeaderName: invoice.team_leader_name || "",
        clientName: invoice.fbo_name || "",
        // location: invoice.address?.line2 || "",
        emailId: invoice.email || "",
        phone: invoice.phone || "", //  ensure this exists in invoice model
        gstNo: invoice.gst_number || "",

        address: invoice.address?.line1 || "",

        state: invoice.address?.line2 || "", //  same issue as proposal
        pincode: invoice.pincode || "",


        zone: invoice.zone || "",
        ...workColumns,
        overallTotal: overallTotal || "",
        gst: gst || "",
        billValueWithGST: billValueWithGST || "",
        amountReceivable: billValueWithGST || "",
        invoiceSentToClient: invoice.mail_status || "",
        paymentStatus: invoice.status || "",
      });
    });

    // Add data to Payment Summary sheet
    proposals.forEach((proposal) => {
      const proposalPayments = proposalPaymentsMap[proposal._id] || [];
      // Get all accepted payments and sum their amounts
      const acceptedPayments = proposalPayments.filter(
        (payment) => payment.status === "accepted"
      );
      const totalAmountReceived = acceptedPayments.reduce((sum, payment) => {
        return sum + (parseFloat(payment.amountReceived) || 0);
      }, 0);

      // Calculate balance as proposal value minus total amount received
      const balanceAmount = (proposal.totalWithGST || 0) - totalAmountReceived;

      // Add dynamic Payment N and Auditor Name N columns for each accepted payment
      const rowData = {
        proposalNumber: proposal.proposal_number || "",
        fboName: proposal.fbo_name || "",
        paymentCount: acceptedPayments.length,
        proposalValue: proposal.totalWithGST || 0,
        paymentReceived: totalAmountReceived,
        balanceAmount: balanceAmount,
      };

      // For each accepted payment, add Payment N and Auditor Name N fields
      acceptedPayments.forEach((payment, idx) => {
        rowData[`Payment ${idx + 1}`] = payment.amountReceived || "";
        rowData[`Auditor Name ${idx + 1}`] =
          payment.auditorId && payment.auditorId.userName
            ? payment.auditorId.userName
            : "";
      });
      // Fill empty cells for Payment/Auditor columns if less than maxPayments
      for (let i = acceptedPayments.length; i < maxPayments; i++) {
        rowData[`Payment ${i + 1}`] = "";
        rowData[`Auditor Name ${i + 1}`] = "";
      }

      paymentSummarySheet.addRow(rowData);
    });

    // Add data to Daily Work Sample sheet - each work log in separate row
    dailyWorkData.forEach((workLog) => {
      const row = dailyWorkSheet.addRow({
        date: workLog.date ? moment(workLog.date).format("DD.MM.YYYY") : "",
        executiveName: workLog.executiveName,
        proposalNumber: workLog.proposalNumber,
        workPlan: workLog.workPlan, // Changed from description
        workDetails: workLog.workDetails, // New column

        // HR columns
        hrMOU: workLog.hrMOU,
        hrNonMou: workLog.hrNonMou,
        hrRevenueMOU: workLog.hrRevenueMOU,
        hrRevenueNonMou: workLog.hrRevenueNonMou,

        // ERC columns
        ercMOU: workLog.ercMOU,
        ercNonMou: workLog.ercNonMou,
        ercRevenueMOU: workLog.ercRevenueMOU,
        ercRevenueNonMou: workLog.ercRevenueNonMou,

        // BHOG columns
        bhogMOU: workLog.bhogMOU,
        bhogNonMou: workLog.bhogNonMou,
        bhogRevenueMOU: workLog.bhogRevenueMOU,
        bhogRevenueNonMou: workLog.bhogRevenueNonMou,

        // CSFH columns
        csfhMOU: workLog.csfhMOU,
        csfhNonMou: workLog.csfhNonMou,
        csfhRevenueMOU: workLog.csfhRevenueMOU,
        csfhRevenueNonMou: workLog.csfhRevenueNonMou,

        // CVM columns
        cvmMOU: workLog.cvmMOU,
        cvmNonMou: workLog.cvmNonMou,
        cvmRevenueMOU: workLog.cvmRevenueMOU,
        cvmRevenueNonMou: workLog.cvmRevenueNonMou,

        // ERS columns
        ersMOU: workLog.ersMOU,
        ersNonMou: workLog.ersNonMou,
        ersRevenueMOU: workLog.ersRevenueMOU,
        ersRevenueNonMou: workLog.ersRevenueNonMou,

        // TPA columns
        tpaMOU: workLog.tpaMOU,
        tpaNonMou: workLog.tpaNonMou,
        tpaRevenueMOU: workLog.tpaRevenueMOU,
        tpaRevenueNonMou: workLog.tpaRevenueNonMou,

        // Total columns
        totalUnavarRevenueMOU: workLog.totalUnavarRevenueMOU,
        totalUnavarRevenueNonMou: workLog.totalUnavarRevenueNonMou,

        remarks: workLog.remarks,
      });

      // Enable text wrapping for the description and remarks columns
      row.getCell("workPlan").alignment = { wrapText: true };
      row.getCell("workDetails").alignment = { wrapText: true };
      row.getCell("remarks").alignment = { wrapText: true };
    });

    // // Add data to Daily Work Sample sheet
    // Object.values(workLogsByDate).forEach((dailyLog) => {
    //   dailyWorkSheet.addRow({
    //     date: dailyLog.date ? moment(dailyLog.date).format("DD.MM.YYYY") : "",
    //     executiveName: dailyLog.executiveName,
    //     description: dailyLog.descriptions.join("; "), // Concatenate descriptions
    //     // Placeholder for HR, ERC, BHOG, etc. MOU/Non Mou values
    //     // You will need to define how these values are derived from your WorkLog model
    //     hrMOU: "dsffsd",
    //     hrNonMou: "",
    //     hrRevenueMOU: "",
    //     hrRevenueNonMou: "",
    //     ercMOU: "",
    //     ercNonMou: "",
    //     ercRevenueMOU: "",
    //     ercRevenueNonMou: "",
    //     bhogMOU: "",
    //     bhogNonMou: "",
    //     bhogRevenueMOU: "sss",
    //     bhogRevenueNonMou: "",
    //     csfhMOU: "",
    //     csfhNonMou: "",
    //     csfhRevenueMOU: "",
    //     csfhRevenueNonMou: "",
    //     cvmMOU: "",
    //     cvmNonMou: "",
    //     cvmRevenueMOU: "",
    //     cvmRevenueNonMou: "",
    //     ersMOU: "",
    //     ersNonMou: "",
    //     ersRevenueMOU: "",
    //     ersRevenueNonMou: "",
    //     tpaMOU: "",
    //     tpaNonMou: "",
    //     tpaRevenueMOU: "",
    //     tpaRevenueNonMou: "",
    //     totalUnavarRevenueMOU: "",
    //     totalUnavarRevenueNonMou: "",
    //     remarks: dailyLog.remarks.join("; "), // Concatenate remarks
    //   });
    // });

    // Style the sheets
    // Style the sheets - ADD BOUNDS CHECKING
    const leaveSheet = workbook.addWorksheet("Leave Available Data");

    leaveSheet.columns = [
      { header: "User ID (Email)", key: "email", width: 35 },
      { header: "Representative Name", key: "userName", width: 30 },
      {
        header: "Available Sick Leave (Days)",
        key: "sickLeaveAvailable",
        width: 32,
      },
      {
        header: "Available Casual Leave (Days)",
        key: "casualLeaveAvailable",
        width: 34,
      },
      {
        header: "Available Compensation Leave (Days)",
        key: "compLeaveAvailable",
        width: 38,
      },

    ];

    representatives.forEach((user) => {
      const balance = leaveBalanceMap[user._id.toString()];

      leaveSheet.addRow({
        email: user.userId || user.email || "N/A",
        userName: user.userName || "N/A",
        sickLeaveAvailable: balance?.sickLeaveAvailable ?? 12,
        casualLeaveAvailable: balance?.casualLeaveAvailable ?? 12,
        compLeaveAvailable: balance?.compLeaveAvailable ?? 0,
      });
    });

    [
      proposalSheet,
      invoiceSheet,
      paymentSummarySheet,
      dailyWorkSheet,
      leaveSheet,
    ].forEach((sheet) => {
      // Style header row
      if (sheet.getRow(1)) {
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
      }

      // Add borders to all cells WITH BOUNDS CHECKING
      sheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          if (cell) {
            // Add null check
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };
          }
        });
      });
    });

    const filename = `SummaryReport_${moment(start).format(
      "DD-MM-YYYY"
    )}_to_${moment(end).format("DD-MM-YYYY")}.xlsx`;
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set headers for file download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader("Content-Length", buffer.length);

    // Send the buffer as response
    res.send(buffer);
  } catch (error) {
    console.error(" Failed to generate proposal Excel:", error);
    res.status(500).json({
      message: "Failed to generate proposal Excel",
      error: error.message,
    });
  }
};
