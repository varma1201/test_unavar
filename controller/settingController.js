import Setting from "../models/settingModel.js";
import CompanyDetail from "../models/CompanyDetail.js";
import BankDetail from "../models/BankDetailModel.js";

// Create a new setting
export const createSetting = async (req, res) => {
  try {
    const { proposal_note, invoice_note, proposal_email, invoice_email } =
      req.body;

    const newSetting = new Setting({
      proposal_note,
      invoice_note,
      proposal_email,
      invoice_email,
    });

    await newSetting.save();

    res.status(201).json(newSetting);
  } catch (error) {
    res.status(500).json({ message: "Failed to create setting", error });
  }
};

// Get a specific setting by ID
export const getSetting = async (req, res) => {
  try {
    let setting = await Setting.findOne();

    if (!setting) {
      // Only create if no record exists
      setting = new Setting({
        proposal_note: "",
        invoice_note: "",
        proposal_email: "",
        invoice_email: "",
        agreement_email: "",
        proposal_cc: [],
        invoice_cc: [],
        agreement_cc: [],
        formlink_email: "",
      });

      await setting.save();
    }

    res.status(200).json(setting);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve or create setting", error });
  }
};

// Update a setting by ID
export const updateSetting = async (req, res) => {
  try {
    const {
      proposal_note,
      invoice_note,
      proposal_email,
      invoice_email,
      agreement_email,
      proposal_cc,
      invoice_cc,
      agreement_cc,
      formlink_email,
    } = req.body;

    const setting = await Setting.findOne();

    if (!setting) {
      return res.status(404).json({ message: "No setting found to update" });
    }

    if (proposal_note !== undefined) setting.proposal_note = proposal_note;
    if (invoice_note !== undefined) setting.invoice_note = invoice_note;
    if (proposal_email !== undefined) setting.proposal_email = proposal_email;
    if (invoice_email !== undefined) setting.invoice_email = invoice_email;
    if (agreement_email !== undefined)
      setting.agreement_email = agreement_email;
    if (proposal_cc !== undefined) setting.proposal_cc = proposal_cc;
    if (invoice_cc !== undefined) setting.invoice_cc = invoice_cc;
    if (agreement_cc !== undefined) setting.agreement_cc = agreement_cc;
    if (formlink_email !== undefined) setting.formlink_email = formlink_email;

    await setting.save();

    res.status(200).json(setting);
  } catch (error) {
    res.status(500).json({ message: "Failed to update setting", error });
  }
};

// Delete a setting by ID
export const deleteSetting = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedSetting = await Setting.findByIdAndDelete(id);

    if (!deletedSetting) {
      return res.status(404).json({ message: "Setting not found" });
    }

    res.status(200).json({ message: "Setting deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete setting", error });
  }
};

export const saveOrUpdateProfile = async (req, res) => {
  console.log(req.body);
  try {
    const {
      company_name,
      company_address, // This should be an object with line1, line2, state, city, and pincode
      contact_number,
      email,
      gstin,
      pan,
    } = req.body;

    // Validate input
    if (
      !company_name ||
      !company_address ||
      !company_address.line1 ||
      !company_address.city ||
      !company_address.state ||
      !company_address.pincode
    ) {
      return res.status(400).json({ message: "Required fields are missing." });
    }

    // Check if the profile setting already exists
    let companyDetail = await CompanyDetail.findOne();

    if (companyDetail) {
      // Update existing profile
      companyDetail.company_name = company_name;
      companyDetail.company_address = company_address;
      companyDetail.contact_number = contact_number;
      companyDetail.email = email;
      companyDetail.gstin = gstin;
      companyDetail.pan = pan;
    } else {
      // Create a new profile
      companyDetail = new CompanyDetail({
        company_name,
        company_address,
        contact_number,
        email,
        gstin,
        pan,
      });
    }

    // Save the profile (either newly created or updated)
    const savedProfile = await companyDetail.save();

    res
      .status(200)
      .json({
        message: "Profile saved/updated successfully",
        profile: savedProfile,
      });
  } catch (error) {
    console.error("Error in saveOrUpdateProfile:", error); // Log the error for debugging
    res
      .status(500)
      .json({
        message: "Error saving/updating the profile",
        error: error.message,
      });
  }
};

export const getCompanyDetail = async (req, res) => {
  try {
    // Fetch the company detail
    const companyDetail = await CompanyDetail.findOne();

    if (!companyDetail) {
      // Return 404 if no profile is found
      return res.status(404).json({ message: "Profile setting not found" });
    }

    // Return the found profile
    res.status(200).json({ profile: companyDetail });
  } catch (error) {
    console.error("Error in getCompanyDetail:", error); // Log the error for debugging
    res
      .status(500)
      .json({
        message: "Error fetching the profile setting",
        error: error.message,
      });
  }
};

export const saveAndUpdateBankDetail = async (req, res) => {
  try {
    const {
      bank_name,
      account_holder_name,
      account_number,
      ifsc_code,
      branch_name,
      micr_code,
    } = req.body;

    // Validate required fields
    if (
      !bank_name ||
      !account_holder_name ||
      !account_number ||
      !ifsc_code ||
      !micr_code
    ) {
      return res.status(400).json({ message: "Required fields are missing." });
    }

    // Check if bank details already exist
    let bankDetail = await BankDetail.findOne();

    if (bankDetail) {
      // Update existing bank details
      bankDetail.bank_name = bank_name;
      bankDetail.account_holder_name = account_holder_name;
      bankDetail.account_number = account_number;
      bankDetail.ifsc_code = ifsc_code;
      bankDetail.branch_name = branch_name;
      bankDetail.micr_code = micr_code;
    } else {
      // Create new bank details
      bankDetail = new BankDetail({
        bank_name,
        account_holder_name,
        account_number,
        ifsc_code,
        branch_name,
        micr_code,
      });
    }

    // Save the bank details
    const savedBankDetail = await bankDetail.save();

    res
      .status(200)
      .json({
        message: "Bank details saved/updated successfully",
        bankDetail: savedBankDetail,
      });
  } catch (error) {
    console.error("Error in saveAndUpdateBankDetail:", error);
    res
      .status(500)
      .json({
        message: "Error saving/updating bank details",
        error: error.message,
      });
  }
};

export const getTheBankDetails = async (req, res) => {
  try {
    // Fetch the bank details
    const bankDetail = await BankDetail.findOne();

    if (!bankDetail) {
      return res.status(404).json({ message: "Bank details not found." });
    }

    res.status(200).json({ bankDetail });
  } catch (error) {
    console.error("Error in getTheBankDetails:", error);
    res
      .status(500)
      .json({ message: "Error fetching bank details", error: error.message });
  }
};
