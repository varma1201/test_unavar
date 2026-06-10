// import puppeteer from "puppeteer";
import { promises as fs } from "fs";
import path from "path";
import nodemailer from "nodemailer";
import Proposal from "../models/proposalModel.js";
import CompanyDetail from "../models/CompanyDetail.js";
import BankDetail from "../models/BankDetailModel.js";
import moment from "moment/moment.js";
import { chromium } from "playwright";
import {
  SESClient,
  SendEmailCommand,
  SendRawEmailCommand,
} from "@aws-sdk/client-ses";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import dotenv from "dotenv";
dotenv.config();

const __dirname = path.resolve();

const sesClient = new SESClient({
  region: process.env.AWS_REGION, // Change to your SES region
  credentials: {
    accessKeyId: process.env.AWS_SMTP_LOGIN,
    secretAccessKey: process.env.AWS_SMTP_SECRET_KEY,
  },
});

const formatCurrency = (value) => {
  if (value === "N/A" || value === undefined || value === null) return "0.00";
  return Number(value).toFixed(2);
};

const roundUpRupee = (value) => {
  if (!value) return 0;
  return Math.ceil(Number(value));
};

export const generateProposal = async (req, res) => {
  let browser = null;
  try {
    const { proposalId } = req.params;
    const { to, cc, message } = req.body;
    console.log(cc);

    // Fetch proposal details and read files concurrently
    const [
      proposalDetails,
      companyDetails,
      bankDetails,
      htmlTemplate,
      imageData,
      footerSvgBase64,
      headerSvgBase64,
    ] = await Promise.all([
      Proposal.findById(proposalId).exec(),
      CompanyDetail.findOne().exec(), // Fetch the first record from CompanyDetail
      BankDetail.findOne().exec(), // Fetch the first record from BankDetail
      fs.readFile(path.join(__dirname, "templates", "proposal.html"), "utf-8"),
      fs.readFile(path.join(__dirname, "templates", "logo2.png"), {
        encoding: "base64",
      }),
      fs.readFile(path.join(__dirname, "templates", "LetterHeadBottom.png"), {
        encoding: "base64",
      }),
      fs.readFile(path.join(__dirname, "templates", "LetterHeadTop.png"), {
        encoding: "base64",
      }),
    ]);

    console.log(proposalDetails, "here is proposal details");

    if (!proposalDetails) {
      return res.status(404).send("Proposal not found");
    }

    if (!bankDetails || !companyDetails) {
      return res.status(500).send("Company or Bank details not found");
    }

    const { company_name, company_address, contact_number, email, gstin, PAN } =
      companyDetails;

    const {
      account_holder_name,
      account_number,
      bank_name,
      branch_name,
      ifsc_code,
      micr_code,
    } = bankDetails;

    const {
      fbo_name,
      contact_person,
      phone,
      address: { line1, line2 },
      gst_number,
      outlets,
      proposal_number,
      proposal_date,
      pincode,
      same_state,
      type_of_industry,
      vertical_of_industry,
      auditor_convenience_fee,
      email: client_email,
      note,
      service,
      po_number,
    } = proposalDetails;

    const gstRow =
      gst_number && gst_number.trim() !== ""
        ? `<strong>GST No:</strong> ${gst_number}<br />`
        : "";

    // let finalVertical = vertical_of_industry;
    // finalVertical =
    //   service != "TPA" && service != "Hygiene Rating"
    //     ? "Catering"
    //     : finalVertical;
    const finalVertical = vertical_of_industry;
    const formattedDate = moment(proposal_date).format("DD/MM/YYYY");

    // Calculate totals
    const numericTotal = outlets.reduce(
      (acc, outlet) =>
        acc + Number(outlet.amount?.$numberInt ?? outlet.amount ?? 0),
      0
    );

    const numericAuditorFee = auditor_convenience_fee ?? 0;

    const totalBeforeTax = numericTotal + numericAuditorFee;
    // Normalize same_state safely
    const isSameState =
      same_state === true ||
      same_state === "true" ||
      same_state === 1 ||
      same_state === "1";

    // ==============================
    // GST CALCULATION (YOUR LOGIC)
    // ==============================

    let numericCGST = 0;
    let numericSGST = 0;
    let numericIGST = 0;

    if (isSameState) {
      // Same State → CGST 9% + SGST 9%
      numericCGST = totalBeforeTax * 0.09;
      numericSGST = totalBeforeTax * 0.09;
    } else {
      // Different State → IGST 9% + SGST 9%
      numericIGST = totalBeforeTax * 0.09;
      numericSGST = totalBeforeTax * 0.09;
    }

    // Correct Total Calculation

    // const numericCGST = same_state ? totalBeforeTax * 0.09 : 0;
    // const numericSGST = same_state ? totalBeforeTax * 0.09 : 0;
    // const numericIGST = !same_state ? totalBeforeTax * 0.09 : 0;

    const numericOverallTotal = same_state
      ? roundUpRupee(totalBeforeTax + numericCGST + numericSGST)
      : roundUpRupee(totalBeforeTax + numericIGST + numericSGST);

    const total = formatCurrency(totalBeforeTax);
    const cgst = formatCurrency(numericCGST);
    const sgst = formatCurrency(numericSGST);
    const igst = formatCurrency(numericIGST);
    const overallTotal = formatCurrency(numericOverallTotal);
    const auditorFee = formatCurrency(numericAuditorFee);
    const amountWithoutTax = formatCurrency(totalBeforeTax);
    const totalAmountWithTax = formatCurrency(numericOverallTotal);

    // Tax details to be displayed in the table
    const tax = same_state
      ? `
  <tr>
    <td colspan="6" class="border text-right w-3/4 small-cell">
      <strong class="font-bold">CGST [9%]</strong>
    </td>
    <td class="border w-1/4 small-cell text-center"><strong class="font-bold">₹${cgst}</strong></td>
  </tr>
  <tr>
    <td colspan="6" class="border text-right w-3/4 small-cell">
      <strong class="font-bold">SGST [9%]</strong>
    </td>
    <td class="border w-1/4 small-cell text-center"><strong class="font-bold">₹${sgst}</strong></td>
  </tr>
`
      : `
 <tr>
    <td colspan="6" class="border text-right w-3/4 small-cell">
      <strong class="font-bold">IGST [9%]</strong>
    </td>
    <td class="border w-1/4 small-cell text-center"><strong class="font-bold">₹${igst}</strong></td>
  </tr>
  <tr>
    <td colspan="6" class="border text-right w-3/4 small-cell">
      <strong class="font-bold">SGST [9%]</strong>
    </td>
    <td class="border w-1/4 small-cell text-center"><strong class="font-bold">₹${sgst}</strong></td>
  </tr>
`;

    const tax2 = same_state
      ? `  <tr>
              <td class="w-1/2 border py-1"><strong class="font-bold">CGST [9%]</strong></td>
              <td class="w-1/2 border  py-1"><strong class="font-bold">₹${cgst}</strong></td>
            </tr>
            <tr>
              <td class="w-1/2 border py-1"><strong class="font-bold">SGST [9%]</strong></td>
              <td class="w-1/2 border py-1"><strong class="font-bold">₹${sgst}</strong></td>
            </tr>
            <tr>`
      : ` <tr>
              <td class="w-1/2 border py-1"><strong class="font-bold">IGST [9%]</strong></td>
              <td class="w-1/2 border  py-1"><strong class="font-bold">₹${igst}</strong></td>
            </tr>
            <tr>
              <td class="w-1/2 border py-1"><strong class="font-bold">SGST [9%]</strong></td>
              <td class="w-1/2 border py-1"><strong class="font-bold">₹${sgst}</strong></td>
            </tr>
            <tr>`;

    // Parse proposal date
    const proposalDate = proposal_date?.$date?.$numberLong
      ? new Date(parseInt(proposal_date.$date.$numberLong))
      : new Date();

    // Generate outlet rows
    const outletRows = outlets
      .map((outlet) => {
        const postfix =
          {
            Transportation: "VH",
            Catering: "FH",
            "Trade and Retail": "Sq ft",
            Manufacturing: "PD/Line",
          }[outlet.type_of_industry] || "";

        const outletName =
          `${outlet.outlet_name} <strong>${outlet.city}</strong>` || "";
        const vertical_of_industry = outlet.vertical_of_industry || "";
        const type_of_industry = outlet.type_of_industry || "";
        // const description =
        //   `${outlet.description} (${outlet.type_of_industry})` || "";

        let extraText = "";

        if (outlet.outlet_name !== "Others") {
          if (outlet.description === "Hygiene Rating" && vertical_of_industry) {
            extraText = ` (${vertical_of_industry})`;
          } else if (outlet.description === "TPA" && type_of_industry) {
            extraText = ` (${type_of_industry})`;
          }
        }

        const description = `${outlet.description}${extraText}`;
        // const service =
        //   outletName === "Others" ? "N/A" : `${outlet.unit || ""} ${postfix}`;
        let service = "";

        if (outlet.type_of_industry === "Manufacturing") {
          const foodHandlers = outlet.unit || 0;
          const productionLines = outlet.no_of_production_line || 0;

          // compact form → avoids layout break
          service = `FH: ${foodHandlers}<br>PD Line: ${productionLines}`;
        } else {
          service =
            outlet.outlet_name === "Others"
              ? "N/A"
              : `${outlet.unit || ""} ${postfix}`;
        }

        const manDays =
          outletName === "Others"
            ? "N/A"
            : outlet.man_days?.$numberDouble || outlet.man_days || 0;
        const quantity = outlet.quantity?.$numberInt || outlet.quantity || 0;
        const unitCost = formatCurrency(
          outlet.unit_cost?.$numberInt || outlet.unit_cost || 0
        );
        const amount = formatCurrency(
          outlet.amount?.$numberInt || outlet.amount || 0
        );

        return ` 
        <tr>
          <td class="px-2 py-1 text-center">${outletName}</td>
          <td class="px-2 py-1 text-center">${description}</td>
          <td class="px-2 py-1 text-center">${service}</td>
          <td class="px-2 py-1 text-center">${manDays}</td>
          <td class="px-2 py-1 text-center">${quantity}</td>
          <td class="px-2 py-1 text-center">${unitCost}</td>
          <td class="px-2 py-1 text-center">${amount}</td>
        </tr>
      `;
      })
      .join("");

    const financialRows =
      numericAuditorFee != 0
        ? ` <tr>
         <td class="px-2 py-1 text-center">Others</td>
         <td class="px-2 py-1 text-center">Auditor Conveyance Charges</td>
         <td class="px-2 py-1 text-center">--</td>
         <td class="px-2 py-1 text-center">--</td>
         <td class="px-2 py-1 text-center">--</td>
         <td class="px-2 py-1 text-center">--</td>
         <td class="px-2 py-1 text-center currency-cell">${auditorFee}</td>
       </tr>`
        : ``;

    // Replace placeholders in template in one go
    const dynamicContent = htmlTemplate
      .replace(/{{fbo_name}}/g, fbo_name)
      .replace(/{{client_email}}/g, client_email)
      .replace(/{{contact_person}}/g, contact_person)
      .replace(/{{contactPersonNumber}}/g, phone)
      .replace(/{{address}}/g, `${line1}, ${line2}`)
      .replace(/{{gstRow}}/g, gstRow)
      .replace(/{{type_of_industry}}/g, type_of_industry)
      .replace(/{{vertical_of_industry}}/g, finalVertical)
      .replace(/{{proposalNumber}}/g, proposal_number)
      .replace(/{{outletRows}}/g, outletRows)
      .replace(/{{financialRows}}/g, financialRows)
      .replace(/{{imageData}}/g, imageData)
      .replace(/{{headerSvgData}}/g, headerSvgBase64)
      .replace(/{{footerSvgData}}/g, footerSvgBase64)
      .replace(/{{total}}/g, total)
      .replace(/{{cgst}}/g, cgst)
      .replace(/{{sgst}}/g, sgst)
      .replace(/{{igst}}/g, igst)
      .replace(/{{overallTotal}}/g, overallTotal)
      .replace(/{{auditor_convenience_fee}}/g, auditorFee)
      .replace(/{{amountWithoutTax}}/g, amountWithoutTax)
      .replace(/{{totalAmountWithTax}}/g, totalAmountWithTax)
      .replace(/{{pincode}}/g, pincode)
      .replace(/{{tax}}/g, tax)
      .replace(/{{tax2}}/g, tax2)
      .replace(/{{formattedDate}}/g, formattedDate)
      .replace(/{{company_name}}/g, company_name)
      .replace(
        /{{company_address}}/g,
        `${company_address.line1} ${company_address.line2}\n${company_address.city} ${company_address.state} ${company_address.pincode}`
      )
      .replace(/{{contact_number}}/g, contact_number)
      .replace(/{{email}}/g, email)
      .replace(/{{gstin}}/g, gstin)
      .replace(/{{PAN}}/g, PAN)
      .replace(/{{po_number}}/g, po_number || "-")
      .replace(/{{account_holder_name}}/g, account_holder_name)
      .replace(/{{account_number}}/g, account_number)
      .replace(/{{bank_name}}/g, bank_name)
      .replace(/{{branch_name}}/g, branch_name)
      .replace(/{{ifsc_code}}/g, ifsc_code)
      .replace(/{{micr_code}}/g, micr_code)
      .replace(/{{note}}/g, note);

    // Launch Puppeteer using Chromium
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process", // Optional: If multiple processes are a problem
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    await page.setContent(dynamicContent, { waitUntil: "networkidle0" });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      margin: {
        top: "160px", // space for header
        bottom: "160px", // space for footer
        left: "0px",
        right: "0px",
      },
      headerTemplate: `
<style>
  .pdf-header {
    width: 100%;
    height: 120px;     
    padding: 0;
    margin: 0;
    position: relative;
    font-size: 8px; /* required by Chrome */
    border-bottom: 4px solid black;
    transform: translateY(-20px); 
  }
  .header-bg {
    width: 100%;
    height: 100px;
    object-fit: contain;
    object-position: top right;
    display: block;
    transform:translateY(-30px);
    transform-origin: top;
  }
  .header-row {
    position: absolute;
    top: 10px;
    left: 40px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .header-logo {
    width: 120px;
    height: 120px;
    object-fit: contain;
  }
  .header-title {
    font-family: 'Times New Roman', serif;
    font-size: 17px;
    font-weight: bold;
    color: #000;
    line-height: 1.1;
  }
</style>

<div class="pdf-header">
  
  <!-- Background Header Wave Image -->
  <img src="data:image/png;base64,${headerSvgBase64}" class="header-bg" />

  <!-- Logo + Company Name -->
  <div class="header-row">
      <img src="data:image/png;base64,${imageData}" class="header-logo" />
      <div class="header-title">
        UNAVAR FOOD INSPECTION AND CERTIFICATION PRIVATE LIMITED
      </div>
  </div>

</div>
`,
      footerTemplate: `
<style>
  .pdf-footer {
    width: 100%;
    position: relative;
    transform: translateY(25px);
    font-size: 8px; /* Chrome requires this */
  }
</style>

<div class="pdf-footer">

  <!-- Right Side Contact Info -->
  <div style="width: fit-content; position: absolute; right: 30px; bottom: 60px; text-align:left;">
    <div style="display:flex;align-items:center;column-gap:8px;margin-bottom:5px;">
      <div style="font-size: 14px; font-weight: bold;">📞 +91 88388 70687</div>
    </div>
    <div style="display:flex;align-items:center;column-gap:8px;margin-bottom:5px;">
      <div style="font-size: 14px; font-weight: bold;">📧 admin@unavar.com</div>
    </div>
    <div style="display:flex;align-items:center;column-gap:8px;">
      <div style="font-size: 14px; font-weight: bold;">🌐 www.unavar.com</div>
    </div>
  </div>

  <!-- Footer Wave Image -->
  <img src="data:image/png;base64,${footerSvgBase64}" style="width:100%; height:auto;" />

  <!-- Left Side Registered Office Info -->
  <div style="position:absolute; bottom:8px; left:40px; text-align:left; color:#fff;">
    <div style="font-size: 13px; font-weight:bold; margin-bottom:5px; color:black">
      Registered Office Address :
    </div>
    <div style="font-size: 12px;">
      📍 FLAT NO. F1, FIRST FLOOR, DOOR NO: 519, MM ILLAM, MKN ROAD, ADAMBAKKAM VILLAGE, ALANDUR, CHENNAI - 600016
    </div>
  </div>

</div>
`,
    });

    if (req.query.download === "true") {
      const cleanFboName = fbo_name
        .trim()
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .replace(/\s+/g, "-");

      const fileName = `${proposal_number}_${cleanFboName}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );

      console.log("Pdf file send to frontend");
      return res.send(pdfBuffer);
    }

    // Set up Nodemailer
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
    // const sendersEmail = process.env.SENDERS_EMAIL;

    // const mailOptions = {
    //   from: `"Unavar Food Inspection and Certification Private Limited " <${sendersEmail}>`,
    //   to,
    //   cc,
    //   subject: "Proposal Document",
    //   html: message,
    //   attachments: [
    //     {
    //       filename: `proposal-${proposalId}.pdf`,
    //       content: pdfBuffer,
    //       encoding: "base64",
    //     },
    //   ],
    // };

    // Send email
    // const info = await transporter.sendMail(mailOptions);
    // console.log("Email sent:", info.response);

    // Update proposal status

    const sendersEmail = process.env.SCALE_EMAIL;
    // const sendersEmail = process.env.SENDERS_EMAIL;

    // Email Signature (HTML)
    const emailSignature = `
  <br/><br/>
  <div style="font-size:12px; font-family:Arial, sans-serif; line-height:1.5;">
    Thanks & Regards,<br/>
    <strong>Technical Administrator</strong><br/>
    <strong>Unavar Food Inspection and Certification</strong><br/>
    <strong>Private Limited</strong><br/>
    Chennai - 600008
  </div>
`;

    // Final email body = user message + signature
    const finalMessage = `${message}${emailSignature}`;
    const cleanFboName = fbo_name
      .trim()
      .replace(/[^a-zA-Z0-9 ]/g, "") // remove special chars
      .replace(/\s+/g, "-"); // spaces → dash

    const mail = new MailComposer({
      from: `"Unavar Food Inspection and Certification Private Limited" <${sendersEmail}>`,
      to,
      cc,
      subject: "Proposal Document",
      html: finalMessage,
      attachments: [
        {
          filename: `${proposal_number}_${cleanFboName}.pdf`,
          content: pdfBuffer,
          encoding: "base64",
        },
      ],
    });

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

    const response = await sesClient.send(command);

    await Proposal.findByIdAndUpdate(proposalId, { status: "Mail Sent" });

    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Error generating PDF or sending email:", error);
    console.error("Puppeteer error:", error.message);
    console.error("Stack trace:", error.stack);

    res.status(500).send("Internal Server Error");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
