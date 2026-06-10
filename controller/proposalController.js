import Business from "../models/bussinessModel.js";
import Outlet from "../models/outletModel.js";
import Enquiry from "../models/enquiryModel.js";
import Proposal from "../models/proposalModel.js";
import ProposalCounter from "../models/proposalCounter.js";
import Invoice from "../models/invoiceModel.js";
import Agreement from "../models/agreementModel.js";
import moment from "moment";
import mongoose from "mongoose";
import AuditManagement from "../models/auditMangement.js";

export const getOutletDetailsById = async (req, res) => {
  try {
    const { enquiryId } = req.params;

    // Find the enquiry that matches the enquiry ID and select the business ID
    const enquiry = await Enquiry.findById(enquiryId).select("business");
    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }

    const { business } = enquiry;

    // Find outlets that match the business ID and select only branch name and outlet ID
    const outlets = await Outlet.find(
      { business },
      "branch_name _id  no_of_food_handlers type_of_industry unit no_of_production_line vertical_of_industry city "
    );

    // Respond with the outlet details for the specified business
    res.json(outlets);
  } catch (error) {
    console.error("Error getting outlets for business:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const saveProposal = async (req, res) => {
  const { enquiryId, proposal_date, status, proposal_number, outlets } =
    req.body;

  try {
    //Find the enquiry using the provided enquiryId
    const enquiry = await Enquiry.findById(enquiryId).populate("business");

    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }

    //Get the business ID from the enquiry
    const businessId = enquiry.business._id;

    //Create the proposal
    const proposal = new Proposal({
      business: businessId,
      proposal_date,
      status,
      proposal_number,
      outlets,
    });

    //Save the proposal to the database
    await proposal.save();

    return res
      .status(201)
      .json({ message: "Proposal saved successfully", proposal });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error saving proposal", error });
  }
};

export const getBusinessDetailsByEnquiryId = async (req, res) => {
  const { enquiryId } = req.params;

  try {
    // Find the enquiry by ID
    const enquiry = await Enquiry.findById(enquiryId);
    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }

    // Get the business ID from the enquiry
    const businessId = enquiry.business;

    // Find the business by ID
    const business = await Business.findOne(
      { _id: businessId },
      "name address  gst_number contact_person phone email customer_type vertical_of_industry type_of_industry po_number"
    );
    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    // Return the business details
    res.status(200).json(business);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Controller function to save data
export const createProposalAndOutlet = async (req, res) => {
  console.log("this is the body", req.body);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Extract data from req.body
    const {
      fbo_name,
      proposal_date,
      status,
      proposal_number,
      address,
      gst_number,
      contact_person,
      phone,
      outlets,
      enquiryId,
      pincode,
      email,
      note,
      representative,
      same_state,
      service,
      customer_type,
      po_number,
      type_of_industry,
      vertical_of_industry,
      auditor_convenience_fee,
    } = req.body;

    // Create a new Proposal instance with outlets
    const proposal = new Proposal({
      fbo_name,
      proposal_date,
      status,
      proposal_number,
      address,
      gst_number,
      contact_person,
      phone,
      outlets,
      pincode,
      message: "Proposal Created",
      email,
      note,
      representative,
      same_state,
      enquiryId,
      service,
      customer_type,
      po_number,
      type_of_industry,
      vertical_of_industry,
      auditor_convenience_fee,
    });

    // Save the Proposal to the database
    const savedProposal = await proposal.save({ session });

    // Update the ProposalCounter to increment the counter
    await ProposalCounter.findOneAndUpdate(
      { name: "proposalNumber" },
      { $inc: { value: 1 } },
      { new: true, upsert: true, session }
    );

    // Update the Enquiry model's status to "Proposal Done"
    await Enquiry.findByIdAndUpdate(
      enquiryId,
      { status: "Proposal Done" },
      { new: true, session }
    );

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Respond with saved data or success message
    res.status(201).json({
      proposal: savedProposal,
    });
  } catch (err) {
    // Rollback the transaction in case of error
    await session.abortTransaction();
    session.endSession();

    // Handle error
    console.error(err);
    res.status(500).json({ error: "Failed to save data" });
  }
};

//Controller funtion to update the data
export const updateProposalAndOutlet = async (req, res) => {
  console.log(req.body);
  const session = await mongoose.startSession();
  session.startTransaction();

  // Extract proposalId from route params
  const { proposalId } = req.params;

  try {
    // Extract data from req.body
    const {
      fbo_name,
      proposal_date,
      status,
      proposal_number,
      address,
      gst_number,
      contact_person,
      phone,
      outlets,
      enquiryId,
      pincode,
      email,
      note,
      representative,
      auditor_convenience_fee,
      po_number
    } = req.body;

    // Find and update the existing Proposal by ID
    const updatedProposal = await Proposal.findByIdAndUpdate(
      proposalId, // Use the proposalId to find the proposal
      {
        fbo_name,
        proposal_date,
        status,
        proposal_number,
        address,
        gst_number,
        contact_person,
        phone,
        outlets,
        pincode,
        message: "Proposal Updated", // Update the message to reflect the update
        email,
        note,
        representative,
        auditor_convenience_fee,
        po_number,
      },
      { new: true, session } // Return the updated document and use the session
    );

    if (!updatedProposal) {
      throw new Error("Proposal not found");
    }

    // Update the Enquiry model's status to "Proposal Done" if needed
    if (enquiryId) {
      await Enquiry.findByIdAndUpdate(
        enquiryId,
        { status: "Proposal Done" },
        { new: true, session }
      );
    }

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Respond with the updated proposal data
    res.status(200).json({
      proposal: updatedProposal,
    });
  } catch (err) {
    // Rollback the transaction in case of error
    await session.abortTransaction();
    session.endSession();

    // Handle error
    console.error(err);
    res.status(500).json({ error: "Failed to update data" });
  }
};

// Generate unique proposal number
export const generateProposalNumber = async (req, res) => {
  try {
    // Find the current counter without incrementing it
    const counter = await ProposalCounter.findOne({ name: "proposalNumber" });

    // Check if the counter exists
    if (!counter) {
      // If no counter found, initialize one with value 0
      const newCounter = new ProposalCounter({
        name: "proposalNumber",
        value: 0,
      });
      await newCounter.save();
      res.json({ proposal_number: "PROP-00000" }); // Generate default proposal number
      return;
    }

    // Generate the proposal number based on the current counter value
    const newProposalNumber = `PROP-${String(counter.value).padStart(5, "0")}`;

    res.json({ proposal_number: newProposalNumber });
  } catch (error) {
    console.error("Error generating proposal number", error);
    res.status(500).json({ error: "Error generating proposal number" });
  }
};

//Get all the proposal Details
export const getAllProposalDetails = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, sort, keyword } = req.query;

    // Convert page and pageSize to integers
    const pageNumber = parseInt(page, 10);
    const sizePerPage = parseInt(pageSize, 10);

    // Validate page number and page size
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

    // Create the base query
    let query = Proposal.find();

    // Apply search keyword if provided
    // if (keyword) {
    //   const searchRegex = new RegExp(keyword, "i"); // Case-insensitive regex
    //   query = query.where("fbo_name").regex(searchRegex);
    // }

    if (keyword) {
      const searchRegex = new RegExp(keyword, "i"); // Case-insensitive

      query = query.find({
        $or: [
          { fbo_name: { $regex: searchRegex } },
          { proposal_number: { $regex: searchRegex } }
        ]
      });
    }


    // Determine the sort query based on the 'sort' parameter
    let sortQuery = {};
    switch (sort) {
      case "newproposal":
        sortQuery = { createdAt: -1 }; // Descending order for newer proposals first
        break;
      case "alllist":
        sortQuery = { createdAt: 1 }; // Ascending order for older proposals first
        break;
      default:
        sortQuery = { createdAt: 1 }; // Default sorting (oldest first)
        break;
    }

    // Debugging: Log the sort query
    console.log("Sort Query:", sortQuery);

    // Count total number of proposals
    const totalProposals = await Proposal.countDocuments(query.getQuery());

    // Retrieve proposals with pagination and sorting
    const proposals = await query
      .skip((pageNumber - 1) * sizePerPage)
      .limit(sizePerPage)
      .sort(sortQuery)
      .select(
        "fbo_name outlets proposal_date status message createdAt updatedAt proposal_number"
      ); // Select required fields

    // Calculate total outlets and invoiced outlets for each proposal
    const proposalsWithCounts = proposals.map((proposal) => {
      const totalOutlets = proposal.outlets.length;
      const invoicedOutlets = proposal.outlets.filter(
        (outlet) => outlet.is_invoiced
      ).length;

      const formattedProposalDate = moment(proposal.proposal_date).fromNow();
      const formattedUpdatedAt = moment(proposal.updatedAt).fromNow();
      const dateCreated = `${proposal.message} ${formattedUpdatedAt}`;

      return {
        _id: proposal._id,
        fbo_name: proposal.fbo_name,
        totalOutlets,
        invoicedOutlets,
        proposal_date: formattedProposalDate,
        status: proposal.status,
        date_created: dateCreated,
        proposal_number: proposal.proposal_number, //proposal no
      };
    });

    res.json({
      total: totalProposals,
      currentPage: pageNumber,
      data: proposalsWithCounts,
    });
  } catch (error) {
    console.error("Error fetching proposals:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//Controller to get all the all the outlets
export const getOutletsByProposalId = async (req, res) => {
  const { proposalId } = req.params; // Get the proposal ID from the request parameters

  try {
    // Find the proposal by ID
    const proposal = await Proposal.findById(proposalId).exec();

    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }
    // console.log("this is the proposal", proposal.auditor_convenience_fee);
    // const auditorConvenienceFee = proposal.auditor_convenience_fee || 0;

    // console.log("this is the outlets with convenience fee", auditorConvenienceFee);
    // console.log("this is the outlets", proposal.outlets);
    //   Return the outlets from the found proposal
    return res.status(200).json(proposal);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteFields = async (req, res) => {
  try {
    const arrayOfProposalIds = req.body;

    // Validate arrayOfProposalIds if necessary
    if (!Array.isArray(arrayOfProposalIds)) {
      return res
        .status(400)
        .json({ error: "Invalid input: Expected an array of Proposal IDs" });
    }

    // Perform deletions
    // const deletionPromises = arrayOfProposalIds.map(async (proposalId) => {
    //   // Delete Proposal document
    //   await Proposal.deleteOne({ _id: proposalId });
    // });

    const deletionPromises = arrayOfProposalIds.map(async (proposalId) => {

      // 1 Delete related auditManagement records
      await AuditManagement.deleteMany({ proposalId: proposalId });

      // 2 Delete proposal document
      await Proposal.deleteOne({ _id: proposalId });

    });

    // Wait for all deletion operations to complete
    await Promise.all(deletionPromises);

    res.status(200).json({ message: "Proposals deleted successfully" });
  } catch (err) {
    console.error("Error deleting proposals:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateProposalStatus = async (req, res) => {
  console.log(req.body);
  const { proposalId } = req.params;
  const { status } = req.body;
  try {
    // Validate input
    if (!proposalId || !status) {
      return res
        .status(400)
        .json({ error: "Proposal ID and status are required" });
    }

    // Find and update the proposal
    const updatedProposal = await Proposal.findByIdAndUpdate(
      proposalId,
      { $set: { status, message: "Updated Status" } },
      { new: true, runValidators: true }
    );

    // Check if the proposal was found and updated
    if (!updatedProposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    // Send a successful response
    res
      .status(200)
      .json({ message: "Proposal updated successfully", updatedProposal });
  } catch (error) {
    // Handle errors
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

export const getProposalById = async (req, res, next) => {
  const { proposalId } = req.params; // Extract the ID from the request parameters

  try {
    // Find the proposal by ID
    const proposal = await Proposal.findById(proposalId);

    // Check if the proposal exists
    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    // Send the proposal data as a response
    res.status(200).json(proposal);
  } catch (error) {
    // Pass any errors to the error handling middleware
    next(error);
  }
};

const getDateRanges = (filter) => {
  switch (filter) {
    case "today":
      return {
        start: moment().startOf("day").toDate(),
        end: moment().endOf("day").toDate(),
      };
    case "week":
      return {
        start: moment().startOf("week").toDate(),
        end: moment().endOf("week").toDate(),
      };
    case "month":
      return {
        start: moment().startOf("month").toDate(),
        end: moment().endOf("month").toDate(),
      };
    case "overall":
      return null; // No date range for overall count
    default:
      throw new Error("Invalid filter");
  }
};

export const proposalCount = async (req, res) => {
  try {
    const { filter } = req.query; // Get the filter from query params

    const dateRange = getDateRanges(filter);

    let count;
    if (dateRange) {
      // Filter based on the date range
      count = await Proposal.countDocuments({
        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
      });
    } else {
      // Count all proposals
      count = await Proposal.countDocuments();
    }

    return res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Error counting proposals:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to count proposals",
      error: error.message,
    });
  }
};

export const getFilteredInvoices = async (req, res) => {
  try {
    const { invoiceId } = req.params; // Extract the invoiceId from query parameters

    // Validate input parameters
    if (!invoiceId) {
      return res.status(400).json({ message: "Invoice ID is required" });
    }

    // Fetch the proposalId from the provided invoiceId
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const proposalId = invoice.proposal_id;

    // Query to fetch all invoices with the same proposalId, excluding the provided invoiceId
    const invoices = await Invoice.find({
      proposal_id: proposalId,
      _id: { $ne: invoiceId }, // Exclude the provided invoiceId
    });

    // Collect all outlet IDs from the invoices
    const outletIds = invoices.reduce((acc, inv) => {
      if (Array.isArray(inv.outlets)) {
        inv.outlets.forEach((outlet) => {
          if (outlet._id) {
            acc.push(outlet._id); // Push only the _id of each outlet
          }
        });
      }
      return acc;
    }, []);

    // Send the response with filtered invoices and outlet IDs
    return res.status(200).json({
      success: true,
      outletIds: [...new Set(outletIds)], // Remove duplicates from outlet IDs
    });
  } catch (error) {
    console.error("Error fetching filtered invoices:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getFilteredAgreements = async (req, res) => {
  try {
    const { agreementId } = req.params; // Extract the agreementId from query parameters

    // Validate input parameters
    if (!agreementId) {
      return res.status(400).json({ message: "Agreement ID is required" });
    }

    // Fetch the proposalId from the provided agreementId
    const agreement = await Agreement.findById(agreementId);
    if (!agreement) {
      return res.status(404).json({ message: "Agreement not found" });
    }

    const proposalId = agreement.proposalId;
    console.log("this is the proposal id", proposalId);

    // Query to fetch all agreements with the same proposalId, excluding the provided agreementId
    const agreements = await Agreement.find({
      proposalId: proposalId,
      _id: { $ne: agreementId }, // Exclude the provided agreementId
    });

    // Collect all outlet _id values from the agreements
    const outletIds = agreements.reduce((acc, agreement) => {
      if (Array.isArray(agreement.outlets)) {
        // Assuming each outlet has an _id field
        acc.push(...agreement.outlets.map((outlet) => outlet._id));
      }
      return acc;
    }, []);

    // Send the response with filtered agreements and outlet _id values
    return res.status(200).json({
      success: true,
      outletIds: [...new Set(outletIds)], // Remove duplicates from outlet _id values
    });
  } catch (error) {
    console.error("Error fetching filtered agreements:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// Get proposal numbers excluding specific services
export const getProposalNumbersWithoutSpecificServices = async (req, res) => {
  try {
    // Exclude these services
    const excludedServices = ["TPA", "Hygiene Rating"];

    // Find proposals where service is NOT in excludedServices
    const proposals = await Proposal.find({
      service: { $nin: excludedServices },
    })
      .select("proposal_number fbo_name service status createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: proposals.length,
      data: proposals,
    });
  } catch (error) {
    console.error("Error fetching filtered proposals:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
