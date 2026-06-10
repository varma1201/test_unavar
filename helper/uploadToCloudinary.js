import cloudinary from "cloudinary";
import streamifier from "streamifier";

/**
 * Uploads a file buffer to Cloudinary.
 *
 * @param {Buffer} buffer - The file buffer to upload.
 * @param {string} folder - The folder in Cloudinary where the file should be uploaded.
 * @returns {Promise<Object>} - A promise that resolves with the Cloudinary upload result.
 */
export const uploadToCloudinary = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.v2.uploader.upload_stream(
      { folder }, // Ensure folder is specified correctly
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error.message);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    // Pipe the file buffer to the Cloudinary upload stream
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });

/**
 * Deletes a file from Cloudinary by public ID.
 *
 * @param {string} publicId - The public ID of the file to delete.
 * @returns {Promise<Object>} - A promise that resolves with the Cloudinary deletion result.
 */
export const deleteFromCloudinary = (publicId) =>
  new Promise((resolve, reject) => {
    console.log("Attempting to delete from Cloudinary with publicId:", publicId);

    cloudinary.v2.uploader.destroy(publicId, (error, result) => {
      if (error) {
        console.error("Cloudinary deletion error:", error.message);
        return reject(error);
      }

      console.log("Cloudinary deletion result:", result);

      // Handle case where the image doesn't exist
      if (result.result !== "ok") {
        console.warn(`Cloudinary deletion warning: ${result.result}`);
        return reject(new Error(`Deletion failed: ${result.result}`));
      }

      resolve(result);
    });
  });

