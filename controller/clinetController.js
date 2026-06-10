import moment from "moment";
import Business from "../models/bussinessModel.js";
import Outlet from "../models/outletModel.js";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import Questionaries from "../models/questionariesModle.js";
import {
  SESClient,
  SendEmailCommand,
  SendRawEmailCommand,
} from "@aws-sdk/client-ses";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import dotenv from "dotenv";
dotenv.config();

const sesClient = new SESClient({
  region: process.env.AWS_REGION, // Change to your SES region
  credentials: {
    accessKeyId: process.env.AWS_SMTP_LOGIN,
    secretAccessKey: process.env.AWS_SMTP_SECRET_KEY,
  },
});

// Controller function to handle saving client data
export const saveBusiness = async (req, res) => {
  console.log(req.body);
  try {
    const {
      name,
      contact_person,
      type_of_industry,
      vertical_of_industry,
      fssai_license_number,
      phone,
      email,
      gst_number,
      address,
      added_by,
      status,
      gst_enable,
      customer_type,
      place_of_supply,
      po_number,
    } = req.body;

    // Validate required fields
    if (!name || !contact_person || !email || !phone) {
      return res.status(400).json({
        message: "Name, Contact Person, Email, and Phone are required",
      });
    }

    // Create a new business instance
    const newBusiness = new Business({
      name,
      contact_person,
      type_of_industry,
      vertical_of_industry,
      fssai_license_number,
      phone,
      email,
      gst_number,
      address,
      added_by,
      status,
      gst_enable,
      place_of_supply,
      customer_type,
      po_number,
      created_at: new Date(),
    });

    // Save the new form to the database
    await newBusiness.save();

    return res.status(201).send({ success: true, data: newBusiness });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

//Controller function to handle update of client data
export const updateBusiness = async (req, res) => {
  console.log(req.body);
  try {
    const {
      _id,
      name,
      contact_person,
      type_of_industry,
      vertical_of_industry,
      fssai_license_number,
      phone,
      email,
      gst_number,
      "address.line1": line1,
      "address.line2": line2,
      "address.city": city,
      "address.state": state,
      "address.pincode": pincode,
      place_of_supply,
      updated_by,
      customer_type,
      po_number,
    } = req.body;

    // Validate required fields
    if (!_id) {
      return res.status(400).json({
        message: "id is required",
      });
    }

    // Check if the business exists
    const existingBusiness = await Business.findById(_id);
    if (!existingBusiness) {
      return res.status(404).json({ message: "Business not found" });
    }

    // Log incoming values for debugging
    console.log("Updating business with values:", {
      name,
      contact_person,
      type_of_industry,
      vertical_of_industry,
      fssai_license_number,
      phone,
      email,
      gst_number,
      address: { line1, line2, city, state, pincode },
      updated_by,
      place_of_supply,
      customer_type,
    });

    // Update business fields
    existingBusiness.name = name || existingBusiness.name;
    existingBusiness.contact_person =
      contact_person || existingBusiness.contact_person;
    existingBusiness.type_of_industry = Array.isArray(type_of_industry)
      ? type_of_industry
      : existingBusiness.type_of_industry;
    existingBusiness.vertical_of_industry = Array.isArray(vertical_of_industry)
      ? vertical_of_industry
      : existingBusiness.vertical_of_industry;
    existingBusiness.fssai_license_number =
      fssai_license_number || existingBusiness.fssai_license_number;
    existingBusiness.phone = phone || existingBusiness.phone;
    existingBusiness.email = email || existingBusiness.email;
    existingBusiness.gst_number = gst_number || existingBusiness.gst_number;
    existingBusiness.place_of_supply =
      place_of_supply || existingBusiness.place_of_supply;
    existingBusiness.address = {
      line1: line1 || existingBusiness.address.line1,
      line2: line2 || existingBusiness.address.line2,
      city: city || existingBusiness.address.city,
      state: state || existingBusiness.address.state,
      pincode: pincode || existingBusiness.address.pincode,
    };
    existingBusiness.customer_type =
      customer_type || existingBusiness.customer_type;
    existingBusiness.po_number =
      po_number || existingBusiness.po_number;
    existingBusiness.updated_at = new Date(); // Record update timestamp

    // Log the updated business for debugging
    console.log("Updated business:", existingBusiness);

    // Save the updated business to the database
    await existingBusiness.save();

    return res.status(200).send({ success: true, data: existingBusiness });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Controller to fetch business details by form ID or ID
export const getBusinessDetailsById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "ID is required" });
    }

    // Fetch business details by ID
    const business = await Business.findById(id);

    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    res.status(200).json({ success: true, data: business });
  } catch (error) {
    console.error("Error fetching business details:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Controller function to save outlet information
export const saveOutlet = async (req, res) => {
  console.log(req.body, "///////////////////////////////////////////////////");
  try {
    const {
      branch_name,
      contact_number,
      contact_person,
      fssai_license_number,
      gst_number,
      business,
      type_of_industry,
      unit,
      no_of_production_line,
      vertical_of_industry,
      city,
    } = req.body;

    // Create a new outlet instance with the provided data
    const newOutlet = new Outlet({
      branch_name,
      contact_number,
      contact_person,
      fssai_license_number,
      gst_number,
      business,
      type_of_industry,
      unit,
      no_of_production_line,
      vertical_of_industry,
      city,
    });

    // Save the outlet to the database
    await newOutlet.save();

    res.status(201).json({ message: "Outlet data saved successfully" });
  } catch (error) {
    console.error("Error saving outlet data:", error);
    res
      .status(500)
      .json({ message: "Failed to save outlet data. Please try again later." });
  }
};
// Update The outlet Information
export const updateOutlet = async (req, res) => {
  try {
    const { outletId } = req.params;
    const {
      branch_name,
      business,
      gst_number,
      contact_number,
      contact_person,
      fssai_license_number,
      vertical_of_industry, // Corrected casing
      type_of_industry,
      city,
      unit,
    } = req.body;

    // Check if outletId is provided
    if (!outletId) {
      return res.status(400).json({ message: "Outlet ID is required" });
    }

    // Find the outlet by ID
    const outlet = await Outlet.findById(outletId);
    if (!outlet) {
      return res.status(404).json({ message: "Outlet not found" });
    }

    // Update the fields that are provided
    if (branch_name) outlet.branch_name = branch_name;
    if (business) outlet.business = business;
    if (gst_number) outlet.gst_number = gst_number;
    if (contact_number) outlet.contact_number = contact_number;
    if (contact_person) outlet.contact_person = contact_person;
    if (fssai_license_number)
      outlet.fssai_license_number = fssai_license_number;
    if (vertical_of_industry)
      outlet.vertical_of_industry = vertical_of_industry; // Corrected casing
    if (type_of_industry)
      outlet.type_of_industry = type_of_industry; // Corrected casing
    if (city) outlet.city = city;
    if (unit) outlet.unit = unit;
    // Save the outlet
    await outlet.save();

    return res
      .status(200)
      .json({ message: "Outlet updated successfully", data: outlet });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

//Fetch Bussiness name to show in outlets
export const getBusinesses = async (req, res) => {
  try {
    // Fetch all businesses where status is "approved"
    const businesses = await Business.find({ status: "approved" }, "_id name");

    return res.status(200).json({ businesses });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllBusinessDetails = async (req, res) => {
  try {
    const { page, pageSize, sort, keyword } = req.query;

    // Convert page and pageSize to integers
    const pageNumber = parseInt(page);
    const sizePerPage = parseInt(pageSize);

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

    // Base query with status condition
    let query = Business.find({
      status: "approved", // Filter for businesses with status "pending"
    });

    // Apply search keyword if provided
    if (keyword) {
      const searchRegex = new RegExp(keyword, "i"); // Case-insensitive regex
      query = query.or([
        { name: searchRegex },
        { contact_person: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
      ]);
    }

    // Apply sorting based on the 'sort' parameter
    if (sort === "newlyadded") {
      query = query.sort({ created_at: -1 });
    }

    // Count total number of businesses
    const totalBusinesses = await Business.countDocuments(query.getQuery());

    // Retrieve businesses with pagination
    const businesses = await query
      .skip((pageNumber - 1) * sizePerPage)
      .limit(sizePerPage)
      .select(
        "-address -business_type -fssai_license_number -gst_number -updated_at"
      );

    // Retrieve outlet counts for each business
    const businessIds = businesses.map((business) => business._id);
    const outletCounts = await Outlet.aggregate([
      { $match: { business: { $in: businessIds } } },
      { $group: { _id: "$business", count: { $sum: 1 } } },
    ]);

    // Combine business data with outlet counts and format created_at field
    const businessesWithCountsAndFormattedDate = businesses.map((business) => {
      const outletCount = outletCounts.find((count) =>
        count._id.equals(business._id)
      );
      const formattedCreatedAt = moment(business.created_at).fromNow(); // Format created_at using Moment.js
      return {
        ...business.toObject(),
        outletCount: outletCount ? outletCount.count : 0,
        created_at: formattedCreatedAt, // Update created_at with formatted date
      };
    });

    res.json({
      total: totalBusinesses, // Total number of businesses
      currentPage: pageNumber,
      data: businessesWithCountsAndFormattedDate,
    });
  } catch (error) {
    console.error("Error fetching businesses:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const countOutletsForBusinesses = async (req, res) => {
  try {
    // Aggregate outlets to count the number of outlets for each business
    const outletCountsByBusiness = await Outlet.aggregate([
      {
        $group: {
          _id: "$business", // Group by business ID
          count: { $sum: 1 }, // Count the number of outlets in each group
        },
      },
    ]);

    // Respond with the outlet counts for each business
    res.json(outletCountsByBusiness);
  } catch (error) {
    console.error("Error counting outlets for businesses:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteFields = async (req, res) => {
  try {
    const arrayOfBusinessIds = req.body;

    // Validate arrayOfBusinessIds if necessary
    if (!Array.isArray(arrayOfBusinessIds)) {
      return res
        .status(400)
        .json({ error: "Invalid input format. Expected an array of IDs." });
    }

    const deletionPromises = arrayOfBusinessIds.map(async (businessId) => {
      // Delete all outlets linked to this business
      await Outlet.deleteMany({ business: businessId });

      // Delete all questionaries linked to this business
      await Questionaries.deleteMany({ business: businessId });

      // Delete Business document
      await Business.deleteOne({ _id: businessId });
    });

    // Wait for all deletion operations to complete
    await Promise.all(deletionPromises);

    res.status(200).json({ message: "Fields deleted successfully" });
  } catch (err) {
    console.error("Error deleting fields:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

//Controller to send logic to
export const sendEmail = async (req, res) => {
  const { to, message, formLink, cc } = req.body;

  try {
    if (!to || !message || !formLink) {
      throw new Error("Missing parameters");
    }
    console.log(
      message,
      formLink,
      to,
      "----------------------------------------------------------------------------------"
    );

    // const transporter = nodemailer.createTransport({
    //   host: "smtp-relay.brevo.com",
    //   port: 2525, // Port 2525 (STARTTLS)
    //   secure: false, // No SSL for port 2525
    //   auth: {
    //     user: process.env.BREVO_SMTP_USER,
    //     pass: process.env.BREVO_SMTP_PASSWORD,
    //   },
    // });
    // const transporter = nodemailer.createTransport({
    //   host: "email-smtp.ap-south-1.amazonaws.com",
    //   port: process.env.SES_PORT, // Port 2525 (STARTTLS)
    //   secure: false, // No SSL for port 2525
    //   auth: {
    //     user: process.env.AWS_SMTP_LOGIN,
    //     pass: process.env.AWS_SMTP_SECRET_KEY,
    //   },
    // });

    const sendersEmail = process.env.SENDERS_EMAIL;

    // const emailContent = message.replace("{formlink}", formLink);

    const replacedMessage = message.replace(
      "{formlink}",
      `<a href="${formLink}">${formLink}</a>`
    );
    const emailContent = `<p>${replacedMessage} ${formLink}</p>`;

    // const mailOptions = {
    //   from: `"Unavar Food Inspection and Certification Private Limited " <${sendersEmail}>`,
    //   to,
    //   subject: "Client Onboarding Process",
    //   html: emailContent,
    // };

    // const info = await transporter.sendMail(mailOptions);

    // Configure email with optional cc field
    const mailOptions = {
      from: `"Unavar Food Inspection and Certification Private Limited" <${sendersEmail}>`,
      to,
      cc,
      subject: "Client Onboarding Form",
      html: emailContent,
    };
    const mail = new MailComposer(mailOptions);

    const rawMessage = await new Promise((resolve, reject) => {
      mail.compile().build((err, message) => {
        if (err) return reject(err);
        resolve(message);
      });
    });

    const command = new SendRawEmailCommand({
      RawMessage: {
        Data: rawMessage,
      },
    });

    const info = await sesClient.send(command);

    console.log("Email sent:", info.response, message, formLink, to);
    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
};

export const getOutletDetailsById = async (req, res) => {
  try {
    const { businessId } = req.params;
    let { page, pageSize, sort } = req.query;

    // Convert page and pageSize to numbers and validate
    page = parseInt(page, 10) || 1;
    pageSize = parseInt(pageSize, 10) || 10;
    const skip = (page - 1) * pageSize;

    // Check if businessId exists
    const businessExists = await Business.exists({ _id: businessId });
    if (!businessExists) {
      // console.log("Business not found");
      return res.status(404).json({ message: "Business not found" });
    }

    // Find the total count of outlets with the specified business ID
    const totalOutlets = await Outlet.countDocuments({ business: businessId });
    //  console.log(`Total outlets found: ${totalOutlets}`);

    // Initialize query with pagination
    let query = Outlet.find({ business: businessId })
      .populate("business")
      .skip(skip)
      .limit(pageSize);

    // Apply sorting based on the 'sort' parameter
    if (sort === "newlyadded") {
      query = query.sort({ created_at: -1 });
    }

    // Execute the query to get outlets
    const outlets = await query;

    // console.log(`Found ${outlets.length} outlets`);

    if (!outlets.length) {
      return res.status(200).json({
        message: "No outlets found",
        data: [],
        total: totalOutlets,
        currentPage: page,
        pageSize: pageSize,
      });
    }

    const populatedData = outlets.map((outlet) => ({
      _id: outlet._id, // Include outlet ID
      outlet_name: outlet.branch_name,
      fssai_license_number: outlet.fssai_license_number,
      contact_number: outlet.contact_number,
      contact_person: outlet.contact_person,
      no_of_food_handlers: outlet.no_of_food_handlers,
      gst_number: outlet.gst_number,
      type_of_industry: outlet.type_of_industry,
      vertical_of_industry: outlet.vertical_of_industry,
      unit: outlet.unit,
      city: outlet.city || "",
    }));

    console.log(`Populated data: ${JSON.stringify(populatedData)}`);

    return res.status(200).json({
      message: "Data populated successfully",
      data: populatedData,
      total: totalOutlets,
      currentPage: page,
      pageSize: pageSize,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

//Controller to deltet the array of fields of outlet
export const deleteOutlets = async (req, res) => {
  try {
    const arrayOfOutletIds = req.body; // Assuming an array of arrays of IDs is sent in the request body

    // Validate the arrayOfOutletIds here if necessary

    // Assuming Outlet is your Mongoose model
    const deletionPromises = arrayOfOutletIds.map(async (outletIds) => {
      // Delete outlets by their IDs
      return Outlet.deleteMany({ _id: { $in: outletIds } });
    });

    // Wait for all deletion operations to complete
    await Promise.all(deletionPromises);

    res.status(200).json({ message: "Outlets deleted successfully" });
  } catch (err) {
    console.error("Error deleting outlets:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getParticularOutletDetails = async (req, res) => {
  const outletId = req.params.id;

  try {
    // Find the outlet by ID without populating other references
    const outlet = await Outlet.findById(outletId);

    if (!outlet) {
      return res.status(404).json({ error: "Outlet not found" });
    }

    const response = {
      branch_name: outlet.branch_name,
      outlet_id: outlet._id,
      fssai_license_number: outlet.fssai_license_number,
      contact_number: outlet.contact_number,
      contact_person: outlet.contact_person,
      type_of_industry: outlet.type_of_industry,
      unit: outlet.unit,
      no_of_production_line: outlet.no_of_production_line,
      gst_number: outlet.gst_number,
      vertical_of_industry: outlet.vertical_of_industry,
      city: outlet.city || "",
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//Controller to get all the client name
// export const getAllClientName = async (req, res) => {
//   try {
//     // Fetch all client names and their IDs from the Business model
//     const clientNameList = await Business.find({}, "name _id").exec();

//     // Extract client names and IDs from the query result
//     const clients = clientNameList.map((business) => ({
//       id: business._id,
//       name: business.name,
//     }));

//     res.status(200).json(clients);
//   } catch (error) {
//     res.status(500).json({
//       message: "An error occurred while fetching client names",
//       error,
//     });
//   }
// };

//Outlet to get the branch name from Outlet Model by specific bussiness id

export const getBranchNamesByBusinessId = async (req, res) => {
  const { businessId } = req.params;

  try {
    console.log(`Fetching branch names for business ID: ${businessId}`);

    // Ensure businessId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({ message: "Invalid business ID" });
    }

    // Fetch branch names and outlet IDs from the Outlet model for the specific business ID
    const branchList = await Outlet.find(
      { business: businessId },
      { _id: 1, branch_name: 1 } // Projection to retrieve only outlet ID and branch name
    ).exec();

    console.log("Branches found:", branchList);

    // Extract branch names and outlet IDs from the query result
    const branches = branchList.map((outlet) => ({
      _id: outlet._id,
      branchName: outlet.branch_name,
    }));

    res.status(200).json(branches);
  } catch (error) {
    console.error("Error fetching branches:", error);
    res.status(500).json({
      message: "An error occurred while fetching branches",
      error,
    });
  }
};

//check client onboarding approved or not
export const getAllClientDetails = async (req, res) => {
  try {
    const { page, pageSize, sort, keyword } = req.query;

    // Convert page and pageSize to integers
    const pageNumber = parseInt(page);
    const sizePerPage = parseInt(pageSize);

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

    // Base query with added conditions
    let query = Business.find({
      added_by: "Client Form",
      status: "pending",
    });

    // Apply search keyword if provided
    if (keyword) {
      const searchRegex = new RegExp(keyword, "i"); // Case-insensitive regex
      query = query.or([
        { name: searchRegex },
        { contact_person: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
      ]);
    }

    // Apply sorting based on the 'sort' parameter
    if (sort === "newlyadded") {
      query = query.sort({ created_at: -1 });
    }

    // Count total number of businesses
    const totalBusinesses = await Business.countDocuments(query.getQuery());

    // Retrieve businesses with pagination
    const businesses = await query
      .skip((pageNumber - 1) * sizePerPage)
      .limit(sizePerPage)
      .select(
        "-address -business_type -fssai_license_number -gst_number -updated_at"
      );

    // Retrieve outlet counts for each business
    const businessIds = businesses.map((business) => business._id);
    const outletCounts = await Outlet.aggregate([
      { $match: { business: { $in: businessIds } } },
      { $group: { _id: "$business", count: { $sum: 1 } } },
    ]);

    // Combine business data with outlet counts and format created_at field
    const businessesWithCountsAndFormattedDate = businesses.map((business) => {
      const outletCount = outletCounts.find((count) =>
        count._id.equals(business._id)
      );
      const formattedCreatedAt = moment(business.created_at).fromNow(); // Format created_at using Moment.js
      return {
        ...business.toObject(),
        outletCount: outletCount ? outletCount.count : 0,
        created_at: formattedCreatedAt, // Update created_at with formatted date
      };
    });

    res.json({
      total: totalBusinesses, // Total number of businesses
      currentPage: pageNumber,
      data: businessesWithCountsAndFormattedDate,
    });
  } catch (error) {
    console.error("Error fetching businesses:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateBusinessStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const updatedBusiness = await Business.findByIdAndUpdate(
      id,
      { status: "approved" }, // Set the status to 'approved'
      { new: true } // Return the updated document
    );

    if (!updatedBusiness) {
      return res.status(404).json({ message: "Business not found" });
    }

    return res.status(200).json(updatedBusiness);
  } catch (error) {
    console.error("Error updating business status:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const saveQuestionary = async (req, res) => {
  console.log(req.body);
  try {
    const {
      existing_consultancy_name,
      fostac_agency_name,
      other_certifications,
      business,
    } = req.body;

    if (!existing_consultancy_name || !fostac_agency_name || !business) {
      return res.status(400).json({
        message:
          "Existing consultancy name, FOSTAC Agency Name, and Business are required.",
      });
    }

    const newQuestionary = new Questionaries({
      existing_consultancy_name,
      fostac_agency_name,
      other_certifications,
      business,
    });

    const savedQuestionary = await newQuestionary.save();
    res.status(201).json(savedQuestionary);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getQuestionaryByBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({ message: "Invalid business ID" });
    }

    const questionaries = await Questionaries.findOne({ business: businessId });

    if (!questionaries) {
      return res.status(404).json({ message: "Questionaries not found" });
    }

    res.status(200).json({ success: true, data: questionaries });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// controllers/questionaryController.js
export const updateQuestionary = async (req, res) => {
  try {
    const { businessId } = req.params; // The ID of the business
    const {
      existing_consultancy_name,
      fostac_agency_name,
      other_certifications,
    } = req.body;

    // Check if businessId is provided
    if (!businessId) {
      return res.status(400).json({ message: "Business ID is required" });
    }

    // Find the business by ID
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    // Find the questionary associated with the business
    const questionary = await Questionaries.findOne({ business: businessId });
    if (!questionary) {
      return res.status(404).json({ message: "Questionary not found" });
    }

    // Update the fields that are provided
    if (existing_consultancy_name)
      questionary.existing_consultancy_name = existing_consultancy_name;
    if (fostac_agency_name) questionary.fostac_agency_name = fostac_agency_name;
    if (other_certifications)
      questionary.other_certifications = other_certifications;

    // Save the updated questionary
    await questionary.save();

    return res.status(200).json({
      success: true,
      message: "Questionary updated successfully",
      data: questionary,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
