// import sharp from "sharp";
// import { exec } from "child_process";
// import util from "util";
// import fs from "fs/promises";
// import path from "path";

// const execPromise = util.promisify(exec);
// const tempDir = "./temp";
// const MAX_PDF_SIZE = 1 * 1024 * 1024; // 1MB in bytes

// // Initialize temp directory
// let tempDirInitialized = false;

// async function ensureTempDir() {
//   if (!tempDirInitialized) {
//     try {
//       await fs.access(tempDir);
//     } catch {
//       await fs.mkdir(tempDir, { recursive: true });
//     }
//     tempDirInitialized = true;
//   }
// }

// // Call this at module load
// ensureTempDir().catch(console.error);

// async function compressFile(file) {
//   const { buffer, originalname, mimetype, originalSize } = file;

//   try {
//     console.log(
//       `Compressing: ${originalname}, Type: ${mimetype}, Size: ${(
//         (originalSize || buffer.length) /
//         1024 /
//         1024
//       ).toFixed(2)}MB`
//     );

//     let compressedBuffer;
//     if (mimetype.startsWith("image/")) {
//       compressedBuffer = await compressImage(buffer, originalname);
//     } else if (mimetype === "application/pdf") {
//       compressedBuffer = await compressPDF(buffer, originalname);
//     } else {
//       console.log(`Skipping compression for ${mimetype}`);
//       return { buffer, compressed: false };
//     }

//     const originalSizeValue = originalSize || buffer.length;
//     const compressionRatio = (
//       ((originalSizeValue - compressedBuffer.length) / originalSizeValue) *
//       100
//     ).toFixed(2);

//     console.log(
//       `File compressed: ${originalname} - ${compressionRatio}% reduction`
//     );

//     return { buffer: compressedBuffer, compressed: true };
//   } catch (error) {
//     console.error(`Compression failed for ${originalname}:`, error.message);
//     return { buffer, compressed: false };
//   }
// }

// async function compressImage(buffer, filename) {
//   try {
//     const compressedBuffer = await sharp(buffer)
//       .resize({
//         width: 1920,
//         height: 1920,
//         fit: "inside",
//         withoutEnlargement: true,
//       })
//       .jpeg({
//         quality: 80,
//         mozjpeg: true,
//       })
//       .png({
//         quality: 80,
//         compressionLevel: 9,
//       })
//       .toBuffer();

//     return compressedBuffer;
//   } catch (error) {
//     console.error("Image compression failed:", error.message);
//     throw error;
//   }
// }

// async function compressPDF(buffer, filename) {
//   const originalSize = buffer.length;
//   const originalSizeMB = (originalSize / 1024 / 1024).toFixed(2);

//   const gsCommand = await getGhostscriptCommand();
//   let compressedBuffer = buffer;

//   if (gsCommand) {
//     // Always compress regardless of initial size
//     compressedBuffer = await compressWithGhostscript(
//       gsCommand,
//       buffer,
//       filename,
//       originalSize
//     );
//   } else {
//     console.log("Ghostscript not available, using fallback compression");
//     compressedBuffer = await compressPDFFallback(buffer, filename);
//   }

//   // If file was originally above 1MB and still above after compression, apply aggressive compression
//   if (
//     originalSize > MAX_PDF_SIZE &&
//     compressedBuffer.length > MAX_PDF_SIZE &&
//     gsCommand
//   ) {
//     console.log(
//       `File still above 1MB after standard compression, applying aggressive compression`
//     );
//     compressedBuffer = await compressAggressively(gsCommand, buffer, filename);
//   }

//   const finalSizeMB = (compressedBuffer.length / 1024 / 1024).toFixed(2);
//   const wasCompressed = compressedBuffer.length < originalSize;

//   if (wasCompressed) {
//     const totalReduction = (
//       ((originalSize - compressedBuffer.length) / originalSize) *
//       100
//     ).toFixed(2);
//     console.log(
//       `Final result: ${originalSizeMB}MB → ${finalSizeMB}MB (${totalReduction}% reduction)`
//     );

//     if (
//       originalSize > MAX_PDF_SIZE &&
//       compressedBuffer.length <= MAX_PDF_SIZE
//     ) {
//       console.log(`Successfully compressed below 1MB target`);
//     } else if (originalSize > MAX_PDF_SIZE) {
//       console.log(
//         `Warning: Could not compress below 1MB. Best achieved: ${finalSizeMB}MB`
//       );
//     }
//   }

//   return compressedBuffer;
// }

// async function compressWithGhostscript(
//   gsCommand,
//   buffer,
//   filename,
//   originalSize
// ) {
//   await ensureTempDir();

//   const timestamp = Date.now();
//   const tempInput = path.join(tempDir, `pdf_input_${timestamp}.pdf`);
//   const tempOutput = path.join(tempDir, `pdf_output_${timestamp}.pdf`);

//   try {
//     const originalSizeMB = (originalSize / 1024 / 1024).toFixed(2);
//     console.log(`Processing PDF: ${filename} (${originalSizeMB}MB)`);

//     await fs.writeFile(tempInput, buffer);

//     // Choose compression level based on original size
//     let command;
//     if (originalSize <= MAX_PDF_SIZE) {
//       // For files already below 1MB, use light compression
//       command = `"${gsCommand}" -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress -dCompatibilityLevel=1.4 -dNOPAUSE -dBATCH -dQUIET -dOptimize=true -sOutputFile="${tempOutput}" "${tempInput}"`;
//     } else {
//       // For files above 1MB, use standard compression
//       command = `"${gsCommand}" -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook -dCompatibilityLevel=1.4 -dNOPAUSE -dBATCH -dQUIET -dDetectDuplicateImages=true -dDownsampleColorImages=true -dColorImageResolution=150 -dDownsampleGrayImages=true -dGrayImageResolution=150 -dDownsampleMonoImages=true -dMonoImageResolution=150 -dOptimize=true -dEmbedAllFonts=false -dSubsetFonts=true -dCompressFonts=true -sOutputFile="${tempOutput}" "${tempInput}"`;
//     }

//     await execPromise(command, {
//       timeout: 60000,
//       maxBuffer: 5 * 1024 * 1024,
//     });

//     const compressedBuffer = await readAndValidateOutput(tempOutput, buffer);
//     return compressedBuffer;
//   } catch (error) {
//     console.error(`Ghostscript compression failed: ${error.message}`);
//     return buffer;
//   } finally {
//     await cleanupFiles([tempInput, tempOutput]);
//   }
// }

// async function compressAggressively(gsCommand, buffer, filename) {
//   await ensureTempDir();

//   const timestamp = Date.now();
//   const tempInput = path.join(tempDir, `pdf_agg_input_${timestamp}.pdf`);
//   const tempOutput = path.join(tempDir, `pdf_agg_output_${timestamp}.pdf`);

//   try {
//     console.log(`Applying aggressive compression to reach below 1MB target`);

//     await fs.writeFile(tempInput, buffer);

//     // Aggressive compression settings for maximum size reduction
//     const aggressiveCommand = `"${gsCommand}" -sDEVICE=pdfwrite -dPDFSETTINGS=/screen -dCompatibilityLevel=1.4 -dNOPAUSE -dBATCH -dQUIET -dDetectDuplicateImages=true -dDownsampleColorImages=true -dColorImageResolution=72 -dDownsampleGrayImages=true -dGrayImageResolution=72 -dDownsampleMonoImages=true -dMonoImageResolution=72 -dOptimize=true -dEmbedAllFonts=false -dSubsetFonts=true -dCompressFonts=true -dAutoRotatePages=/None -dCannotEmbedFontPolicy=/Warning -sOutputFile="${tempOutput}" "${tempInput}"`;

//     await execPromise(aggressiveCommand, {
//       timeout: 60000,
//       maxBuffer: 5 * 1024 * 1024,
//     });

//     let compressedBuffer = await readAndValidateOutput(tempOutput, buffer);

//     // If still too large, try the most aggressive settings
//     if (compressedBuffer.length > MAX_PDF_SIZE) {
//       console.log(`Still above 1MB, applying maximum compression`);
//       compressedBuffer = await compressMaximally(gsCommand, buffer, filename);
//     }

//     return compressedBuffer;
//   } catch (error) {
//     console.error(`Aggressive compression failed: ${error.message}`);
//     return buffer;
//   } finally {
//     await cleanupFiles([tempInput, tempOutput]);
//   }
// }

// async function compressMaximally(gsCommand, buffer, filename) {
//   await ensureTempDir();

//   const timestamp = Date.now();
//   const tempInput = path.join(tempDir, `pdf_max_input_${timestamp}.pdf`);
//   const tempOutput = path.join(tempDir, `pdf_max_output_${timestamp}.pdf`);

//   try {
//     await fs.writeFile(tempInput, buffer);

//     // Maximum compression settings - may significantly reduce quality
//     const maximalCommand = `"${gsCommand}" -sDEVICE=pdfwrite -dPDFSETTINGS=/screen -dCompatibilityLevel=1.4 -dNOPAUSE -dBATCH -dQUIET -dDownsampleColorImages=true -dColorImageResolution=50 -dDownsampleGrayImages=true -dGrayImageResolution=50 -dDownsampleMonoImages=true -dMonoImageResolution=50 -dOptimize=true -dEmbedAllFonts=false -dSubsetFonts=true -dCompressFonts=true -dAutoRotatePages=/None -dConvertCMYKImagesToRGB=true -dUCRandBGInfo=/Remove -sOutputFile="${tempOutput}" "${tempInput}"`;

//     await execPromise(maximalCommand, {
//       timeout: 60000,
//       maxBuffer: 5 * 1024 * 1024,
//     });

//     const compressedBuffer = await readAndValidateOutput(tempOutput, buffer);
//     return compressedBuffer;
//   } catch (error) {
//     console.error(`Maximal compression failed: ${error.message}`);
//     return buffer;
//   } finally {
//     await cleanupFiles([tempInput, tempOutput]);
//   }
// }

// async function readAndValidateOutput(outputPath, originalBuffer) {
//   try {
//     await fs.access(outputPath);
//     const stats = await fs.stat(outputPath);

//     if (stats.size === 0) {
//       throw new Error("Output file is empty");
//     }

//     const compressedBuffer = await fs.readFile(outputPath);

//     // Return the smaller of original or compressed
//     return compressedBuffer.length < originalBuffer.length
//       ? compressedBuffer
//       : originalBuffer;
//   } catch (error) {
//     throw new Error(`Output validation failed: ${error.message}`);
//   }
// }

// async function getGhostscriptCommand() {
//   const possibleCommands = ["gs", "gswin64c", "gswin32c"];

//   for (const cmd of possibleCommands) {
//     try {
//       await execPromise(`"${cmd}" --version`);
//       console.log(`Ghostscript found: ${cmd}`);
//       return cmd;
//     } catch (error) {
//       // Continue to next command
//     }
//   }
//   return null;
// }

// async function compressPDFFallback(buffer, filename) {
//   try {
//     console.log(`Using PDF-lib fallback compression for: ${filename}`);

//     const { PDFDocument } = await import("pdf-lib");
//     const pdfDoc = await PDFDocument.load(buffer);

//     const compressedBytes = await pdfDoc.save({
//       useObjectStreams: true,
//       objectStreams: "generate",
//       compress: true,
//       addDefaultPage: false,
//     });

//     const compressedBuffer = Buffer.from(compressedBytes);

//     // Only return if actually compressed
//     if (compressedBuffer.length < buffer.length) {
//       const ratio = (
//         ((buffer.length - compressedBuffer.length) / buffer.length) *
//         100
//       ).toFixed(2);
//       console.log(`PDF fallback compression: ${ratio}% reduction`);
//       return compressedBuffer;
//     }

//     console.log(`PDF fallback couldn't reduce size, using original`);
//     return buffer;
//   } catch (fallbackError) {
//     console.error(
//       "PDF fallback failed, returning original:",
//       fallbackError.message
//     );
//     return buffer;
//   }
// }

// async function cleanupFiles(filePaths) {
//   const cleanupPromises = filePaths.map(async (filePath) => {
//     try {
//       await fs.unlink(filePath);
//     } catch (error) {
//       // Ignore cleanup errors
//     }
//   });

//   await Promise.allSettled(cleanupPromises);
// }

// async function compressFiles(files) {
//   if (!files || files.length === 0) {
//     return files;
//   }

//   console.log(`Processing ${files.length} files for compression`);

//   const compressedFiles = [];

//   for (const file of files) {
//     try {
//       const result = await compressFile(file);
//       compressedFiles.push({
//         ...file,
//         buffer: result.buffer,
//         size: result.buffer.length,
//         compressed: result.compressed,
//         originalSize: file.originalSize || file.size,
//       });
//     } catch (error) {
//       console.error(
//         `Failed to compress ${file.originalname}, using original:`,
//         error.message
//       );
//       compressedFiles.push({
//         ...file,
//         compressed: false,
//         originalSize: file.originalSize || file.size,
//       });
//     }
//   }

//   return compressedFiles;
// }

// export { compressFile, compressFiles, compressImage, compressPDF };
// export default compressFiles;

// import sharp from "sharp";
// import { exec } from "child_process";
// import util from "util";
// import fs from "fs/promises";
// import path from "path";

// const execPromise = util.promisify(exec);
// const tempDir = "./temp";
// const MAX_PDF_SIZE = 1 * 1024 * 1024; // 1MB target

// // Optimized performance settings
// const MAX_CONCURRENT_COMPRESSION = 8;
// const COMPRESSION_TIMEOUT = 10000;
// const BATCH_DELAY = 30;

// // Cache
// let ghostscriptCommandCache = null;
// let tempDirInitialized = false;

// async function ensureTempDir() {
//   if (!tempDirInitialized) {
//     try {
//       await fs.access(tempDir);
//     } catch {
//       await fs.mkdir(tempDir, { recursive: true });
//     }
//     tempDirInitialized = true;
//   }
// }

// ensureTempDir().catch(console.error);

// async function getGhostscriptCommand() {
//   if (ghostscriptCommandCache !== null) {
//     return ghostscriptCommandCache;
//   }

//   const possibleCommands = ["gs", "gswin64c", "gswin32c"];
//   for (const cmd of possibleCommands) {
//     try {
//       await execPromise(`"${cmd}" --version`);
//       ghostscriptCommandCache = cmd;
//       return cmd;
//     } catch (error) {
//       // Continue
//     }
//   }
//   return null;
// }

// async function compressFile(file) {
//   const { buffer, originalname, mimetype, originalSize } = file;

//   try {
//     console.log(
//       `Compressing: ${originalname}, Size: ${(
//         (originalSize || buffer.length) /
//         1024 /
//         1024
//       ).toFixed(2)}MB`
//     );

//     let compressedBuffer;
//     if (mimetype.startsWith("image/")) {
//       compressedBuffer = await compressImage(buffer, originalname);
//     } else if (mimetype === "application/pdf") {
//       compressedBuffer = await compressPDF(buffer, originalname);
//     } else {
//       console.log(`Skipping compression for ${mimetype}`);
//       return { buffer, compressed: false };
//     }

//     const originalSizeValue = originalSize || buffer.length;
//     const compressionRatio = (
//       ((originalSizeValue - compressedBuffer.length) / originalSizeValue) *
//       100
//     ).toFixed(2);

//     console.log(`Compressed: ${originalname} - ${compressionRatio}% reduction`);

//     return { buffer: compressedBuffer, compressed: true };
//   } catch (error) {
//     console.error(`Compression failed for ${originalname}:`, error.message);
//     return { buffer, compressed: false };
//   }
// }

// async function compressImage(buffer, filename) {
//   return await sharp(buffer, {
//     limitInputPixels: false,
//     sequentialRead: true,
//   })
//     .resize(1920, 1920, {
//       fit: "inside",
//       withoutEnlargement: true,
//       fastShrinkOnLoad: true,
//     })
//     .jpeg({ quality: 80, mozjpeg: true })
//     .png({ quality: 80, compressionLevel: 9 })
//     .toBuffer();
// }

// async function compressPDF(buffer, filename) {
//   const originalSize = buffer.length;
//   const originalSizeMB = (originalSize / 1024 / 1024).toFixed(2);

//   const gsCommand = await getGhostscriptCommand();
//   if (!gsCommand) {
//     console.log("Ghostscript not available, using fallback");
//     return await compressPDFFallback(buffer, filename);
//   }

//   console.log(`Compressing PDF: ${filename} (${originalSizeMB}MB)`);

//   // ALWAYS do initial compression for ALL files (even below 1MB)
//   let compressedBuffer = await compressPDFInitial(gsCommand, buffer, filename);

//   // If originally above 1MB and still above after initial compression, apply additional compression
//   if (originalSize > MAX_PDF_SIZE && compressedBuffer.length > MAX_PDF_SIZE) {
//     console.log(
//       `Still above 1MB after initial compression, applying aggressive compression`
//     );
//     compressedBuffer = await compressPDFAggressive(gsCommand, buffer, filename);
//   }

//   const finalSizeMB = (compressedBuffer.length / 1024 / 1024).toFixed(2);
//   const wasCompressed = compressedBuffer.length < originalSize;

//   if (wasCompressed) {
//     const totalReduction = (
//       ((originalSize - compressedBuffer.length) / originalSize) *
//       100
//     ).toFixed(2);
//     console.log(
//       `PDF result: ${originalSizeMB}MB → ${finalSizeMB}MB (${totalReduction}% reduction)`
//     );

//     if (compressedBuffer.length <= MAX_PDF_SIZE) {
//       console.log(`Successfully compressed below 1MB target`);
//     }
//   } else {
//     console.log(`No significant compression achieved for ${filename}`);
//   }

//   return compressedBuffer;
// }

// async function compressPDFInitial(gsCommand, buffer, filename) {
//   await ensureTempDir();

//   const timestamp = Date.now();
//   const randomSuffix = Math.random().toString(36).substring(7);
//   const tempInput = path.join(tempDir, `init_${timestamp}_${randomSuffix}.pdf`);
//   const tempOutput = path.join(
//     tempDir,
//     `init_${timestamp}_${randomSuffix}_out.pdf`
//   );

//   try {
//     await fs.writeFile(tempInput, buffer);

//     // Light compression for ALL files - maintains quality while reducing size
//     const command = `"${gsCommand}" -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress -dCompatibilityLevel=1.4 -dNOPAUSE -dBATCH -dQUIET -dOptimize=true -dEmbedAllFonts=true -dSubsetFonts=true -sOutputFile="${tempOutput}" "${tempInput}"`;

//     await execPromise(command, {
//       timeout: COMPRESSION_TIMEOUT,
//       maxBuffer: 3 * 1024 * 1024, // 3MB max output from Ghostscript
//     });

//     const compressedBuffer = await readOutput(tempOutput);
//     return compressedBuffer.length < buffer.length ? compressedBuffer : buffer;
//   } catch (error) {
//     console.error(`Initial compression failed: ${error.message}`);
//     return buffer;
//   } finally {
//     cleanupFiles([tempInput, tempOutput]).catch(() => {});
//   }
// }

// async function compressPDFAggressive(gsCommand, buffer, filename) {
//   await ensureTempDir();

//   const timestamp = Date.now();
//   const randomSuffix = Math.random().toString(36).substring(7);
//   const tempInput = path.join(tempDir, `agg_${timestamp}_${randomSuffix}.pdf`);
//   const tempOutput = path.join(
//     tempDir,
//     `agg_${timestamp}_${randomSuffix}_out.pdf`
//   );

//   try {
//     await fs.writeFile(tempInput, buffer);

//     // Aggressive compression for files still above 1MB
//     const command = `"${gsCommand}" -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook -dNOPAUSE -dBATCH -dQUIET -dColorImageResolution=150 -dGrayImageResolution=150 -dOptimize=true -dEmbedAllFonts=false -sOutputFile="${tempOutput}" "${tempInput}"`;

//     await execPromise(command, {
//       timeout: COMPRESSION_TIMEOUT,
//       maxBuffer: 3 * 1024 * 1024, // 3MB max output from Ghostscript
//     });

//     const compressedBuffer = await readOutput(tempOutput);

//     // If still above 1MB, try maximum compression
//     if (
//       compressedBuffer.length > MAX_PDF_SIZE &&
//       compressedBuffer.length < buffer.length
//     ) {
//       console.log(`Still above 1MB, applying maximum compression`);
//       return await compressPDFMaximum(gsCommand, buffer, filename);
//     }

//     return compressedBuffer.length < buffer.length ? compressedBuffer : buffer;
//   } catch (error) {
//     console.error(`Aggressive compression failed: ${error.message}`);
//     return buffer;
//   } finally {
//     cleanupFiles([tempInput, tempOutput]).catch(() => {});
//   }
// }

// async function compressPDFMaximum(gsCommand, buffer, filename) {
//   await ensureTempDir();

//   const timestamp = Date.now();
//   const randomSuffix = Math.random().toString(36).substring(7);
//   const tempInput = path.join(tempDir, `max_${timestamp}_${randomSuffix}.pdf`);
//   const tempOutput = path.join(
//     tempDir,
//     `max_${timestamp}_${randomSuffix}_out.pdf`
//   );

//   try {
//     await fs.writeFile(tempInput, buffer);

//     // Maximum compression for stubborn files
//     const command = `"${gsCommand}" -sDEVICE=pdfwrite -dPDFSETTINGS=/screen -dNOPAUSE -dBATCH -dQUIET -dColorImageResolution=100 -dGrayImageResolution=100 -dOptimize=true -sOutputFile="${tempOutput}" "${tempInput}"`;

//     await execPromise(command, {
//       timeout: COMPRESSION_TIMEOUT,
//       maxBuffer: 3 * 1024 * 1024, // 3MB max output from Ghostscript
//     });

//     const compressedBuffer = await readOutput(tempOutput);
//     return compressedBuffer.length < buffer.length ? compressedBuffer : buffer;
//   } catch (error) {
//     console.error(`Maximum compression failed: ${error.message}`);
//     return buffer;
//   } finally {
//     cleanupFiles([tempInput, tempOutput]).catch(() => {});
//   }
// }

// async function compressPDFFallback(buffer, filename) {
//   try {
//     console.log(`Using PDF-lib fallback compression`);
//     const { PDFDocument } = await import("pdf-lib");
//     const pdfDoc = await PDFDocument.load(buffer);

//     const compressedBytes = await pdfDoc.save({
//       useObjectStreams: true,
//       objectStreams: "generate",
//       compress: true,
//       addDefaultPage: false,
//     });

//     const compressedBuffer = Buffer.from(compressedBytes);

//     if (compressedBuffer.length < buffer.length) {
//       const ratio = (
//         ((buffer.length - compressedBuffer.length) / buffer.length) *
//         100
//       ).toFixed(2);
//       console.log(`PDF fallback: ${ratio}% reduction`);
//       return compressedBuffer;
//     }

//     return buffer;
//   } catch (fallbackError) {
//     console.error("PDF fallback failed:", fallbackError.message);
//     return buffer;
//   }
// }

// async function readOutput(outputPath) {
//   try {
//     await fs.access(outputPath);
//     return await fs.readFile(outputPath);
//   } catch (error) {
//     throw new Error("Output file missing");
//   }
// }

// async function cleanupFiles(filePaths) {
//   await Promise.allSettled(
//     filePaths.map((filePath) => fs.unlink(filePath).catch(() => {}))
//   );
// }

// async function compressFiles(files) {
//   if (!files?.length) return files;

//   console.log(`Starting compression of ${files.length} files`);
//   const startTime = Date.now();
//   const compressedFiles = [];

//   // Process files in optimized batches
//   for (let i = 0; i < files.length; i += MAX_CONCURRENT_COMPRESSION) {
//     const batch = files.slice(i, i + MAX_CONCURRENT_COMPRESSION);
//     console.log(
//       `Processing batch ${Math.floor(i / MAX_CONCURRENT_COMPRESSION) + 1}: ${
//         batch.length
//       } files`
//     );

//     const batchPromises = batch.map(async (file) => {
//       try {
//         const result = await compressFile(file);
//         return {
//           ...file,
//           buffer: result.buffer,
//           size: result.buffer.length,
//           compressed: result.compressed,
//           originalSize: file.originalSize || file.size,
//         };
//       } catch (error) {
//         console.error(
//           `Failed to compress ${file.originalname}:`,
//           error.message
//         );
//         return {
//           ...file,
//           compressed: false,
//           originalSize: file.originalSize || file.size,
//         };
//       }
//     });

//     const batchResults = await Promise.allSettled(batchPromises);

//     for (const result of batchResults) {
//       if (result.status === "fulfilled") {
//         compressedFiles.push(result.value);
//       }
//     }

//     // Minimal delay between batches
//     if (i + MAX_CONCURRENT_COMPRESSION < files.length) {
//       await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
//     }
//   }

//   const totalTime = (Date.now() - startTime) / 1000;
//   console.log(
//     `Compression completed: ${
//       compressedFiles.length
//     } files in ${totalTime.toFixed(1)} seconds`
//   );

//   return compressedFiles;
// }

// export { compressFile, compressFiles };
// export default compressFiles;

// import sharp from "sharp";
// import { exec } from "child_process";
// import util from "util";

// const execPromise = util.promisify(exec);
// const MAX_PDF_SIZE = 1 * 1024 * 1024; // 1MB target

// // Optimized performance settings
// const MAX_CONCURRENT_COMPRESSION = 8;
// const COMPRESSION_TIMEOUT = 30000; // Increased timeout for memory processing

// // Cache
// let ghostscriptCommandCache = null;

// async function getGhostscriptCommand() {
//   if (ghostscriptCommandCache !== null) {
//     return ghostscriptCommandCache;
//   }

//   const possibleCommands = ["gs", "gswin64c", "gswin32c"];
//   for (const cmd of possibleCommands) {
//     try {
//       await execPromise(`"${cmd}" --version`);
//       ghostscriptCommandCache = cmd;
//       return cmd;
//     } catch (error) {
//       // Continue
//     }
//   }
//   return null;
// }

// async function compressFile(file) {
//   const { buffer, originalname, mimetype, originalSize } = file;

//   try {
//     console.log(
//       `Compressing: ${originalname}, Size: ${(
//         (originalSize || buffer.length) /
//         1024 /
//         1024
//       ).toFixed(2)}MB`
//     );

//     let compressedBuffer;
//     if (mimetype.startsWith("image/")) {
//       compressedBuffer = await compressImage(buffer, originalname);
//     } else if (mimetype === "application/pdf") {
//       compressedBuffer = await compressPDF(buffer, originalname);
//     } else {
//       console.log(`Skipping compression for ${mimetype}`);
//       return { buffer, compressed: false };
//     }

//     const originalSizeValue = originalSize || buffer.length;
//     const compressionRatio = (
//       ((originalSizeValue - compressedBuffer.length) / originalSizeValue) *
//       100
//     ).toFixed(2);

//     console.log(`Compressed: ${originalname} - ${compressionRatio}% reduction`);

//     return { buffer: compressedBuffer, compressed: true };
//   } catch (error) {
//     console.error(`Compression failed for ${originalname}:`, error.message);
//     return { buffer, compressed: false };
//   }
// }

// async function compressImage(buffer, filename) {
//   return await sharp(buffer, {
//     limitInputPixels: false,
//     sequentialRead: true,
//   })
//     .resize(1920, 1920, {
//       fit: "inside",
//       withoutEnlargement: true,
//       fastShrinkOnLoad: true,
//     })
//     .jpeg({ quality: 80, mozjpeg: true })
//     .png({ quality: 80, compressionLevel: 9 })
//     .toBuffer();
// }

// async function compressPDF(buffer, filename) {
//   const originalSize = buffer.length;
//   const originalSizeMB = (originalSize / 1024 / 1024).toFixed(2);

//   const gsCommand = await getGhostscriptCommand();
//   if (!gsCommand) {
//     console.log("Ghostscript not available, using fallback");
//     return await compressPDFFallback(buffer, filename);
//   }

//   console.log(`Compressing PDF: ${filename} (${originalSizeMB}MB)`);

//   // ALWAYS do initial compression for ALL files (even below 1MB) - using memory
//   let compressedBuffer = await compressPDFWithStdio(
//     gsCommand,
//     buffer,
//     "prepress"
//   );

//   // If originally above 1MB and still above after initial compression, apply additional compression
//   if (originalSize > MAX_PDF_SIZE && compressedBuffer.length > MAX_PDF_SIZE) {
//     console.log(
//       `Still above 1MB after initial compression, applying aggressive compression`
//     );
//     compressedBuffer = await compressPDFWithStdio(gsCommand, buffer, "ebook");
//   }

//   // If still above, try maximum compression
//   if (originalSize > MAX_PDF_SIZE && compressedBuffer.length > MAX_PDF_SIZE) {
//     console.log(`Still above 1MB, applying maximum compression`);
//     compressedBuffer = await compressPDFWithStdio(gsCommand, buffer, "screen");
//   }

//   const finalSizeMB = (compressedBuffer.length / 1024 / 1024).toFixed(2);
//   const wasCompressed = compressedBuffer.length < originalSize;

//   if (wasCompressed) {
//     const totalReduction = (
//       ((originalSize - compressedBuffer.length) / originalSize) *
//       100
//     ).toFixed(2);
//     console.log(
//       `PDF result: ${originalSizeMB}MB → ${finalSizeMB}MB (${totalReduction}% reduction)`
//     );

//     if (compressedBuffer.length <= MAX_PDF_SIZE) {
//       console.log(`Successfully compressed below 1MB target`);
//     }
//   } else {
//     console.log(`No significant compression achieved for ${filename}`);
//   }

//   return compressedBuffer;
// }

// // NEW FUNCTION: Process PDF entirely in memory using stdin/stdout
// async function compressPDFWithStdio(gsCommand, buffer, quality) {
//   const settings = {
//     prepress: {
//       args: "-dPDFSETTINGS=/prepress -dCompatibilityLevel=1.4 -dOptimize=true -dEmbedAllFonts=true -dSubsetFonts=true",
//       timeout: 15000,
//     },
//     ebook: {
//       args: "-dPDFSETTINGS=/ebook -dColorImageResolution=150 -dGrayImageResolution=150 -dOptimize=true -dEmbedAllFonts=false",
//       timeout: 20000,
//     },
//     screen: {
//       args: "-dPDFSETTINGS=/screen -dColorImageResolution=100 -dGrayImageResolution=100 -dOptimize=true",
//       timeout: 25000,
//     },
//   };

//   const config = settings[quality] || settings.prepress;

//   // The key change: use stdin/stdout instead of temp files
//   const command = `"${gsCommand}" -sDEVICE=pdfwrite ${config.args} -dNOPAUSE -dBATCH -dQUIET -sOutputFile=- -`;

//   try {
//     const { stdout, stderr } = await execPromise(command, {
//       timeout: config.timeout,
//       maxBuffer: 10 * 1024 * 1024, // 10MB max output buffer
//       encoding: "buffer", // This is crucial for binary PDF data
//       input: buffer, // Pass the PDF buffer as stdin to Ghostscript
//     });

//     if (stderr) {
//       console.warn(`Ghostscript stderr: ${stderr}`);
//     }

//     // Return the compressed buffer directly from stdout
//     // If compression failed or produced empty output, return original buffer
//     if (!stdout || stdout.length === 0) {
//       console.warn(`Ghostscript produced empty output, using original file`);
//       return buffer;
//     }

//     return Buffer.from(stdout);
//   } catch (error) {
//     console.error(
//       `Ghostscript compression failed (${quality}): ${error.message}`
//     );
//     // Return original buffer if compression fails
//     return buffer;
//   }
// }

// // REMOVED: All temp file functions (compressPDFInitial, compressPDFAggressive, compressPDFMaximum)
// // REMOVED: ensureTempDir, readOutput, cleanupFiles functions

// async function compressPDFFallback(buffer, filename) {
//   try {
//     console.log(`Using PDF-lib fallback compression`);
//     const { PDFDocument } = await import("pdf-lib");
//     const pdfDoc = await PDFDocument.load(buffer);

//     const compressedBytes = await pdfDoc.save({
//       useObjectStreams: true,
//       objectStreams: "generate",
//       compress: true,
//       addDefaultPage: false,
//     });

//     const compressedBuffer = Buffer.from(compressedBytes);

//     if (compressedBuffer.length < buffer.length) {
//       const ratio = (
//         ((buffer.length - compressedBuffer.length) / buffer.length) *
//         100
//       ).toFixed(2);
//       console.log(`PDF fallback: ${ratio}% reduction`);
//       return compressedBuffer;
//     }

//     return buffer;
//   } catch (fallbackError) {
//     console.error("PDF fallback failed:", fallbackError.message);
//     return buffer;
//   }
// }

// async function compressFiles(files) {
//   if (!files?.length) return files;

//   console.log(`Starting compression of ${files.length} files`);
//   const startTime = Date.now();
//   const compressedFiles = [];

//   // Process files in optimized batches
//   for (let i = 0; i < files.length; i += MAX_CONCURRENT_COMPRESSION) {
//     const batch = files.slice(i, i + MAX_CONCURRENT_COMPRESSION);
//     console.log(
//       `Processing batch ${Math.floor(i / MAX_CONCURRENT_COMPRESSION) + 1}: ${
//         batch.length
//       } files`
//     );

//     const batchPromises = batch.map(async (file) => {
//       try {
//         const result = await compressFile(file);
//         return {
//           ...file,
//           buffer: result.buffer,
//           size: result.buffer.length,
//           compressed: result.compressed,
//           originalSize: file.originalSize || file.size,
//         };
//       } catch (error) {
//         console.error(
//           `Failed to compress ${file.originalname}:`,
//           error.message
//         );
//         return {
//           ...file,
//           compressed: false,
//           originalSize: file.originalSize || file.size,
//         };
//       }
//     });

//     const batchResults = await Promise.allSettled(batchPromises);

//     for (const result of batchResults) {
//       if (result.status === "fulfilled") {
//         compressedFiles.push(result.value);
//       }
//     }

//     // Minimal delay between batches to prevent overloading
//     if (i + MAX_CONCURRENT_COMPRESSION < files.length) {
//       await new Promise((resolve) => setTimeout(resolve, 30));
//     }
//   }

//   const totalTime = (Date.now() - startTime) / 1000;
//   console.log(
//     `Compression completed: ${
//       compressedFiles.length
//     } files in ${totalTime.toFixed(1)} seconds`
//   );

//   return compressedFiles;
// }

// export { compressFile, compressFiles };
// export default compressFiles;

// import sharp from "sharp";
// import { exec } from "child_process";
// import util from "util";

// const execPromise = util.promisify(exec);
// const MAX_PDF_SIZE = 1 * 1024 * 1024; // 1MB target

// // Performance settings
// const MAX_CONCURRENT_COMPRESSION = 4;
// const COMPRESSION_TIMEOUT = 30000;

// // Cache
// let ghostscriptCommandCache = null;

// async function getGhostscriptCommand() {
//   if (ghostscriptCommandCache !== null) {
//     return ghostscriptCommandCache;
//   }

//   const possibleCommands = ["gs", "gswin64c", "gswin32c"];
//   for (const cmd of possibleCommands) {
//     try {
//       await execPromise(`"${cmd}" --version`);
//       console.log(`Ghostscript found: ${cmd}`);
//       ghostscriptCommandCache = cmd;
//       return cmd;
//     } catch (error) {
//       console.log(`Ghostscript not found: ${cmd}`);
//     }
//   }
//   return null;
// }

// async function compressFile(file) {
//   const { buffer, originalname, mimetype, originalSize } = file;

//   try {
//     console.log(
//       `Compressing: ${originalname}, Size: ${(
//         (originalSize || buffer.length) /
//         1024 /
//         1024
//       ).toFixed(2)}MB`
//     );

//     let compressedBuffer;
//     if (mimetype.startsWith("image/")) {
//       compressedBuffer = await compressImage(buffer);
//     } else if (mimetype === "application/pdf") {
//       compressedBuffer = await compressPDF(buffer, originalname);
//     } else {
//       console.log(`Skipping compression for ${mimetype}`);
//       return { buffer, compressed: false };
//     }

//     const originalSizeValue = originalSize || buffer.length;
//     const compressionRatio = (
//       ((originalSizeValue - compressedBuffer.length) / originalSizeValue) *
//       100
//     ).toFixed(2);

//     console.log(`Compressed: ${originalname} - ${compressionRatio}% reduction`);
//     return { buffer: compressedBuffer, compressed: true };
//   } catch (error) {
//     console.error(`Compression failed for ${originalname}:`, error.message);
//     return { buffer, compressed: false };
//   }
// }

// async function compressImage(buffer) {
//   return await sharp(buffer, {
//     limitInputPixels: false,
//     sequentialRead: true,
//   })
//     .resize(1920, 1920, {
//       fit: "inside",
//       withoutEnlargement: true,
//       fastShrinkOnLoad: true,
//     })
//     .jpeg({ quality: 80, mozjpeg: true })
//     .png({ quality: 80, compressionLevel: 9 })
//     .toBuffer();
// }

// async function compressPDF(buffer, filename) {
//   const originalSize = buffer.length;
//   const originalSizeMB = (originalSize / 1024 / 1024).toFixed(2);

//   // Skip if already below 1MB
//   if (originalSize <= MAX_PDF_SIZE) {
//     console.log(
//       `PDF already below 1MB (${originalSizeMB}MB), skipping compression`
//     );
//     return buffer;
//   }

//   const gsCommand = await getGhostscriptCommand();
//   if (!gsCommand) {
//     console.log("Ghostscript not available, using fallback");
//     return await compressPDFFallback(buffer, filename);
//   }

//   console.log(`Compressing PDF: ${filename} (${originalSizeMB}MB)`);

//   // Try memory-based compression first
//   let compressedBuffer = await compressPDFInMemory(
//     gsCommand,
//     buffer,
//     "standard"
//   );

//   // If still above 1MB and we got some compression, try aggressive
//   if (
//     originalSize > MAX_PDF_SIZE &&
//     compressedBuffer.length > MAX_PDF_SIZE &&
//     compressedBuffer.length < originalSize
//   ) {
//     console.log(`Still above 1MB, trying aggressive compression`);
//     compressedBuffer = await compressPDFInMemory(
//       gsCommand,
//       buffer,
//       "aggressive"
//     );
//   }

//   const finalSizeMB = (compressedBuffer.length / 1024 / 1024).toFixed(2);
//   const wasCompressed = compressedBuffer.length < originalSize;

//   if (wasCompressed) {
//     const totalReduction = (
//       ((originalSize - compressedBuffer.length) / originalSize) *
//       100
//     ).toFixed(2);
//     console.log(
//       `PDF result: ${originalSizeMB}MB → ${finalSizeMB}MB (${totalReduction}% reduction)`
//     );

//     if (compressedBuffer.length <= MAX_PDF_SIZE) {
//       console.log(`Successfully compressed below 1MB target`);
//     }
//   } else {
//     console.log(`No compression achieved for ${filename}`);
//   }

//   return compressedBuffer;
// }

// async function compressPDFInMemory(gsCommand, buffer, mode) {
//   const settings = {
//     standard: {
//       args: "-dPDFSETTINGS=/ebook -dCompatibilityLevel=1.4 -dDetectDuplicateImages=true -dColorImageResolution=150 -dGrayImageResolution=150 -dOptimize=true -dEmbedAllFonts=false",
//       timeout: 20000,
//     },
//     aggressive: {
//       args: "-dPDFSETTINGS=/screen -dCompatibilityLevel=1.4 -dColorImageResolution=100 -dGrayImageResolution=100 -dOptimize=true -dEmbedAllFonts=false",
//       timeout: 25000,
//     },
//   };

//   const config = settings[mode] || settings.standard;

//   try {
//     // Use echo to pipe the buffer to Ghostscript (Linux/Mac)
//     const command = `echo "${buffer.toString(
//       "base64"
//     )}" | base64 --decode | "${gsCommand}" -sDEVICE=pdfwrite ${
//       config.args
//     } -dNOPAUSE -dBATCH -dQUIET -sOutputFile=- -`;

//     const { stdout, stderr } = await execPromise(command, {
//       timeout: config.timeout,
//       maxBuffer: 10 * 1024 * 1024, // 10MB max output
//       encoding: "buffer",
//     });

//     if (stderr) {
//       console.warn(`Ghostscript stderr: ${stderr}`);
//     }

//     // Validate output
//     if (!stdout || stdout.length === 0) {
//       console.warn(`Ghostscript produced empty output for ${mode} compression`);
//       return buffer;
//     }

//     // Only return if actually smaller
//     return stdout.length < buffer.length ? stdout : buffer;
//   } catch (error) {
//     console.error(`Memory compression failed (${mode}):`, error.message);

//     // Fallback to simpler command without base64
//     return await compressPDFSimple(gsCommand, buffer, mode);
//   }
// }

// // Fallback method for Windows or when base64 fails
// async function compressPDFSimple(gsCommand, buffer, mode) {
//   const settings = {
//     standard: {
//       args: "-dPDFSETTINGS=/ebook -dNOPAUSE -dBATCH -dQUIET",
//       timeout: 20000,
//     },
//     aggressive: {
//       args: "-dPDFSETTINGS=/screen -dNOPAUSE -dBATCH -dQUIET",
//       timeout: 25000,
//     },
//   };

//   const config = settings[mode] || settings.standard;

//   try {
//     // Simple approach - might work on some systems
//     const command = `"${gsCommand}" -sDEVICE=pdfwrite ${config.args} -sOutputFile=- -`;

//     const { stdout, stderr } = await execPromise(command, {
//       timeout: config.timeout,
//       maxBuffer: 10 * 1024 * 1024,
//       encoding: "buffer",
//       input: buffer, // Pass buffer as stdin
//     });

//     if (stderr) {
//       console.warn(`Ghostscript stderr: ${stderr}`);
//     }

//     if (!stdout || stdout.length === 0) {
//       console.warn(`Simple compression produced empty output`);
//       return buffer;
//     }

//     return stdout.length < buffer.length ? stdout : buffer;
//   } catch (error) {
//     console.error(`Simple compression also failed (${mode}):`, error.message);
//     return buffer;
//   }
// }

// async function compressPDFFallback(buffer, filename) {
//   try {
//     console.log(`Using PDF-lib fallback compression`);
//     const { PDFDocument } = await import("pdf-lib");
//     const pdfDoc = await PDFDocument.load(buffer);

//     const compressedBytes = await pdfDoc.save({
//       useObjectStreams: true,
//       objectStreams: "generate",
//       compress: true,
//       addDefaultPage: false,
//     });

//     const compressedBuffer = Buffer.from(compressedBytes);

//     if (compressedBuffer.length < buffer.length) {
//       const ratio = (
//         ((buffer.length - compressedBuffer.length) / buffer.length) *
//         100
//       ).toFixed(2);
//       console.log(`PDF fallback: ${ratio}% reduction`);
//       return compressedBuffer;
//     }

//     return buffer;
//   } catch (fallbackError) {
//     console.error("PDF fallback failed:", fallbackError.message);
//     return buffer;
//   }
// }

// async function compressFiles(files) {
//   if (!files?.length) return files;

//   console.log(`Starting compression of ${files.length} files (memory-only)`);
//   const startTime = Date.now();
//   const compressedFiles = [];

//   // Process files in batches
//   for (let i = 0; i < files.length; i += MAX_CONCURRENT_COMPRESSION) {
//     const batch = files.slice(i, i + MAX_CONCURRENT_COMPRESSION);
//     console.log(
//       `Processing batch ${Math.floor(i / MAX_CONCURRENT_COMPRESSION) + 1}: ${
//         batch.length
//       } files`
//     );

//     const batchPromises = batch.map(async (file) => {
//       try {
//         const result = await compressFile(file);
//         return {
//           ...file,
//           buffer: result.buffer,
//           size: result.buffer.length,
//           compressed: result.compressed,
//           originalSize: file.originalSize || file.size,
//         };
//       } catch (error) {
//         console.error(
//           `Failed to compress ${file.originalname}:`,
//           error.message
//         );
//         return {
//           ...file,
//           compressed: false,
//           originalSize: file.originalSize || file.size,
//         };
//       }
//     });

//     const batchResults = await Promise.allSettled(batchPromises);

//     for (const result of batchResults) {
//       if (result.status === "fulfilled") {
//         compressedFiles.push(result.value);
//       }
//     }

//     // Small delay between batches
//     if (i + MAX_CONCURRENT_COMPRESSION < files.length) {
//       await new Promise((resolve) => setTimeout(resolve, 100));
//     }
//   }

//   const totalTime = (Date.now() - startTime) / 1000;
//   console.log(
//     `Compression completed: ${
//       compressedFiles.length
//     } files in ${totalTime.toFixed(1)} seconds`
//   );

//   return compressedFiles;
// }

// export { compressFile, compressFiles };
// export default compressFiles;

// compressionServices.js

import sharp from "sharp";
import { exec } from "child_process";
import util from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

// IMPORTANT: Install pdf-lib for the enhanced compression fallback
// npm install pdf-lib

const execPromise = util.promisify(exec);
const MAX_PDF_SIZE = 1 * 1024 * 1024; // 1MB target

// Performance settings
const MAX_CONCURRENT_COMPRESSION = Math.min(os.cpus().length * 2, 12);
// Increased timeout and buffer to handle large PDFs more reliably
const COMPRESSION_TIMEOUT = 60000; // 30 seconds
const MAX_EXEC_BUFFER = 40 * 1024 * 1024; // 40MB buffer

// Cache
let ghostscriptCommandCache = null;
let pdfLib = null;

// --- Utility Functions ---

async function getGhostscriptCommand() {
  if (ghostscriptCommandCache !== null) {
    return ghostscriptCommandCache;
  }

  const possibleCommands = ["gs", "gswin64c", "gswin32c"];
  for (const cmd of possibleCommands) {
    try {
      // Test execution and capture stdout for version, ensures it's runnable
      const { stdout } = await execPromise(`"${cmd}" --version`, {
        timeout: 3000,
      });
      console.log(
        `✅ Ghostscript found: ${cmd} (Version check: ${
          stdout.trim().split("\n")[0]
        })`
      );
      ghostscriptCommandCache = cmd;
      return cmd;
    } catch (error) {
      // Continue search
    }
  }
  console.log(
    "❌ Ghostscript not found in system PATH. PDF compression will rely on PDF-lib fallback."
  );
  return null;
}

async function getPdfLib() {
  if (pdfLib === null) {
    try {
      pdfLib = await import("pdf-lib");
    } catch (e) {
      console.error(
        "❌ PDF-lib failed to load. Make sure it's installed. Error:",
        e.message
      );
      pdfLib = { PDFDocument: null }; // Set an empty object to prevent repeated load attempts
    }
  }
  return pdfLib;
}

// --- Compression Core Functions ---

async function compressFile(file) {
  const { buffer, originalname, mimetype, originalSize } = file;

  try {
    const sizeMB = ((originalSize || buffer.length) / 1024 / 1024).toFixed(2);
    console.log(`Compressing: ${originalname}, Size: ${sizeMB}MB`);

    let compressedBuffer;
    if (mimetype.startsWith("image/")) {
      compressedBuffer = await compressImage(buffer);
    } else if (mimetype === "application/pdf") {
      compressedBuffer = await compressPDF(buffer, originalname);
    } else {
      console.log(`Skipping compression for ${mimetype}`);
      return { buffer, compressed: false };
    }

    const originalSizeValue = originalSize || buffer.length;
    const compressionRatio = (
      ((originalSizeValue - compressedBuffer.length) / originalSizeValue) *
      100
    ).toFixed(2);

    console.log(`Compressed: ${originalname} - ${compressionRatio}% reduction`);
    return { buffer: compressedBuffer, compressed: true };
  } catch (error) {
    console.error(`Compression failed for ${originalname}:`, error.message);
    return { buffer, compressed: false };
  }
}

async function compressImage(buffer) {
  return await sharp(buffer, {
    limitInputPixels: false,
    sequentialRead: true,
  })
    .resize(1920, 1920, {
      fit: "inside",
      withoutEnlargement: true,
      fastShrinkOnLoad: true,
    })
    // Use quality 80 for both JPEG and PNG for a good balance
    .jpeg({ quality: 80, mozjpeg: true })
    .png({ quality: 80, compressionLevel: 9 })
    .toBuffer();
}

async function compressPDF(buffer, filename) {
  const originalSize = buffer.length;
  const originalSizeMB = (originalSize / 1024 / 1024).toFixed(2);

  if (originalSize <= MAX_PDF_SIZE) {
    console.log(
      `PDF already below 1MB (${originalSizeMB}MB), skipping compression`
    );
    // return await compressPDFEnhanced(buffer, filename);
    return buffer;
  }

  console.log(`Compressing PDF: ${filename} (${originalSizeMB}MB)`);

  let bestBuffer = buffer;
  let currentBestSize = originalSize;

  // --- 1. Primary: Lossy Ghostscript Compression ---
  // let gsResult = await tryGhostscriptCompression(buffer, filename, "/ebook");
  // if (process.env.DEBUG_GS && gsResult.length >= buffer.length) {
  //   console.log(
  //     `Retrying Ghostscript compression with /screen for ${filename}`
  //   );
  //   gsResult = await tryGhostscriptCompression(buffer, filename, "/screen");
  // }
  // if (gsResult.length < currentBestSize) {
  //   bestBuffer = gsResult;
  //   currentBestSize = gsResult.length;
  //   console.log(
  //     `Ghostscript (/ebook) achieved ${(
  //       ((originalSize - currentBestSize) / originalSize) *
  //       100
  //     ).toFixed(2)}% reduction.`
  //   );
  // }

  // --- 2. Fallback: Structural PDF-lib Optimization ---
  const pdfLibResult = await compressPDFEnhanced(buffer, filename);
  if (pdfLibResult.length < currentBestSize) {
    bestBuffer = pdfLibResult;
    currentBestSize = pdfLibResult.length;
    console.log(
      `PDF-lib Optimization achieved ${(
        ((originalSize - currentBestSize) / originalSize) *
        100
      ).toFixed(2)}% reduction.`
    );
  }

  const finalSizeMB = (currentBestSize / 1024 / 1024).toFixed(2);
  const wasCompressed = currentBestSize < originalSize;

  if (wasCompressed) {
    const totalReduction = (
      ((originalSize - currentBestSize) / originalSize) *
      100
    ).toFixed(2);
    console.log(
      `Final PDF Result: ${originalSizeMB}MB → ${finalSizeMB}MB (${totalReduction}% reduction)`
    );
  } else {
    console.log(`No significant compression achieved for ${filename}`);
  }

  return bestBuffer;
}

// Separate function to handle the Ghostscript call logic
async function tryGhostscriptCompression(buffer, filename, setting) {
  const gsCommand = await getGhostscriptCommand();
  if (!gsCommand) return buffer;

  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  // Use unique, safe temporary file names (NO original filename characters)
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const tempInput = path.join(tempDir, `in_${timestamp}_${randomSuffix}.pdf`);
  const tempOutput = path.join(tempDir, `out_${timestamp}_${randomSuffix}.pdf`);

  try {
    await fs.writeFile(tempInput, buffer);
    const header = buffer.toString("utf8", 0, 1024);
    if (header.includes("/Encrypt")) {
      console.log(
        `Skipping Ghostscript: Encrypted or restricted PDF (${filename})`
      );
      return buffer;
    }

    // Ghostscript command with the specified setting
    // const command = `"${gsCommand}" -sDEVICE=pdfwrite -dPDFSETTINGS=${setting} -dNOPAUSE -dBATCH -dQUIET -sOutputFile="${tempOutput}" "${tempInput}"`;
    // Safer for Windows path quoting
    // const command = `"${gsCommand}" -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dNOPAUSE -dQUIET -dBATCH -dDetectDuplicateImages=true -dCompressFonts=true -r150 -dPDFSETTINGS=${setting} -sOutputFile="${tempOutput.replace(
    //   /\\/g,
    //   "/"
    // )}" "${tempInput.replace(/\\/g, "/")}"`;
    const command = `"${gsCommand}" -sDEVICE=pdfwrite -dCompatibilityLevel=1.3 -dNOPAUSE -dBATCH -dQUIET -dDetectDuplicateImages=true -dCompressFonts=true -r120 -dDownsampleColorImages=true -dColorImageResolution=120 -dPDFSETTINGS=${setting} -sOutputFile="${tempOutput.replace(
      /\\/g,
      "/"
    )}" "${tempInput.replace(/\\/g, "/")}"`;

    await execPromise(command, {
      timeout: COMPRESSION_TIMEOUT,
      maxBuffer: MAX_EXEC_BUFFER,
    });

    const stats = await fs.stat(tempOutput).catch(() => null);
    if (!stats || stats.size === 0) {
      return buffer;
    }

    const compressedBuffer = await fs.readFile(tempOutput);
    return compressedBuffer.length < buffer.length ? compressedBuffer : buffer;
  } catch (error) {
    console.log(
      `❌ Ghostscript failed with ${setting} for ${filename}:`,
      error.stderr || error.message
    );

    return buffer;
  } finally {
    // --- CRITICAL CLEANUP ---
    await Promise.allSettled([
      fs.unlink(tempInput).catch(() => {}),
      fs.unlink(tempOutput).catch(() => {}),
    ]);
  }
}

async function compressPDFEnhanced(buffer, filename) {
  const { PDFDocument } = await getPdfLib();
  if (!PDFDocument) return buffer;

  try {
    // Load the document for structural optimization
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

    // Use PDF-lib's save function with aggressive compression settings
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      objectStreams: "generate",
      compress: true, // This is the main compression trigger
      addDefaultPage: false,
      updateMetadata: false, // Helps save a tiny bit of space
    });

    const compressedBuffer = Buffer.from(compressedBytes);

    if (compressedBuffer.length < buffer.length) {
      return compressedBuffer;
    }

    return buffer;
  } catch (fallbackError) {
    console.error(
      `❌ Enhanced PDF-lib compression failed for ${filename}:`,
      fallbackError.message
    );
    return buffer;
  }
}

// --- Batch Processing (Kept from original code) ---

async function compressFiles(files) {
  if (!files?.length) return files;

  console.log(`Starting compression of ${files.length} files`);
  const startTime = Date.now();
  const compressedFiles = [];

  // Process files in batches
  for (let i = 0; i < files.length; i += MAX_CONCURRENT_COMPRESSION) {
    const batch = files.slice(i, i + MAX_CONCURRENT_COMPRESSION);
    console.log(
      `Processing batch ${Math.floor(i / MAX_CONCURRENT_COMPRESSION) + 1}: ${
        batch.length
      } files`
    );

    const batchPromises = batch.map(async (file) => {
      try {
        const result = await compressFile(file);
        return {
          ...file,
          buffer: result.buffer,
          size: result.buffer.length,
          compressed: result.compressed,
          originalSize: file.originalSize || file.size,
        };
      } catch (error) {
        console.error(
          `Failed to compress ${file.originalname}:`,
          error.message
        );
        return {
          ...file,
          compressed: false,
          originalSize: file.originalSize || file.size,
        };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        compressedFiles.push(result.value);
      }
    }

    // Small delay between batches
    if (i + MAX_CONCURRENT_COMPRESSION < files.length) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  const totalTime = (Date.now() - startTime) / 1000;
  console.log(
    `Compression completed: ${
      compressedFiles.length
    } files in ${totalTime.toFixed(1)} seconds`
  );

  return compressedFiles;
}

export { compressFile, compressFiles };
export default compressFiles;
