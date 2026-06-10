// import puppeteer from "puppeteer";
import { promises as fs } from "fs";
import path from "path";
import nodemailer from "nodemailer";
import numWords from "num-words";
import Invoice from "../models/invoiceModel.js";
import dotenv from "dotenv";
import moment from "moment/moment.js";
import CompanyDetail from "../models/CompanyDetail.js";
import BankDetail from "../models/BankDetailModel.js";
import Proposal from "../models/proposalModel.js";
import { launchBrowser } from "../helper/browserHelper.js";
import {
  SESClient,
  SendEmailCommand,
  SendRawEmailCommand,
} from "@aws-sdk/client-ses";
import MailComposer from "nodemailer/lib/mail-composer/index.js";

dotenv.config();

const __dirname = path.resolve();

const sesClient = new SESClient({
  region: process.env.AWS_REGION, // Change to your SES region
  credentials: {
    accessKeyId: process.env.AWS_SMTP_LOGIN,
    secretAccessKey: process.env.AWS_SMTP_SECRET_KEY,
  },
});

export const generateInvoice = async (req, res) => {
  const { invoiceId } = req.params;
  let browser = null;

  try {
    const { to, cc, message } = req.body;

    const invoiceDetails = await Invoice.findById(invoiceId).exec();
    const companyDetails = await CompanyDetail.findOne().exec(); // Fetch the first record from CompanyDetail
    const bankDetails = await BankDetail.findOne().exec(); // Fetch the first record from BankDetail
    const proposalDetails = await Proposal.findById(
      invoiceDetails.proposalId
    ).exec();

    if (!invoiceDetails) {
      return res.status(404).send("Invoice not found");
    }

    const { company_name, company_address, contact_number, email, gstin, pan } =
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
      outlets,
      invoice_number,
      invoice_date,
      proposal_number,
      pincode,
      place_of_supply,
      field_executive_name,
      team_leader_name,
      gst_number,
      same_state,
      remark,
      po_number,
    } = invoiceDetails;

    const formattedDate = invoice_date
      ? moment(invoice_date).format("MMMM D, YYYY")
      : "";

    const roundUpRupee = (value) => {
      if (!value) return 0;
      return Math.ceil(Number(value));
    };

    // Calculate subtotal, taxes, and total
    let subTotal = 0;
    const outletItems = outlets
      .map((outlet) => {
        const unit_cost = parseFloat(outlet.unit_cost || 0);
        const amount = parseFloat(outlet.amount || 0);
        subTotal += amount;
        // console.log(outlet.service);

        return ` 
          <tr>
            <td class="px-2 text-center border border-black border-l-0">${
              outlet.outlet_name || ""
            }</td>
            <td class="px-2  text-center border border-black border-l-0">${
              outlet.description || ""
            }</td>
            <td class="px-2  text-center border border-black border-l-0">${(
              outlet.service || ""
            ).replace(/\n/g, "<br>")}</td>
            <td class="px-2  text-center border border-black border-l-0">${
              outlet.man_days || 0
            }</td>
            <td class="px-2  text-center border border-black border-l-0">${
              outlet.quantity || 0
            }</td>
            <td class="px-2  text-center border border-black border-l-0">₹${unit_cost.toFixed(
              2
            )}</td>
            <td class="px-2  text-center border border-black border-r-0">₹${amount.toFixed(
              2
            )}</td>
          </tr>
        `;
      })
      .join("");

    const numericAuditorFee = Number(
      proposalDetails.auditor_convenience_fee || 0
    );
    const auditorFee = numericAuditorFee.toFixed(2);

    const subTotalBeforeTax = subTotal + numericAuditorFee;

    const auditorRow =
      numericAuditorFee != 0
        ? `
  <tr>
    <td class="text-center border border-black border-l-0">Others</td>
    <td class="text-center border border-black border-l-0">Auditor Conveyance Fee</td>
    <td class="text-center border border-black border-l-0">--</td>
    <td class="text-center border border-black border-black border-l-0">--</td>
    <td class="text-center border border-black border-l-0">--</td>
    <td class="text-center border border-black border-l-0">--</td>
    <td class="text-center border border-black border-r-0">₹${auditorFee}</td>
  </tr>`
        : ``;

    // Initialize tax variables
    let cgst = 0,
      sgst = 0,
      gst = 0,
      overallTotal = 0;

    if (same_state) {
      cgst = parseFloat((subTotalBeforeTax * 0.09).toFixed(2));
      sgst = parseFloat((subTotalBeforeTax * 0.09).toFixed(2));
      overallTotal = roundUpRupee(subTotalBeforeTax + cgst + sgst);
    } else {
      gst = parseFloat((subTotalBeforeTax * 0.18).toFixed(2));
      overallTotal = roundUpRupee(subTotalBeforeTax + gst);
    }

    // let tax = same_state
    //   ? `<p><span class="font-semibold"></span> ₹${cgst.toFixed(2)}</p>
    //      <p><span class="font-semibold"></span> ₹${sgst.toFixed(2)}</p>`
    //   : `<p><span class="font-semibold"></span> ₹${gst.toFixed(2)}</p>`;

    let tax = same_state
      ? `
    <p style="border-bottom:1px solid black; padding:2px 6px;">₹0.00</p>
    <p style="border-bottom:1px solid black; padding:2px 6px;">₹${cgst.toFixed(
      2
    )}</p>
    <p style="padding:2px 6px;">₹${sgst.toFixed(2)}</p>
  `
      : `
    <p style="border-bottom:1px solid black; padding:2px 6px;">₹${gst.toFixed(
      2
    )}</p>
    <p style="border-bottom:1px solid black; padding:2px 6px;">₹0.00</p>
    <p style="padding:2px 6px;">₹0.00</p>
  `;

    const totalInWords = numWords(Math.floor(overallTotal));

    const htmlTemplate = await fs.readFile(
      path.join(__dirname, "templates", "invoice.html"),
      "utf-8"
    );

    const imagePath = path.join(__dirname, "templates", "logo2.png");
    const imageData = await fs.readFile(imagePath, { encoding: "base64" });

    const invoiceSignatureImage = await fs.readFile(
      path.join(__dirname, "templates", "invoice_signature_image.png"),
      { encoding: "base64" }
    );

    const dynamicContent = htmlTemplate
      .replace(/{{imageData}}/g, imageData)
      .replace(/{{invoiceSignatureImage}}/g, invoiceSignatureImage)
      .replace(
        /{{remark}}/g,
        remark && remark.trim() !== "" ? remark : "No remarks"
      )
      .replace(/{{fbo_name}}/g, fbo_name)
      .replace(/{{contact_person}}/g, contact_person)
      .replace(/{{contact_number}}/g, phone)
      .replace(/{{address}}/g, `${line1}, ${line2 || ""}`)
      .replace(/{{invoice_number}}/g, invoice_number)
      .replace(/{{formattedDate}}/g, formattedDate)
      .replace(/{{cust_po_no}}/g, po_number || "")
      .replace(/{{outletItems}}/g, outletItems)
      .replace(/{{sub_total}}/g, `₹${subTotalBeforeTax.toFixed(2)}`)
      .replace(/{{auditorRow}}/g, auditorRow)
      .replace(/{{auditorFee}}/g, auditorFee)
      .replace(/{{overallTotal}}/g, `₹${overallTotal.toFixed(2)}`)
      .replace(/{{totalInWords}}/g, `${totalInWords} rupees`)
      .replace(/{{field_executive_name}}/g, field_executive_name)
      .replace(/{{team_leader_name}}/g, team_leader_name)
      .replace(/{{proposal_number}}/g, proposal_number)
      .replace(/{{place_of_supply}}/g, place_of_supply)
      .replace(/{{pincode}}/g, pincode)
      .replace(/{{gst_number}}/g, gst_number)
      .replace(/{{tax}}/g, tax)
      .replace(/{{contact_number}}/g, contact_number)
      .replace(/{{email}}/g, email)
      .replace(/{{gstin}}/g, gstin)
      .replace(/{{pan}}/g, pan)
      .replace(/{{account_holder_name}}/g, account_holder_name)
      .replace(/{{account_number}}/g, account_number)
      .replace(/{{bank_name}}/g, bank_name)
      .replace(/{{branch_name}}/g, branch_name)
      .replace(/{{ifsc_code}}/g, ifsc_code)
      .replace(/{{micr_code}}/g, micr_code)
      .replace(
        /{{company_address}}/g,
        `${company_address.line1}, ${company_address.line2}, ${company_address.city}, ${company_address.state} - ${company_address.pincode}`
      );

    // Launch browser using helper
    browser = await launchBrowser();

    const page = await browser.newPage();

    const baseUrl = `file://${__dirname}/templates/`;
    await page.setContent(dynamicContent, {
      waitUntil: "domcontentloaded",
      baseUrl,
    });

    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });

    if (req.query.download === "true") {
      const cleanFboName = fbo_name
        .trim()
        .replace(/[^a-zA-Z0-9 ]/g, "") // remove special chars
        .replace(/\s+/g, "-"); // spaces → dash

      const fileName = `${invoice_number}_${cleanFboName}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );

      console.log("Pdf file send to frontend");
      return res.send(pdfBuffer);
    }

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
    //   subject: "Invoice Document",
    //   html: message,
    //   attachments: [
    //     {
    //       filename: `invoice-${invoice_number}.pdf`,
    //       content: pdfBuffer,
    //       encoding: "base64",
    //     },
    //   ],
    // };

    // const info = await transporter.sendMail(mailOptions);
    // console.log("Email sent:", info.response);

    const sendersEmail = process.env.ACCOUNTER_EMAIL;
    // const sendersEmail = process.env.SENDERS_EMAIL;
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
    const finalMessage = `${message}${emailSignature}`;

    const cleanFboName = fbo_name
      .trim()
      .replace(/[^a-zA-Z0-9 ]/g, "") // remove special chars
      .replace(/\s+/g, "-"); // spaces → dash

    const mail = new MailComposer({
      from: `"Unavar Food Inspection and Certification Private Limited" <${sendersEmail}>`,
      to,
      cc,
      subject: "Invoice Document",
      html: finalMessage,
      attachments: [
        {
          filename: `${invoice_number}_${cleanFboName}.pdf`,
          content: pdfBuffer,
          encoding: "base64",
        },
      ],
    });

    const rawMessage = await new Promise((resolve, reject) => {
      mail.compile().build((err, message) => {
        if (err) return reject(err);
        resolve(message); // This will be a Buffer
      });
    });

    const command = new SendRawEmailCommand({
      RawMessage: {
        Data: rawMessage,
      },
    });

    const response = await sesClient.send(command);

    await Invoice.findByIdAndUpdate(invoiceId, {
      status: "Unpaid",
      mail_status: "Mail Sent",
    });

    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Error generating PDF or sending email:", error);
    res.status(500).send("Internal Server Error");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
