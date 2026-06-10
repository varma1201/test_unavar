// import { compressFiles } from "../utils/compressionService.js";

// const compressionMiddleware = async (req, res, next) => {
//   try {
//     console.log(`Compression middleware: ${req.method} ${req.path}`);

//     // Skip if no files
//     if ((!req.files || req.files.length === 0) && !req.file) {
//       console.log("No files to compress");
//       return next();
//     }

//     // Handle single file (for updateFssaiDetails)
//     if (req.file && !req.files) {
//       console.log(
//         `Compressing single file: ${req.file.originalname} (${(
//           req.file.size /
//           1024 /
//           1024
//         ).toFixed(2)}MB)`
//       );

//       const files = [req.file];
//       const compressedFiles = await compressFiles(files);

//       if (compressedFiles.length > 0) {
//         req.file = compressedFiles[0];
//         console.log(
//           `File compressed: ${req.file.originalname} - ${
//             req.file.compressed ? "SUCCESS" : "FAILED"
//           }`
//         );

//         if (req.file.compressed && req.file.originalSize) {
//           const reduction = (
//             ((req.file.originalSize - req.file.size) / req.file.originalSize) *
//             100
//           ).toFixed(2);
//           console.log(
//             `Size reduction: ${reduction}% (${(
//               req.file.originalSize /
//               1024 /
//               1024
//             ).toFixed(2)}MB → ${(req.file.size / 1024 / 1024).toFixed(2)}MB)`
//           );
//         }
//       }
//     }
//     // Handle multiple files (for saveAuditResponses, updateAuditResponses)
//     else if (req.files && req.files.length > 0) {
//       console.log(`Compressing ${req.files.length} files`);

//       const originalTotalSize = req.files.reduce(
//         (sum, file) => sum + file.size,
//         0
//       );
//       req.files = await compressFiles(req.files);

//       const compressedTotalSize = req.files.reduce(
//         (sum, file) => sum + file.size,
//         0
//       );
//       const compressedCount = req.files.filter((f) => f.compressed).length;

//       console.log(
//         `Multiple files compressed: ${compressedCount}/${req.files.length} files`
//       );

//       if (originalTotalSize > 0) {
//         const totalReduction = (
//           ((originalTotalSize - compressedTotalSize) / originalTotalSize) *
//           100
//         ).toFixed(2);
//         console.log(
//           `Total size reduction: ${totalReduction}% (${(
//             originalTotalSize /
//             1024 /
//             1024
//           ).toFixed(2)}MB → ${(compressedTotalSize / 1024 / 1024).toFixed(
//             2
//           )}MB)`
//         );
//       }
//     }

//     next();
//   } catch (error) {
//     console.error("Compression middleware error:", error.message);
//     next();
//   }
// };

// export default compressionMiddleware;

import { compressFiles } from "../utils/compressionService.js";

const compressionMiddleware = async (req, res, next) => {
  try {
    console.log(`Compression middleware: ${req.method} ${req.path}`);

    // Skip if no files
    if ((!req.files || req.files.length === 0) && !req.file) {
      console.log("No files to compress");
      return next();
    }

    // Handle single file (for updateFssaiDetails)
    if (req.file && !req.files) {
      console.log(
        `Compressing single file: ${req.file.originalname} (${(
          req.file.size /
          1024 /
          1024
        ).toFixed(2)}MB)`
      );

      // Ensure the file has a buffer (memory storage)
      if (!req.file.buffer) {
        console.warn(
          `File ${req.file.originalname} has no buffer - skipping compression`
        );
        return next();
      }

      const files = [
        {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          originalSize: req.file.size,
        },
      ];

      const compressedFiles = await compressFiles(files);

      if (compressedFiles.length > 0 && compressedFiles[0].compressed) {
        // Update the file with compressed buffer and new size
        req.file.buffer = compressedFiles[0].buffer;
        req.file.size = compressedFiles[0].buffer.length;
        req.file.compressed = true;
        req.file.originalSize = compressedFiles[0].originalSize;

        console.log(`File compressed: ${req.file.originalname} - SUCCESS`);

        const reduction = (
          ((req.file.originalSize - req.file.size) / req.file.originalSize) *
          100
        ).toFixed(2);
        console.log(
          `Size reduction: ${reduction}% (${(
            req.file.originalSize /
            1024 /
            1024
          ).toFixed(2)}MB → ${(req.file.size / 1024 / 1024).toFixed(2)}MB)`
        );
      } else {
        console.log(
          `File compression skipped or failed: ${req.file.originalname}`
        );
        req.file.compressed = false;
        req.file.originalSize = req.file.size;
      }
    }
    // Handle multiple files (for saveAuditResponses, updateAuditResponses)
    else if (req.files && req.files.length > 0) {
      console.log(`Compressing ${req.files.length} files`);

      // Prepare files for compression
      const filesToCompress = req.files.map((file) => ({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        originalSize: file.size,
      }));

      const originalTotalSize = filesToCompress.reduce(
        (sum, file) => sum + file.size,
        0
      );

      const compressedFiles = await compressFiles(filesToCompress);

      // Update the original req.files with compressed results
      compressedFiles.forEach((compressedFile, index) => {
        if (compressedFile.compressed) {
          req.files[index].buffer = compressedFile.buffer;
          req.files[index].size = compressedFile.buffer.length;
          req.files[index].compressed = true;
          req.files[index].originalSize = compressedFile.originalSize;
        } else {
          req.files[index].compressed = false;
          req.files[index].originalSize = req.files[index].size;
        }
      });

      const compressedTotalSize = req.files.reduce(
        (sum, file) => sum + file.size,
        0
      );
      const compressedCount = req.files.filter((f) => f.compressed).length;

      console.log(
        `Multiple files compressed: ${compressedCount}/${req.files.length} files`
      );

      if (originalTotalSize > 0) {
        const totalReduction = (
          ((originalTotalSize - compressedTotalSize) / originalTotalSize) *
          100
        ).toFixed(2);
        console.log(
          `Total size reduction: ${totalReduction}% (${(
            originalTotalSize /
            1024 /
            1024
          ).toFixed(2)}MB → ${(compressedTotalSize / 1024 / 1024).toFixed(
            2
          )}MB)`
        );
      }
    }

    next();
  } catch (error) {
    console.error("Compression middleware error:", error.message);
    // Don't fail the request if compression fails
    next();
  }
};

export default compressionMiddleware;
