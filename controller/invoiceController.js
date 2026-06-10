import Proposal from "../models/proposalModel.js";
import moment from "moment";
import mongoose from "mongoose";
import InvoiceCounter from "../models/invoiceCounter.js";
import Invoice from "../models/invoiceModel.js";

export const generateInvoiceNumber = async (req, res) => {
  try {
    // Find the current counter without incrementing it
    const counter = await InvoiceCounter.findOne({ name: "invoiceNumber" });

    // Check if the counter exists
    if (!counter) {
      // If no counter found, initialize one with value 0
      const newCounter = new InvoiceCounter({
        name: "invoiceNumber",
        value: 0,
      });
      await newCounter.save();
      res.json({ invoice_number: "INV-00000" }); // Generate default invoice number
      return;
    }

    // Generate the invoice number based on the current counter value
    const newInvoiceNumber = `INV-${String(counter.value).padStart(5, "0")}`;

    res.json({ invoice_number: newInvoiceNumber });
  } catch (error) {
    console.error("Error generating invoice number", error);
    res.status(500).json({ error: "Error generating invoice number" });
  }
};

export const getProposalById = async (req, res) => {
  const { proposalId } = req.params;

  try {
    const proposal = await Proposal.findById(proposalId).select(
      "fbo_name pincode address gst_number proposal_date proposal_number phone email po_number"
    );

    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    res.status(200).json(proposal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const createInvoice = async (req, res) => {
  console.log(req.body);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Destructure the request body to get invoice data
    const {
      fbo_name,
      invoice_date,
      status,
      mail_status,
      proposal_number,
      invoice_number,
      place_of_supply,
      field_executive_name,
      team_leader_name,
      address = {},
      pincode,
      contact_person,
      phone,
      outlets,
      email,
      same_state,
      proposalId,
      gst_number,
      remark,
      po_number,
    } = req.body;

    // Create a new invoice instance with the provided data
    const newInvoice = new Invoice({
      fbo_name,
      invoice_date,
      status,
      mail_status,
      proposal_number,
      invoice_number,
      place_of_supply,
      field_executive_name,
      team_leader_name,
      address,
      pincode,
      contact_person,
      phone,
      outlets,
      email,
      same_state,
      proposalId,
      gst_number,
      remark,
      po_number,
    });

    // Save the new invoice to the database
    const savedInvoice = await newInvoice.save({ session });

    const outletIds = outlets.map((outlet) => outlet._id);

    // Update the Proposal model outlets object
    await Proposal.updateMany(
      { "outlets._id": { $in: outletIds } },
      { $set: { "outlets.$[elem].is_invoiced": true } },
      { arrayFilters: [{ "elem._id": { $in: outletIds } }], session }
    );

    // Update the InvoiceCounter collection
    await InvoiceCounter.findOneAndUpdate(
      { name: "invoiceNumber" },
      { $inc: { value: 1 } },
      { new: true, upsert: true, session }
    );

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Send a response with the saved invoice data
    res.status(201).json({
      success: true,
      message: "Invoice created successfully!",
      data: savedInvoice,
    });
  } catch (error) {
    console.error("Error creating invoice:", error);
    // Rollback the transaction in case of error
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      success: false,
      message: "Failed to create invoice",
      error: error.message,
    });
  }
};

//Get all the proposal Details
export const getAllInvoiceDetail = async (req, res) => {
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
    let query = Invoice.find();

    // Apply search keyword if provided
    if (keyword) {
      const searchRegex = new RegExp(keyword, "i"); // Case-insensitive regex
      query = query.where({
        $or: [
          { fbo_name: { $regex: searchRegex } },
          { proposal_number: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },

          { status: { $regex: searchRegex } },
        ],
      });
    }

    let sortQuery = {};
    switch (sort) {
      case "newinvoice":
        sortQuery = { createdAt: -1 }; // Descending order for newer invoices first
        break;
      case "allist":
        sortQuery = { createdAt: 1 }; // Ascending order for older invoices first
        break;
      default:
        sortQuery = { createdAt: 1 }; // Default sorting (oldest first)
        break;
    }

    // Apply sorting
    query = query.sort(sortQuery);
    // Count total number of invoices
    const totalInvoices = await Invoice.countDocuments(query.getQuery());

    // Retrieve invoices with pagination
    const invoices = await query
      .skip((pageNumber - 1) * sizePerPage)
      .limit(sizePerPage)
      .select(
        "fbo_name proposal_number phone email outlets invoice_date status proposalId mail_status po_number"
      ); // Select only the required fields, including email

    // Calculate total outlets and invoiced outlets for each invoice
    const invoicesWithCounts = invoices.map((invoice) => {
      // Count total and invoiced outlets
      const totalOutlets = invoice.outlets.length;
      const invoicedOutlets = invoice.outlets.filter(
        (outlet) => outlet.is_invoiced
      ).length;

      return {
        _id: invoice._id,
        fbo_name: invoice.fbo_name,
        proposal_number: invoice.proposal_number,
        phone: invoice.phone,
        email: invoice.email,
        invoice_date: moment(invoice.invoice_date).format("MM/DD/YYYY"),
        status: invoice.status,
        outlets: invoice.outlets,
        totalOutlets: totalOutlets,
        invoicedOutlets: invoicedOutlets,
        proposalId: invoice.proposalId,
        mail_status: invoice.mail_status,
      };
    });

    res.json({
      total: totalInvoices, // Total number of invoices
      currentPage: pageNumber,
      data: invoicesWithCounts,
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteFields = async (req, res) => {
  console.log(req.body);
  try {
    const { id: invoiceIds, proposalId, outletId } = req.body; // Destructure the request body

    // Validate invoiceIds if necessary
    if (!Array.isArray(invoiceIds)) {
      return res
        .status(400)
        .json({ error: "Invalid input: Expected an array of Invoice IDs" });
    }

    // Flatten the nested outletId array for each proposalId
    const flattenedOutletIdsArray = outletId.map((outlets) =>
      outlets.flat(3).map((outlet) => outlet._id.toString())
    );
    console.log(flattenedOutletIdsArray);

    // Perform deletions for Invoice IDs
    const invoiceDeletionPromises = invoiceIds.map(async (invoiceId) => {
      // Delete Invoice document
      await Invoice.deleteOne({ _id: invoiceId });
    });

    // Wait for all invoice deletions to complete
    await Promise.all(invoiceDeletionPromises);

    // Update is_invoiced flag for each outlet associated with each proposalId
    const updateOutletPromises = proposalId.map(async (proposalId, index) => {
      // Get the corresponding flattened outletIds for the current proposal
      const flattenedOutletIds = flattenedOutletIdsArray[index];

      // Find the proposal by ID and populate the outlets
      const proposal = await Proposal.findById(proposalId).populate("outlets");

      if (!proposal) {
        return; // Skip this iteration if no proposal is found
      }

      // Update the is_invoiced flag for each outlet in the proposal
      let isUpdated = false;
      proposal.outlets.forEach((outlet) => {
        if (flattenedOutletIds.includes(outlet._id.toString())) {
          outlet.is_invoiced = false;
          isUpdated = true;
        }
      });

      // If outlets were updated, save the proposal document
      if (isUpdated) {
        await proposal.save();
      }
    });

    // Execute the update promises for all proposals
    await Promise.all(updateOutletPromises);

    console.log("\nAll proposals processed successfully.");

    res
      .status(200)
      .json({ message: "Records deleted and outlets updated successfully" });
  } catch (err) {
    console.error("Error deleting records:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getInvoiceById = async (req, res, next) => {
  const { invoiceId } = req.params; // Extract the ID from the request parameters

  try {
    // Find the invoice by ID
    const invoice = await Invoice.findById(invoiceId);

    // Check if the invoice exists
    if (!invoice) {
      return res.status(404).json({ message: "invoice not found" });
    }

    // Send the invoice data as a response
    res.status(200).json(invoice);
  } catch (error) {
    // Pass any errors to the error handling middleware
    next(error);
  }
};

export const updateInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  // Extract invoiceId from route params
  const { invoiceId } = req.params;

  try {
    // Extract data from req.body
    const {
      fbo_name,
      invoice_date,
      status,
      proposal_number,
      invoice_number,
      place_of_supply,
      field_executive_name,
      team_leader_name,
      address,
      pincode,
      contact_person,
      phone,
      outlets,
      email,
      same_state,
      note,
      gst_number,
      remark,
      po_number,
    } = req.body;

    // Find and update the existing Invoice by ID
    const updatedInvoice = await Invoice.findByIdAndUpdate(
      invoiceId, // Use the invoiceId to find the invoice
      {
        fbo_name,
        invoice_date,
        status,
        proposal_number,
        invoice_number,
        place_of_supply,
        field_executive_name,
        team_leader_name,
        address,
        pincode,
        contact_person,
        phone,
        outlets,
        email,
        same_state,
        message: "Invoice Updated", // Update the message to reflect the update
        note,
        gst_number,
        remark,
        po_number,
      },
      { new: true, session } // Return the updated document and use the session
    );

    if (!updatedInvoice) {
      throw new Error("Invoice not found");
    }

    const outletIds = outlets.map((outlet) => outlet._id);

    // Update the Proposal model outlets object if needed
    await Proposal.updateMany(
      { "outlets._id": { $in: outletIds } },
      { $set: { "outlets.$[elem].is_invoiced": true } },
      { arrayFilters: [{ "elem._id": { $in: outletIds } }], session }
    );

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Respond with the updated invoice data
    res.status(200).json({
      success: true,
      message: "Invoice updated successfully!",
      data: updatedInvoice,
    });
  } catch (err) {
    // Rollback the transaction in case of error
    await session.abortTransaction();
    session.endSession();

    // Handle error
    console.error("Error updating invoice:", err);
    res.status(500).json({ error: "Failed to update invoice" });
  }
};
export const updateInvoiceStatus = async (req, res) => {
  const { invoiceId } = req.params;
  const { status, mail_status } = req.body;

  try {
    // Validate input
    if (!invoiceId || (!status && !mail_status)) {
      return res
        .status(400)
        .json({
          error:
            "Invoice ID is required and at least one of status or mail_status must be provided",
        });
    }

    // Prepare update object
    const updateFields = {};
    if (status) {
      updateFields.status = status;
    }
    if (mail_status) {
      updateFields.mail_status = mail_status;
    }

    // Find and update the invoice
    const updatedInvoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      { $set: { ...updateFields, message: "Updated Status" } },
      { new: true, runValidators: true } // Return the updated document and run validation
    );

    // Check if the invoice was found and updated
    if (!updatedInvoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Send a successful response
    res.status(200).json({
      message: "Invoice updated successfully",
      updatedInvoice, // Use the correct variable here
    });
  } catch (error) {
    // Handle errors
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

export const getInvoicesByProposalId = async (req, res) => {
  const { proposalId } = req.params;

  try {
    // Validate input
    if (!proposalId) {
      return res.status(400).json({ error: "Proposal ID is required" });
    }

    // Find all invoices associated with the given proposalId
    const invoices = await Invoice.find({ proposalId });

    // Check if any invoices were found
    if (invoices.length === 0) {
      return res
        .status(404)
        .json({ message: "No invoices found for this proposal ID" });
    }

    // Send a successful response with the found invoices
    res.status(200).json({
      message: "Invoices retrieved successfully",
      invoices,
    });
  } catch (error) {
    // Handle errors
    res.status(500).json({ error: "Server error", details: error.message });
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

export const invoiceCount = async (req, res) => {
  try {
    const { filter } = req.query; // Get the filter from query params

    const dateRange = getDateRanges(filter);

    let count;
    if (dateRange) {
      // Filter based on the date range
      count = await Invoice.countDocuments({
        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
      });
    } else {
      // Count all invoices
      count = await Invoice.countDocuments();
    }

    return res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Error counting invoices:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to count invoices",
      error: error.message,
    });
  }
};
