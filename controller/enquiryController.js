import moment from "moment";
import Business from "../models/bussinessModel.js";
import Enquiry from "../models/enquiryModel.js";
import Proposal from "../models/proposalModel.js";
import { format } from "morgan";

export const saveEnquiryForm = async (req, res) => {
 // console.log(req.body);
  try {
    const { business, service, status } = req.body;

    // Validate required fields
    if (!business || !service) {
      return res.status(400).json({
        message: "Business ID and Service are required.",
      });
    }

    // Create a new enquiry
    const newEnquiry = new Enquiry({
      business: business,
      service: service,
      status: status || "New Enquiry", // Default status if not provided
    });

    // Save the enquiry to the database
    const savedEnquiry = await newEnquiry.save();

    res.status(201).json({
      message: "Enquiry saved successfully",
      data: savedEnquiry,
    });
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while saving the data",
      error,
    });
  }
};



export const getAllEnquiryDetails = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, sort, keyword } = req.query;
    const skip = (page - 1) * pageSize;

    // Create a query object for filtering businesses
    let businessQuery = {};
    if (keyword) {
      const keywordRegex = new RegExp(keyword, "i"); // 'i' for case-insensitive
      businessQuery = {
        $or: [
          { name: keywordRegex },
          { contact_person: keywordRegex },
          { phone: keywordRegex },
        ],
      };
    }

    // Find matching businesses
    const matchingBusinesses = await Business.find(businessQuery).select("_id");
    const businessIds = matchingBusinesses.map((business) => business._id);

    // Initialize the enquiry query
    let enquiryQuery = {};
    if (businessIds.length > 0) {
      enquiryQuery.business = { $in: businessIds };
    }
    

    // Add sorting based on the sort parameter
    let sortQuery = {};
    if (sort === "newenquiry") {
      sortQuery = { created_at: -1 };
    }

    // Execute the enquiry query with pagination and sorting
    const enquiries = await Enquiry.find(enquiryQuery)
      .populate({
        path: "business",
        select: "name contact_person phone",
      })
      .sort(sortQuery)
      .skip(skip)
      .limit(parseInt(pageSize));

    // Fetch the total count of enquiries
    const totalEnquiries = await Enquiry.countDocuments(enquiryQuery);

    // Create an array of enquiry IDs to check for proposals
    const enquiryIds = enquiries.map(enquiry => enquiry._id);

    // Check for proposals linked to these enquiries
    const proposals = await Proposal.find({ enquiryId: { $in: enquiryIds } })
      .select("_id enquiryId");

    // Create a map for quick lookup of proposal IDs by enquiry ID
    const proposalMap = proposals.reduce((acc, proposal) => {
      acc[proposal.enquiryId] = proposal._id; // Map enquiryId to proposalId
      return acc;
    }, {});

    // Format the data as needed, including proposal ID if exists
    const formattedData = enquiries.map((enquiry) => ({
      _id: enquiry._id,
      name: enquiry.business.name,
      contact_person: enquiry.business.contact_person,
      phone: enquiry.business.phone,
      service: enquiry.service,
      added_by: enquiry.added_by,
      status: enquiry.status,
      enquiry_date: moment(enquiry.created_at).fromNow(), // Human-readable format
      proposalId: proposalMap[enquiry._id] || null, // Assign proposalId or null if not found
    }));

    console.log(formattedData);

    // Respond with the formatted data and pagination info
    res.status(200).json({
      total: totalEnquiries,
      currentPage: parseInt(page),
      data: formattedData,
    });
  } catch (error) {
    console.error("Error fetching enquiry details:", error); // Log error for debugging
    res.status(500).json({
      message: "An error occurred while fetching the data",
      error: error.message || "Internal Server Error",
    });
  }
};





export const deleteFields = async (req, res) => {
  try {
    const arrayOfEnquiryId = req.body; // Assuming an array of business IDs is sent in the request body

    // Deleting the documents with the given _id values
    await Enquiry.deleteMany({
      _id: {
        $in: arrayOfEnquiryId
      }
    });

    res.status(200).json({ message: "Fields deleted successfully" });
  } catch (err) {
    console.error("Error deleting fields:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const updateEnquiry = async (req, res) => {
  const { enquiryId } = req.params; // Extract enquiryId from params
  const { businessId, service, status } = req.body;

  try {
    // Validate required fields
    if (!businessId || !service) {
      return res.status(400).json({
        message: "Business ID and Service are required.",
      });
    }

    // Find the enquiry by ID
    const enquiry = await Enquiry.findById(enquiryId);
    if (!enquiry) {
      return res.status(404).json({
        message: "Enquiry not found.",
      });
    }

    // Update enquiry fields
    enquiry.business = businessId;
    enquiry.service = service;
    enquiry.status = status || enquiry.status; // Keep current status if not provided

    // Save the updated enquiry to the database
    const updatedEnquiry = await enquiry.save();

    res.status(200).json({
      message: "Enquiry updated successfully",
      data: updatedEnquiry,
    });
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while updating the data",
      error,
    });
  }
};


export const getEnquiryById = async (req, res) => {
  try {
    const enquiryId = req.params.id;
    const enquiry = await Enquiry.findById(enquiryId).select(
      "business service"
    );

    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }

    res.status(200).json(enquiry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



export const updateEnquiryProposalStatus = async (req, res) => {
  console.log(req.body);
  try {
    const { equiryId, isProposalDone } = req.body; // Extract the enquiryId and isProposalDone from the request body

    if (!equiryId || typeof isProposalDone !== 'boolean') {
      return res.status(400).json({ message: 'Invalid data provided' });
    }

    // Update the enquiry by setting isProposalDone based on the provided value
    const updatedEnquiry = await Enquiry.findByIdAndUpdate(
      equiryId,
      { isProposalDone },
      { new: true }
    );

    if (!updatedEnquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    res.status(200).json({
      message: 'Enquiry proposal status updated successfully',
      enquiry: updatedEnquiry
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



export const updateEnquiryById = async (req, res) => {
  try {
    const enquiryId = req.params.id;
    const updateData = req.body;

    const updatedEnquiry = await Enquiry.findByIdAndUpdate(
      enquiryId,
      updateData,
      { new: true }
    ).select("business service");

    if (!updatedEnquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }

    res.status(200).json(updatedEnquiry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};