import { User } from "../models/usersModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import {
  SESClient,
  SendEmailCommand,
  SendRawEmailCommand,
} from "@aws-sdk/client-ses";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const sesClient = new SESClient({
  region: process.env.AWS_REGION, // Change to your SES region
  credentials: {
    accessKeyId: process.env.AWS_SMTP_LOGIN,
    secretAccessKey: process.env.AWS_SMTP_SECRET_KEY,
  },
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const userRoles = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ACCOUNT_ADMIN: "ACCOUNT_ADMIN",
  AUDIT_ADMIN: "AUDIT_ADMIN",
  AUDITOR: "AUDITOR", // Added AUDITOR role
};

const OTP_SECRET = process.env.OTP_SECRET || "arun@321";

console.log(OTP_SECRET, "otp secret key")
if (!OTP_SECRET) {
  console.error(
    "OTP_SECRET is not set. Please set the OTP_SECRET environment variable."
  );
  process.exit(1); // Exit the application if OTP_SECRET is not set
}

const generateOTP = () => {
  let OTP = "";
  for (let i = 0; i < 6; i++) OTP += Math.floor(Math.random() * 10);
  return OTP;
};

// token Expiry time get from env 

const jwtExpireDays = Number(process.env.JWT_EXPIRE_DAYS);

// 7 days → seconds
const expiresInSeconds = jwtExpireDays * 24 * 60 * 60;


export const registerUser = async (req, res) => {
  try {
    console.log(req.body);
    const { userName, userId, password } = req.body;
    const roles = JSON.parse(req.body.roles);

    // Check if userId already exists
    const existingUser = await User.findOne({ userId });
    if (existingUser) {
      return res.status(400).json({ message: "User ID already exists" });
    }

    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ message: "At least one role is required" });
    }

    for (const role of roles) {
      if (!Object.values(userRoles).includes(role)) {
        return res.status(400).json({ message: `Invalid role: ${role}` });
      }
    }

    let signatureUrl = null;

    // If AUDITOR, upload signature
    if (roles.includes(userRoles.AUDITOR)) {
      if (!req.file) {
        return res
          .status(400)
          .json({ message: "Signature is required for auditors" });
      }

      const key = `signatures/${Date.now()}-${req.file.originalname}`;
      const uploadParams = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      // Generate public S3 URL
      signatureUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create and save user
    const newUser = new User({
      userName,
      userId: userId.toLowerCase(),
      password: hashedPassword,
      roles,
      signatureUrl,
    });

    await newUser.save();

    res
      .status(201)
      .json({ message: "User registered successfully", success: true });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//Controller for login
export const loginUser = async (req, res) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  try {
    const { userId, password, role } = req.body;
    console.log(req.body);

    // Check if user exists
    const user = await User.findOne({ userId });
    console.log(user);
    if (!user) {
      console.error("User not found");
      return res.status(200).json({ message: "Invalid user ID or password" });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.error("Invalid password");
      return res.status(200).json({ message: "Invalid user ID or password" });
    }

    // Check if role matches
    if (!user.roles.includes(role)) {
      console.error("Unauthorized role");
      return res
        .status(403)
        .json({ message: "You are not authorized for this role" });
    }

    // Generate JWT Token with user ObjectId
    const token = jwt.sign(
      {
        userName: user.userName,
        userId: user.userId,
        roles: user.roles,
        role, // Current logined role
        _id: user._id, // Include the actual user ObjectId in the payload
      },
      // OTP_SECRET,

      JWT_SECRET,
      { expiresIn: expiresInSeconds } // Token expiry time
    );

    res.status(200).json({ success: true, token });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

//Controller for forgot password
export const forgotPassword = async (req, res) => {
  try {
    if (!req.body.userId)
      return res.status(400).json({ message: "Missing userId" });

    const userId = req.body.userId.toLowerCase();
    const user = await User.findOne({ userId });

    if (!user) return res.status(404).json({ message: "User not found" });

    const OTP = generateOTP();
    console.log(OTP, "otp forgot password");
    // Save OTP to user's record
    await User.findOneAndUpdate(
      { userId },
      { $set: { resetPasswordOTP: OTP } },
      { new: true }
    );

    // Send OTP via SES (MailComposer -> SendRawEmailCommand)
    const sendersEmail = process.env.SENDERS_EMAIL;
    const mail = new MailComposer({
      from: `"Your Company" <${sendersEmail}>`,
      to: userId,
      subject: "Password Reset OTP",
      text: `Your OTP for password reset is: ${OTP}.`,
    });

    const rawMessage = await new Promise((resolve, reject) => {
      mail.compile().build((err, message) => {
        if (err) return reject(err);
        resolve(message);
      });
    });

    await sesClient.send(
      new SendRawEmailCommand({ RawMessage: { Data: rawMessage } })
    );

    res
      .status(200)
      .json({ message: "OTP sent successfully. Check your email." });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { userId: rawUserId, otp } = req.body;
    if (!rawUserId || !otp)
      return res.status(400).json({ message: "Missing userId or otp" });

    const userId = rawUserId.toLowerCase();
    const user = await User.findOne({ userId });

    if (!user || user.resetPasswordOTP !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Invalidate OTP
    user.resetPasswordOTP = null;
    await user.save();

    // Issue short JWT with userId
    const token = jwt.sign({ userId }, OTP_SECRET, { expiresIn: "15m" });
    res.status(200).json({ message: "OTP verified successfully", token });
  } catch (error) {
    console.error("Error in verifyOTP:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//setnewpassw
export const setNewPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    // req.userId is set by verifyOTPToken middleware
    if (!req.userId || !newPassword) {
      return res
        .status(400)
        .json({ message: "Missing newPassword or invalid token" });
    }

    const normalizedUserId = req.userId.toLowerCase();
    const user = await User.findOne({ userId: normalizedUserId });

    if (!user) return res.status(404).json({ message: "User not found" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error during password reset:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//Get all user
export const fetchAllUsers = async (req, res) => {
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
    let query = User.find();

    // Apply search keyword if provided
    if (keyword) {
      const searchRegex = new RegExp(keyword, "i"); // Case-insensitive regex
      query = query.where("userName").regex(searchRegex);
    }

    // Determine the sort query based on the 'sort' parameter
    const sortQuery = (() => {
      switch (sort) {
        case "newlyadded":
          return { createdAt: -1 };
        case "alllist":
          return { createdAt: 1 };
      }
    })();

    // Count total number of users
    const totalUsers = await User.countDocuments(query.getQuery());

    // Retrieve users with pagination and sorting
    const users = await query
      .skip((pageNumber - 1) * sizePerPage)
      .limit(sizePerPage)
      .sort(sortQuery)
      .select("userId roles userName createdAt"); // Select only the needed fields

    res.json({
      total: totalUsers,
      currentPage: pageNumber,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching users:", error); // Log error to console
    res.status(500).json({ message: "Server error" });
  }
};

//Get all representatives - all users in settings
export const fetchAllRepresentatives = async (req, res) => {
  try {
    let query = User.find();
    const users = await query.select("userId roles userName createdAt");
    const totalUsers = await User.countDocuments(query.getQuery());

    res.json({
      success: true,
      total: totalUsers,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching representatives:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch representatives",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

export const deleteFields = async (req, res) => {
  console.log(req.body);
  try {
    const arrayOfUserIds = req.body;

    // Validate arrayOfUserIds if necessary
    if (!Array.isArray(arrayOfUserIds)) {
      return res
        .status(400)
        .json({ error: "Invalid input: Expected an array of User IDs" });
    }

    // Perform deletions
    const deletionPromises = arrayOfUserIds.map(async (userId) => {
      // Delete User document
      await User.deleteOne({ _id: userId });
    });

    // Wait for all deletion operations to complete
    await Promise.all(deletionPromises);

    res.status(200).json({ message: "Users deleted successfully" });
  } catch (err) {
    console.error("Error deleting users:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch the user by ID, excluding the password field
    const user = await User.findById(userId).select("-password");

    // Check if the user exists
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return the user details
    res.status(200).json(user);
  } catch (error) {
    console.error("Error in fetching the data:", error); // Log error to console
    res.status(500).json({ message: "Server Error" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userName, password } = req.body;
    const roles = JSON.parse(req.body.roles);
    console.log(req.body);
    console.log(password);

    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update fields
    existingUser.userName = userName || existingUser.userName;
    if (roles && Array.isArray(roles)) {
      for (const r of roles) {
        if (!Object.values(userRoles).includes(r)) {
          return res.status(400).json({ message: `Invalid role: ${r}` });
        }
      }
      existingUser.roles = roles;
    }

    // If password is provided, hash and update
    if (password) {
      const salt = await bcrypt.genSalt(10);
      existingUser.password = await bcrypt.hash(password, salt);
    }

    // Handle signature upload for AUDITOR role
    if (req.file) {
      const bucketName = process.env.S3_BUCKET_NAME;

      // Delete old signature if exists
      if (existingUser.signatureKey) {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: existingUser.signatureKey,
          })
        );
      }

      // Upload new file
      const fileKey = `signatures/${Date.now()}-${req.file.originalname}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: fileKey,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
      );

      // Save S3 details
      existingUser.signatureKey = fileKey;
      existingUser.signatureUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
    }

    await existingUser.save();

    res.status(200).json({
      message: "User updated successfully",
      success: true,
      user: existingUser,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Server error" });
  }
};
