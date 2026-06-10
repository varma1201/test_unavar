import moment from "moment";
import mongoose from "mongoose";
import Agreement from "../models/agreementModel.js";
import Proposal from "../models/proposalModel.js";

export const deleteFields = async (req, res) => {
  console.log(req.body);
  try {
    const { id: agreementIds, proposalId, outletId } = req.body; // Destructure the request body

    // Validate agreementIds if necessary
    if (!Array.isArray(agreementIds)) {
      return res
        .status(400)
        .json({ error: "Invalid input: Expected an array of Agreement IDs" });
    }

    // Flatten the nested outletId array for each proposalId
    const flattenedOutletIdsArray = outletId.map((outlets) =>
      outlets.flat(3).map((outlet) => outlet._id.toString())
    );
    console.log(flattenedOutletIdsArray);

    // Perform deletions for Agreement IDs
    const agreementDeletionPromises = agreementIds.map(async (agreementId) => {
      // Delete Agreement document
      await Agreement.deleteOne({ _id: agreementId }); // Ensure you have a model for agreements
    });

    // Wait for all agreement deletions to complete
    await Promise.all(agreementDeletionPromises);

    // Update is_agreement flag for each outlet associated with each proposalId
    const updateOutletPromises = proposalId.map(async (proposalId, index) => {
      // Get the corresponding flattened outletIds for the current proposal
      const flattenedOutletIds = flattenedOutletIdsArray[index];

      // Find the proposal by ID and populate the outlets
      const proposal = await Proposal.findById(proposalId).populate("outlets");

      if (!proposal) {
        return; // Skip this iteration if no proposal is found
      }

      // Update the is_agreement flag for each outlet in the proposal
      let isUpdated = false;
      proposal.outlets.forEach((outlet) => {
        if (flattenedOutletIds.includes(outlet._id.toString())) {
          outlet.is_agreement = false; // Update the is_agreement flag
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

export const getAllAgreementDetails = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, sort = "createdAt", keyword } = req.query;

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
    let query = Agreement.find();

    // Apply search keyword if provided
    if (keyword) {
      const searchRegex = new RegExp(keyword, "i"); // Case-insensitive regex
      query = query.where("fbo_name").regex(searchRegex);
    }

    // Dynamically handle sorting
    let sortQuery = {};
    if (sort === "newagreement") {
      sortQuery = { createdAt: 1 }; // Ascending order for newer agreements first
    } else if (sort === "alllist") {
      sortQuery = { createdAt: -1 }; // Descending order for latest agreements first
    } else {
      // Default sorting (ascending by createdAt)
      sortQuery = { createdAt: 1 };
    }

    // Apply sorting
    query = query.sort(sortQuery);

    // Retrieve agreements with pagination
    const agreements = await query
      .skip((pageNumber - 1) * sizePerPage)
      .limit(sizePerPage)
      .select(
        "fbo_name no_of_outlets agreement_date status proposalId outlets"
      );

    // Calculate total outlets and formatted dates for each agreement
    const agreementsWithCounts = agreements.map((agreement) => {
      const totalOutlets = agreement.no_of_outlets;
      const formattedDate = moment(agreement.agreement_date).format(
        "MM/DD/YYYY"
      );

      return {
        _id: agreement._id,
        fbo_name: agreement.fbo_name,
        no_of_outlets: agreement.no_of_outlets,
        agreement_date: formattedDate,
        status: agreement.status,
        proposalId: agreement.proposalId,
        outlets: agreement.outlets,
      };
    });

    // Get the total number of agreements for pagination
    const totalAgreements = await Agreement.countDocuments();

    res.json({
      total: totalAgreements, // Total number of agreements
      currentPage: pageNumber,
      data: agreementsWithCounts,
    });
  } catch (error) {
    console.error("Error fetching agreements:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


export const createAgreement = async (req, res) => {
  console.log(req.body);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      fbo_name,
      from_date,
      to_date,
      total_cost,
      no_of_outlets,
      address,
      period,
      proposalId,
      outlets,
    } = req.body;

    if (
      !fbo_name ||
      !to_date ||
      !no_of_outlets ||
      !address ||
      !period ||
      !proposalId ||
      !outlets
    ) {
      throw new Error("Missing required fields");
    }

    const formattedFromDate = from_date
      ? from_date
      : moment().format("DD/MM/YYYY");

    const formattedToDate = to_date ? to_date : moment().format("DD/MM/YYYY");

    // Create a new agreement instance with the provided data
    const newAgreement = new Agreement({
      fbo_name,
      address,
      from_date: formattedFromDate,
      to_date: formattedToDate,
      total_cost,
      no_of_outlets,
      period,
      proposalId,
      outlets,
    });

    // Save the new agreement to the database
    const savedAgreement = await newAgreement.save({ session });

    const outletIds = outlets.map((outlet) => outlet._id);

    // Update outlets to mark them as invoiced
    const updateResult = await Proposal.updateMany(
      { "outlets._id": { $in: outletIds } },
      { $set: { "outlets.$[elem].is_agreement": true } },
      { arrayFilters: [{ "elem._id": { $in: outletIds } }], session }
    );

    if (updateResult.nModified === 0) {
      throw new Error("Failed to update outlets as invoiced");
    }

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Send a response with the saved agreement data
    res.status(201).json({
      success: true,
      message: "Agreement created successfully!",
      data: savedAgreement,
    });
  } catch (error) {
    console.error("Error creating agreement:", error);

    // Abort the transaction in case of error
    await session.abortTransaction();
    session.endSession();

    res.status(500).json({
      success: false,
      message: "Failed to create agreement",
      error: error.message,
    });
  }
};

export const getAgreementById = async (req, res, next) => {
  const { agreementId } = req.params; // Extract the ID from the request parameters

  try {
    // Find the agreement by ID
    const agreement = await Agreement.findById(agreementId);

    // Check if the agreement exists
    if (!agreement) {
      return res.status(404).json({ message: "agreement not found" });
    }

    // Send the agreement data as a response
    res.status(200).json(agreement);
  } catch (error) {
    // Pass any errors to the error handling middleware
    next(error);
  }
};

export const updateAgreement = async (req, res) => {
  console.log(req.body);
  try {
    const { agreementId } = req.params;
    const {
      fbo_name,
      from_date,
      to_date,
      total_cost,
      no_of_outlets,
      address,
      period,
      outlets,
    } = req.body;

    // Find the agreement by ID and update it with the provided data
    const updatedAgreement = await Agreement.findByIdAndUpdate(
      agreementId,
      {
        fbo_name,
        address,
        from_date,
        to_date,
        total_cost,
        no_of_outlets,
        period,
        outlets,
      },
      { new: true } // Return the updated document
    );

    if (!updatedAgreement) {
      return res.status(404).json({
        success: false,
        message: "Agreement not found",
      });
    }

    // Send a response with the updated agreement data
    res.status(200).json({
      success: true,
      message: "Agreement updated successfully!",
      data: updatedAgreement,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to update agreement",
      error: error.message,
    });
  }
};

export const updateAgreementStatus = async (req, res) => {
  console.log("Request Body:", req.body);

  const { agreementId } = req.params; // Extract agreementId from params
  const { status } = req.body; // Extract status from the request body

  try {
    // Validate input
    if (!agreementId || !status) {
      return res
        .status(400)
        .json({ error: "Agreement ID and status are required" });
    }

    // Find and update the agreement
    const updateAgreement = await Agreement.findByIdAndUpdate(
      agreementId,
      { $set: { status, message: "Updated Status" } }, // Update status and message
      { new: true, runValidators: true } // Return updated document and run validators
    );

    // Check if the agreement was found and updated
    if (!updateAgreement) {
      return res.status(404).json({ error: "Agreement not found" });
    }

    // Send a successful response
    res
      .status(200)
      .json({ message: "Agreement updated successfully", updateAgreement });
  } catch (error) {
    // Handle any server errors
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

export const getAgreementsByProposalId = async (req, res) => {
  const { proposalId } = req.params;

  try {
    // Validate input
    if (!proposalId) {
      return res.status(400).json({ error: "Proposal ID is required" });
    }

    // Find all agreements associated with the given proposalId
    const agreements = await Agreement.find({ proposalId });

    // Check if any agreements were found
    if (agreements.length === 0) {
      return res
        .status(404)
        .json({ message: "No agreements found for this proposal ID" });
    }

    // Send a successful response with the found agreements
    res.status(200).json({
      message: "Agreements retrieved successfully",
      agreements,
    });
  } catch (error) {
    // Handle errors
    res.status(500).json({ error: "Server error", details: error.message });
  }
};
