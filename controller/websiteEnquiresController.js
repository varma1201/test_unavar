import WebsiteEnquires from "../models/websiteEnquries.js";
import WebsiteCms from "../models/websiteCmsModel.js";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const bucketName = process.env.S3_BUCKET_NAME;
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const createWebsiteEnquiry = async (req, res) => {
  try {
    const { businessName, fullName, email, mobileNumber, service, message } =
      req.body;
    if (!businessName || !fullName || !email || !mobileNumber || !service) {
      return res
        .status(400)
        .json({ message: "required all details", success: false });
    }

    const emailExists = await WebsiteEnquires.findOne({
      isDeleted: false,
      $or: [{ email }, { mobileNumber }],
    });
    if (emailExists) {
      return res
        .status(409)
        .json({ message: "Your request alredy exist", success: false });
    }

    const newEnquiry = new WebsiteEnquires({
      businessName,
      fullName,
      email,
      mobileNumber,
      service,
      message,
    });

    await newEnquiry.save();

    return res.status(201).json({
      message: "Enquiry submitted successfully",
      success: true,
      data: newEnquiry,
    });
  } catch (error) {
    return res.status(400).json({ message: "internal server error" });
  }
};

const showWebsiteEnquires = async (req, res) => {
  try {
    const allEnquries = await WebsiteEnquires.find({ isDeleted: false });

    if (allEnquries.length === 0) {
      return res.status(404).json({
        message: "No enquiries found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Fetched website enquiries",
      success: true,
      data: allEnquries,
    });
  } catch (error) {
    return res.status(400).json({ message: "internal server error" });
  }
};

const removeWebsiteEnquiry = async (req, res) => {
  const idArr = req.body.data.ids;

  try {
    if (!Array.isArray(idArr) || idArr.length === 0) {
      return res
        .status(400)
        .json({ message: "No IDs provided", success: false });
    }

    const result = await WebsiteEnquires.updateMany(
      { _id: { $in: idArr } },
      { $set: { isDeleted: true } }
    );

    return res.status(200).json({
      message: "Enquiries deleted (soft delete)",
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error in removeWebsiteEnquiry:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", success: false });
  }
};

// CMS Controllers

const CreateCmsCard = async (req, res) => {
  try {
    const { title, originalLink, description } = req.body;

    if (!title || !originalLink || !description) {
      return res
        .status(400)
        .json({ message: "required all fileds", success: false });
    }
    let imageUrl;

    if (req.file) {
      const timestamp = Date.now();
      const fileName = `cms-card-image/${timestamp}-${req.file.originalname}`;

      const params = {
        Bucket: bucketName,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      await s3Client.send(new PutObjectCommand(params));
      imageUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      console.log("upload image of cms success", imageUrl);
    }

    const newCmsCard = new WebsiteCms({
      title,
      originalLink,
      description,
      imageUrl,
    });

    await newCmsCard.save();

    return res.status(200).json({
      message: "Created CMS Card",
      success: true,
      data: newCmsCard,
    });
  } catch (error) {
    return res
      .status(400)
      .json({ message: "internal server erroe", success: false });
  }
};

const UpdateCmsCard = async (req, res) => {
  try {
    const { title, originalLink, description } = req.body;
    const { id } = req.params;

    if (!title || !originalLink || !description) {
      return res.status(400).json({
        message:
          "All fields (id, title, originalLink, description) are required",
        success: false,
      });
    }

    const existingCard = await WebsiteCms.findById(id);
    if (!existingCard) {
      return res
        .status(404)
        .json({ message: "CMS card not found", success: false });
    }

    let imageUrl = existingCard.imageUrl;

    if (req.file) {
      // Construct new key
      const newFileName = `cms-card-image/${Date.now()}-${
        req.file.originalname
      }`;
      const newUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${newFileName}`;

      // Check if image has changed (comparing filename part of old URL)
      const oldKey = imageUrl?.split(".com/")[1] ?? "";
      const newKey = newFileName;

      if (oldKey !== newKey) {
        // Delete old image from S3
        if (oldKey) {
          try {
            await s3Client.send(
              new DeleteObjectCommand({ Bucket: bucketName, Key: oldKey })
            );
            console.log("🗑️ Old image deleted:", oldKey);
          } catch (err) {
            console.warn("⚠️ Failed to delete old image:", err.message);
          }
        }

        // Upload new image to S3
        const uploadParams = {
          Bucket: bucketName,
          Key: newKey,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        };

        await s3Client.send(new PutObjectCommand(uploadParams));
        console.log("✅ New image uploaded:", newKey);

        imageUrl = newUrl;
      } else {
        console.log("ℹ️ Image is same, skipping update.");
      }
    }

    // Update CMS card
    existingCard.title = title;
    existingCard.originalLink = originalLink;
    existingCard.description = description;
    existingCard.imageUrl = imageUrl;

    await existingCard.save();

    return res.status(200).json({
      message: "CMS card updated successfully",
      success: true,
      data: existingCard,
    });
  } catch (error) {
    console.error("❌ Update error:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", success: false });
  }
};

export default UpdateCmsCard;

const DeleteCmsCard = async (req, res) => {
  try {
    const { id } = req.params;

    // Step 1: Find the card
    const card = await WebsiteCms.findById(id);
    if (!card) {
      return res
        .status(404)
        .json({ message: "CMS card not found", success: false });
    }

    // Step 2: Delete image from S3 if exists
    const key = card.imageUrl?.split(".com/")[1]; // Get object key from URL
    if (key) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({ Bucket: bucketName, Key: key })
        );
        console.log("🗑️ S3 image deleted:", key);
      } catch (err) {
        console.warn("⚠️ Failed to delete image from S3:", err.message);
      }
    }

    // Step 3: Delete card from DB
    await WebsiteCms.findByIdAndDelete(id);

    return res.status(200).json({ message: "CMS card deleted", success: true });
  } catch (error) {
    console.error("❌ Delete error:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", success: false });
  }
};

const ShowCmsCards = async (req, res) => {
  try {
    const cmsCards = await WebsiteCms.find().sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Fetched CMS cards successfully",
      success: true,
      data: cmsCards,
    });
  } catch (error) {
    console.error("❌ Error fetching CMS cards:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", success: false });
  }
};

export {
  createWebsiteEnquiry,
  showWebsiteEnquires,
  removeWebsiteEnquiry,
  CreateCmsCard,
  UpdateCmsCard,
  DeleteCmsCard,
  ShowCmsCards,
};
