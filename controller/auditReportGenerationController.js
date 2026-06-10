import fs from "fs";
import path from "path";
// import puppeteer from "puppeteer"; // Import Puppeteer
import AuditResponse1 from "../models/auditReponseModel.js";
import AuditManagement from "../models/auditMangement.js";
import Label from "../models/labelModel.js";
import Question from "../models/questionSchema.js";
import { fileURLToPath } from "url";
import { launchBrowser } from "../helper/browserHelper.js";
import { User } from "../models/usersModel.js";
import {
  HYGIENE_RATING,
  TPA,
  DEFAULT_VALUES,
} from "../constants/auditDateVersion.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateAuditReport = async (req, res) => {
  let browser;
  try {
    console.log(req.body);
    const { audit_id, checkListId } = req.body;

    if (!audit_id) {
      return res.status(400).json({ message: "Audit ID is required" });
    }

    // Fetch necessary data
    // const auditDetails = await AuditManagement.findById(audit_id)
    //   .populate("user", "userName")
    //   .exec();

    const auditDetails = await AuditManagement.findById(audit_id)
      .populate("user", "userName")
      .populate("proposalId")
      .exec();

    const auditDate = new Date(auditDetails.started_at).toLocaleDateString(
      "en-GB"
    );
    console.log(auditDate);

    const { proposalId, location } = auditDetails;

    let fullAddress;
    let issueDate;
    let versionNumber;

    // Check if proposal address exists and has valid data
    if (proposalId?.address?.line1 || proposalId?.address?.line2) {
      const line1 = proposalId.address.line1 || "";
      const line2 = proposalId.address.line2 || "";
      fullAddress = `${line1}${line1 && line2 ? ", " : ""}${line2}`.trim();
    }

    // If fullAddress is empty, use location
    if (!fullAddress && location) {
      fullAddress = location.replace(/\//g, "");
    }

    // Remove duplicates from fullAddress
    if (fullAddress && fullAddress !== "N/A") {
      // Normalize and remove duplicates
      const addressParts = fullAddress.split(",").map((part) => part.trim());
      const uniqueParts = [];
      const seen = new Set();

      for (const part of addressParts) {
        const normalizedPart = part.toLowerCase().replace(/[.,]/g, "").trim();
        if (normalizedPart && !seen.has(normalizedPart)) {
          seen.add(normalizedPart);
          uniqueParts.push(part);
        }
      }

      fullAddress = uniqueParts.join(", ");
    }

    // Final fallback
    if (!fullAddress) {
      fullAddress = "N/A";
    }

    if (auditDetails?.service === "Hygiene Rating") {
      const industryData = HYGIENE_RATING[auditDetails.vertical_of_industry];
      if (industryData) {
        issueDate = industryData.issueDate;
        versionNumber = industryData.versionNumber;
      } else {
        ({ issueDate, versionNumber } = DEFAULT_VALUES);
      }
    } else if (auditDetails?.service === "TPA") {
      const industryData = TPA[auditDetails.vertical_of_industry];
      if (industryData) {
        issueDate = industryData.issueDate;
        versionNumber = industryData.versionNumber;
      } else {
        ({ issueDate, versionNumber } = DEFAULT_VALUES);
      }
    } else {
      ({ issueDate, versionNumber } = DEFAULT_VALUES);
    }

    // Use in template
    // <p><span class="font-semibold">Address:</span> {{fullAddress}}</p>

    if (!auditDetails) {
      return res.status(404).json({ message: "Audit not found" });
    }

    const approvarDetails = await User.find({
      _id: auditDetails.approver,
    }).select("userName signatureUrl roles");

    if (!approvarDetails) {
      return res.status(404).json({ message: "Approver not found" });
    }

    const approvarname = approvarDetails[0].userName;
    const approvarSign = approvarDetails[0].signatureUrl;

    const approvedStatus = auditDetails.statusHistory.find(
      (item) => item.status === "approved"
    );

    console.log(`${auditDetails}`.bgBlue.white);
    console.log(
      `${approvarDetails}${approvarname}${approvarSign} approved date ${approvedStatus}`
        .bgGrey.white
    );

    const userDetails = await User.find({ _id: auditDetails.user._id }).select(
      "signatureUrl"
    );
    const userSign = userDetails[0].signatureUrl;
    // // const userSignature = await userDetails.signatureUrl;
    // console.log(`${userDetails} `.bgRed.white);
    // const raw = userDetails.signatureUrl || "";
    // const match = raw.match(/>(https?:\/\/[^<]+)</);
    // const url = match ? match[1] : null;
    // console.log(`${userSign}`.bgRed.white);

    const labels = await Label.find({ checklistCategory: checkListId });
    const questions = await Question.find();
    const auditResponse1s = await AuditResponse1.find({ audit: audit_id });

    // Process sections and questions
    const sections = labels
      .sort((a, b) => a.position - b.position)
      .map((label) => {
        // After Filtering the questions, sorted the questions based on position(order of questions)
        const labelQuestions = questions
          .filter((question) => String(question.label) === String(label._id))
          .sort((a, b) => a.position - b.position);

        const questionsWithAnswers = labelQuestions.map((question, index) => {
          const auditResponse1 = auditResponse1s.find(
            (response) => String(response.question) === String(question._id)
          );

          return {
            questionId: question._id,
            description: ` ${question.question_text}`,
            mark: question.marks,
            position: question.position,
            comment: auditResponse1?.comment || "No Observation",
            marks: auditResponse1?.marks || "N/A",
          };
        });

        return {
          title: label.name,
          questions: questionsWithAnswers,
        };
      });

    // console.log(sections);

    // Read the HTML template from file
    const templatePath = path.join(__dirname, "../templates/auditReport.html");
    let htmlTemplate = fs.readFileSync(templatePath, "utf-8");

    // Read and convert the logo image to Base64 synchronously
    const logoPath = path.join(__dirname, "../templates/logo2.png");
    const logoBase64 = fs.readFileSync(logoPath, { encoding: "base64" });

    // Convert agencyStamp to base64
    const agencyStampPath = path.join(
      __dirname,
      "../templates/invoice_signature_image.png"
    );
    const agencyStampBase64 = fs.readFileSync(agencyStampPath, {
      encoding: "base64",
    });

    // Replace dynamic placeholders
    const {
      fbo_name,
      fssai_number,
      outlet_name,
      certificate_expiry,
      fssai_certificate_number,
    } = auditDetails;

    const d = new Date(certificate_expiry);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const formatted = `${day}-${month}-${year}`; // "06-08-2025"
    // console.log(sections.flatMap((section) => section.questions));

    const totalScore = sections
      .flatMap((section) => section.questions)
      .reduce((acc, q) => {
        if (/^\d+(\.\d+)?$/.test(q.mark)) {
          return acc + Number(q.mark);
        }
        return acc;
      }, 0);
    const scoreSecured = sections
      .flatMap((section) => section.questions)
      .reduce((acc, q) => {
        if (/^\d+(\.\d+)?$/.test(q.marks)) {
          return acc + Number(q.marks);
        }
        return acc;
      }, 0);

    htmlTemplate = htmlTemplate
      .replace(/{{fbo_name}}/g, fbo_name || "N/A")
      .replace(/{{location}}/g, location || "N/A")
      .replace(/{{fullAddress}}/g, fullAddress || "N/A")
      .replace(/{{fssai_number}}/g, fssai_number || "N/A")
      .replace(/{{auditor_name}}/g, auditDetails.user?.userName || "N/A")
      .replace(/{{imageData}}/g, logoBase64)
      .replace(/{{userSign}}/g, userSign)
      .replace(/{{auditee_name}}/g, auditDetails.auditee_name)
      .replace(
        /{{fostac_certificate_number}}/g,
        auditDetails.fostac_certificate_number
      )
      .replace(
        /{{fostac_certificate_validity}}/g,
        new Date(auditDetails.fostac_certificate_validity).toLocaleDateString(
          "en-GB"
        )
      )
      .replace(
        /{{audit_date}}/g,
        new Date(auditDetails.assigned_date).toLocaleDateString("en-GB")
      )
      .replace(/{{fostac_person}}/g, auditDetails.fostac_person)
      .replace(/{{vertical_of_industry}}/g, auditDetails.vertical_of_industry)
      .replace(/{{issueDate}}/g, issueDate)
      .replace(/{{versionNumber}}/g, versionNumber)
      .replace(/{{totalScore}}/g, totalScore)
      .replace(/{{scoreSecured}}/g, scoreSecured)
      .replace(/{{agencyStamp}}/g, agencyStampBase64);

    // Generate dynamic sections HTML
    const sectionsHTML = sections
      .map((section) => {
        let sectionTotal = 0;

        const questionsHTML = section.questions
          .map((q, index) => {
            let compliance;

            if (q.marks === "N/A") {
              compliance = "NA";
            } else {
              const percentage = (q.marks / q.mark) * 100;

              if (percentage > 80) {
                compliance = "C";
              } else if (percentage >= 50) {
                compliance = "PC";
              } else if (percentage < 50) {
                compliance = "NC";
              } else {
                compliance = "PC";
              }

              // Only count numeric scores
              sectionTotal += Number(q.marks);
            }

            return `
      <tr class="text-xs">
        <td class="border px-2 py-1">${q.position}</td>
        <td class="border px-2 py-1">${q.description}</td>
        <td class="border px-2 py-1 text-center">${q.mark}</td>
        <td class="border px-2 py-1 text-center">${q.marks}</td>
        <td class="border px-2 py-1 text-center">${compliance}</td>
        <td class="border px-2 py-1">${q.comment}</td>
      </tr>`;
          })
          .join("");

        return `
    <h2 class="text-sm font-semibold my-2">${section.title}</h2>
    <table class="w-full text-xs border border-gray-300 mb-2">
      <thead>
        <tr>
          <th class="border px-2 py-1 text-left">S.No</th>
          <th class="border px-2 py-1 text-left">Audit Question</th>
          <th class="border px-2 py-1 text-center">Marks</th>
          <th class="border px-2 py-1 text-center">Actual Score</th>
          <th class="border px-2 py-1 text-center">C/PC/NC/NA</th>
          <th class="border px-2 py-1 text-left">Observations</th>
        </tr>
      </thead>
      <tbody>
        ${questionsHTML}
      </tbody>
    </table>
    <p class="text-xs font-semibold mb-4">Section Score: ${sectionTotal}</p>
    `;
      })
      .join("");

    const overallPct = totalScore === 0 ? 0 : (scoreSecured / totalScore) * 100;

    const highlightRow = (grade, range) => {
      const ok =
        (grade === "A+" && overallPct >= 90) ||
        (grade === "A" && overallPct >= 80 && overallPct < 90) ||
        (grade === "B" && overallPct >= 50 && overallPct < 80) ||
        (grade === "No Grade" && overallPct < 50);

      return ok ? `class="bg-green-500 font-bold"` : "";
    };

    const ProductsNames = `
    <div class="text-sm font-bold mt-4 font-semibold">Products Inspected</div>
    <div> 
    ${auditDetails.inspectedProducts.map((item) => `<div>${item}</div>`)}
    </div>
      `;

    const EquipmentUsed = `
  <div class="text-sm font-bold mt-4 font-semibold">Equipment used</div>
  <div>
    ${auditDetails.equipmentUsed.map((item) => `<div>${item}</div>`).join("")}
  </div>
`;

    const GradingInfo = `
    <div class="text-xs mt-4 font-semibold font-semibold mt-4">
        Grading (Achived Grade is highlited in Green)
      </div>
<table class="w-[60%] text-sm">
  <tbody>
    <tr ${highlightRow("A+", "90% and above")} class="text-xs">
      <td>A+</td>
      <td>90% and above</td>
      <td>Compliance – Exemplary</td>
    </tr>
    <tr ${highlightRow("A", "80% - 89%")} class="text-xs">
      <td>A</td>
      <td>80% - 89%</td>
      <td>Compliance Satisfactory</td>
    </tr>
    <tr ${highlightRow("B", "50% - 79%")} class="text-xs">
      <td>B</td>
      <td>50% - 79%</td>
      <td>Need Improvement</td>
    </tr>
    <tr ${highlightRow("No Grade", "Below 50%")} class="text-xs"> 
      <td>No Grade</td>
      <td>Below 50%</td>
      <td>Non Compliance</td>
    </tr>
  </tbody>
</table>
`;

    // const overallPct = totalScore === 0 ? 0 : (scoreSecured / totalScore) * 100;

    const getGrade = (percentage) => {
      if (percentage >= 90) return "A+";
      if (percentage >= 80) return "A";
      if (percentage >= 50) return "B";
      return "No Grade";
    };

    const OverallFindings = `
      <div class="text-sm font-bold mt-4 font-semibold">Overall findings</div>

    ${sections
      .flatMap((sec) =>
        sec.questions.map((q, questionIndex) => {
          if (q.marks === "N/A") return null; // skip unanswered

          // Only include if marks are less than maximum marks
          if (Number(q.marks) >= Number(q.mark)) return null;

          const pct = (Number(q.marks) / Number(q.mark)) * 100;
          // if (pct === 100) return null; // skip fully compliant

          let compliance;
          if (q.marks === "N/A") {
            compliance = "NA";
          } else {
            if (pct > 80) {
              compliance = "C";
            } else if (pct >= 50) {
              compliance = "PC";
            } else if (pct < 50) {
              compliance = "NC";
            } else {
              compliance = "PC";
            }
          }

          // Get the actual question number (position)
          const questionNumber = q.position || questionIndex + 1;

          // returning comment also given by auditor
          return {
            text: q.description.trim(),
            grade: getGrade(pct),
            issue: q.comment.trim(),
            compliance: compliance,
            questionNumber: questionNumber,
          };
        })
      )
      .filter(Boolean)
      .map(
        (item, idx) =>
          // Previous One Show -> Index No - Question - Grade
          // `<li class="text-xs mb-1">${idx + 1}. ${item.text} <strong>(${
          //   item.grade
          // })</strong></li>`

          // Updated One Show -> Index No - Observation(Comment by Auditor) - Grade
          `<li class="text-xs mb-1">${item.questionNumber}. ${item.issue} <strong>(${item.compliance})</strong></li>`
      )
      .join("")}`;

    // Add this after the OverallFindings section
    const SuggestionsImprovements = `
  <div class="suggestions-section mt-6">
    <h3 class="text-sm font-bold mb-3 text-black">Suggestions & Improvements</h3>
    <div class="p-4">
      ${
        auditDetails.suggestions && auditDetails.suggestions.length > 0
          ? `
            <ul class="list-disc pl-5 space-y-2">
              ${auditDetails.suggestions
                .map(
                  (suggestion, index) => `
                <li class="text-xs text-gray-700">${suggestion}</li>
              `
                )
                .join("")}
            </ul>
          `
          : `
            <p class="text-xs text-gray-600 italic">
              No specific suggestions provided for this audit.
            </p>
          `
      }
    </div>
  </div>
`;

    const TPASection = `
  <div class="tpa-wrapper" style="margin: 24px 0;">
    <h3 class="text-base font-bold mb-2 text-blue-700">
      Third-Party Audit (TPA) – Additional Information
    </h3>
    <p class="text-sm">
      This section is visible only when the service type is <strong>TPA</strong>.
    </p>
    <table class="w-full text-sm border mt-2">
      <thead>
        <tr>
          <th class="border px-2 py-1">Item</th>
          <th class="border px-2 py-1">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="border px-2 py-1">TPA Licence Verified</td>
          <td class="border px-2 py-1">${
            auditDetails.tpa_licence_verified ? "Yes" : "No"
          }</td>
        </tr>
      </tbody>
    </table>
  </div>
`;

    const approvalSection = `
<style>
  /* Formal, neutral font & colors */
  .approval-section { width: 100%; font-family: "Helvetica Neue", Arial, sans-serif; color: #111827; }

  /* layout */
  .approval-flex { display: flex; justify-content: space-between; align-items: flex-start; gap: 40px; }
  .approver-section, .auditor-section { flex: 1 1 48%; min-height: 220px; }

  /* labels & text */
  .label { font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #1f2937; }
  .small { font-size: 12px; margin-bottom: 6px; color: #374151; }
  .name { font-size: 18px; font-weight: 500; margin-bottom: 12px; color: #0f172a; }

  /* signatures & stamp */
  .signature-container { margin-bottom: 12px; display: block; }
  .signature-container img { display: block; width: 120px; height: auto; object-fit: contain; border: 0; }
  .stamp-img { width: 120px; height: auto; object-fit: contain; }

  /* align right column content neatly */
  .auditor-section { text-align: left; display: flex; flex-direction: column; align-items: flex-start; }

  /* subtle spacing for final label */
  .agency-label { font-size: 12px; font-weight: 600; margin-top: 6px; color: #1f2937; }

  /* keep left column left-aligned */
  .approver-section { text-align: left; }

  /* small helper for spacing where needed */
  .spacer { height: 6px; }
</style>

<div class="approval-section mt-8 py-6">
  <div class="approval-flex">

    <!-- Approver Section (LEFT) -->
    <div class="approver-section">
      <div class="label">Report Approved by: <span class="small font-medium">${
        approvarname || "N/A"
      }</span></div>

      <!-- Approver Signature -->
      <div class="signature-container">
        <img src="${approvarSign || ""}" alt="Digital Signature of ${
      approvarname || ""
    }" />
      </div>

      <div class="label">Approved Date: <span class="small font-medium mb-3">${
        approvedStatus
          ? new Date(approvedStatus.changedAt).toLocaleDateString("en-GB")
          : "N/A"
      }</span></div>

      <div class="label">Report Shared Date (to FBO): <span class="small font-medium">${new Date().toLocaleDateString(
        "en-GB"
      )}</span></div>
      
    </div>

    <!-- Auditor Section (RIGHT) -->
    <div class="auditor-section">

      <!-- Title -->
      <div class="label">Signature of Auditor</div>
      <div class="signature-container" aria-hidden="true">
        <img src="${userSign || ""}" alt="Digital Signature of ${
      auditDetails.user?.userName || "Auditor"
    }" />
      </div>

      <!-- Name label + name -->
      <div class="label">Name of Auditor: <span class="small font-medium">${
        auditDetails.user?.userName || "N/A"
      }</span></div>
      
      <div class="label">Date: <span class="small font-medium">${
        auditDate || "N/A"
      }</span></div>

      <!-- Stamp image ABOVE label -->
      <div style="margin-top:18px; margin-bottom:6px;">
        <img src="data:image/png;base64,${agencyStampBase64}" alt="Agency Stamp" class="stamp-img" />
      </div>

      <div class="agency-label">Agency Stamp</div>
    </div>

  </div>
</div>
`;

    htmlTemplate = htmlTemplate
      .replace("{{AUDIT_SECTIONS}}", sectionsHTML)
      .replace(
        "{{GRADING_INFO}}",
        auditDetails.service === "TPA" ? GradingInfo : ""
      )
      .replace(
        "{{OverallFindings}}",
        auditDetails.service === "TPA" ? OverallFindings : ""
      )
      .replace(
        "{{PRODUCTS_INSPECTED}}",
        auditDetails.service === "TPA" ? ProductsNames : ""
      )
      .replace(
        "{{EQUIPMENT_USED}}",
        auditDetails.service === "TPA" ? EquipmentUsed : ""
      )
      .replace("{{TPA_INFO}}", auditDetails.service === "TPA" ? TPASection : "")
      .replace(
        "{{APPROVAL}}",
        auditDetails.service === "TPA" ? approvalSection : ""
      )
      .replace(
        "{{SUGGESTIONS}}",
        auditDetails.service === "TPA" ? SuggestionsImprovements : ""
      );

    // Launch browser using helper
    browser = await launchBrowser();

    const page = await browser.newPage();
    await page.setContent(htmlTemplate, { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `
        <div style="width: 100%; font-size: 8px; text-align: center; padding: 10px 0;">
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`,
      margin: {
        top: "40px",
        bottom: "40px",
        right: "20px",
        left: "20px",
      },
    });

    await browser.close();

    // Send the generated PDF to the client
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=audit-report-${fbo_name}-${outlet_name}.pdf`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating audit report:", error);
    console.error("playwright error:", error.message);
    console.error("Stack trace:", error.stack);

    res
      .status(500)
      .json({ message: "An error occurred while generating the audit report" });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
