// import puppeteer from "puppeteer";
import { promises as fs } from "fs";
import path from "path";
import nodemailer from "nodemailer";
import moment from "moment";
import Agreement from "../models/agreementModel.js"; // Ensure your model is properly named and imported
import { chromium } from "playwright";
import {
  SESClient,
  SendEmailCommand,
  SendRawEmailCommand,
} from "@aws-sdk/client-ses";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { PDFDocument, rgb } from "pdf-lib";

const __dirname = path.resolve();

const sesClient = new SESClient({
  region: process.env.AWS_REGION, // Change to your SES region
  credentials: {
    accessKeyId: process.env.AWS_SMTP_LOGIN,
    secretAccessKey: process.env.AWS_SMTP_SECRET_KEY,
  },
});

export const generateagreement = async (req, res) => {
  let browser = null;
  try {
    const { agreementId } = req.params;
    const { to, cc, message } = req.body;

    // Fetch agreement details
    const agreementDetails = await Agreement.findById(agreementId).exec();
    if (!agreementDetails) {
      return res.status(404).send("Agreement not found");
    }

    const {
      fbo_name,
      from_date,
      to_date,
      period,
      total_cost,
      address,
      no_of_outlets,
    } = agreementDetails;

    console.log(agreementDetails, "here is agreement");

    const numberOfOutlets = agreementDetails.outlets?.reduce(
      (acc, item) => acc + item.quantity,
      0
    );

    // Format dates
    const formattedFromDate = moment(from_date).format("DD/MM/YYYY");
    const formattedToDate = moment(to_date).format("DD/MM/YYYY");

    // Read HTML template and image concurrently
    const [htmlTemplate, imageData, signatureImageData] = await Promise.all([
      fs.readFile(path.join(__dirname, "templates", "agreement.html"), "utf-8"),
      fs.readFile(path.join(__dirname, "templates", "logo2.png"), {
        encoding: "base64",
      }),
      fs.readFile(
        path.join(__dirname, "templates", "invoice_signature_image.png"),
        {
          encoding: "base64",
        }
      ),
    ]);

    const service = agreementDetails.outlets[0].description;

    // Inject dynamic data into HTML template
    const dynamicContent = htmlTemplate
      .replace(/{{fbo_name}}/g, fbo_name)
      .replace(/{{imageData}}/g, imageData)
      .replace(/{{signatureImage}}/g, signatureImageData)
      .replace(/{{address}}/g, address)
      .replace(/{{total_cost}}/g, total_cost)
      .replace(/{{from_date}}/g, formattedFromDate)
      .replace(/{{to_date}}/g, formattedToDate)
      .replace(/{{no_of_outlets}}/g, numberOfOutlets)
      .replace(/{{service}}/g, service)
      .replace(/{{period}}/g, period);

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
    const baseUrl = `file://${__dirname}/templates/`;
    await page.setContent(dynamicContent, {
      waitUntil: "networkidle0",
      baseUrl,
    });

    // Generate PDF

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      margin: {
        top: "140px",
        bottom: "40px",
        left: "40px",
        right: "40px",
      },
      headerTemplate: `
  <style>
    .header {
        font-size: 16px;
      width: 100%;
        padding: 0 20px;
      box-sizing: border-box;
    }
    .header table {
      width: 100%;
      border-bottom: 1px solid black;
      border-collapse: collapse;
    }
    .header td {
      vertical-align: top;
    }
    .logo {
      height: 25px;
    }
    th, td {
      border: 1px solid black;
      border-collapse: collapse;
    }
    
 
  </style>
  <div class="header">
      <table>
      <tr>
        <td style="width: 20%; text-align: center; vertical-align: middle; border: 1px solid black;">
          <img 
            class="logo" 
            src="data:image/png;base64,${imageData}" 
            style="width: 80px; height: auto; object-fit: contain; display: block; margin: 0 auto;" 
          />
        </td>

        <td style="width: 55%; text-align: center; vertical-align: middle;">
          <strong>AUDIT AGREEMENT</strong><br />
          AUDIT.REC.AMT.02
        </td>
        <td style="width: 25%; text-align: left;">
          <div style="padding:4px; font-size:12px;">Issue Date: 18.08.2025</div>
          <div style="display: flex; align-items: center; border-top: 1px solid black; border-bottom: 1px solid black;">
            <div style="flex: 1; border-right: 0px solid black; font-size:12px; padding: 4px;">Version No: 5</div>
          </div>
            <div  style="padding-left: 4px; padding-right: 4px; padding-top: 4px; font-size:12px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
        </td>
      </tr>
    </table>
  </div>
  `,
      footerTemplate: `<div style="font-size: 8px; text-align: center; width: 100%;padding: 20px 0px;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
    });

    // --- Add black border around every page using pdf-lib ---
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    const margin = 15; // ≈12 mm white space around all sides
    const borderWidth = 1; // thickness of the frame line

    pages.forEach((page) => {
      const { width, height } = page.getSize();
      // Draw border rectangle (1.5px line inside the page area)
      page.drawRectangle({
        x: margin, // left margin
        y: margin, // bottom margin
        width: width - margin * 2, // inner width
        height: height - margin * 2, // inner height
        borderColor: rgb(0, 0, 0),
        borderWidth: borderWidth,
      });
    });

    const borderedPdfBuffer = await pdfDoc.save();

    if (req.query.download === "true") {
      const cleanFboName = fbo_name
        .trim()
        .replace(/[^a-zA-Z0-9 ]/g, "") // remove special chars
        .replace(/\s+/g, "-");

      const fileName = `${cleanFboName}_Agreement.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );

      console.log("Pdf file send to frontend");
      return res.send(Buffer.from(borderedPdfBuffer));
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
    //   port: process.env.SES_PORT,
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
    //   subject: "Agreement Document",
    //   html: message,
    //   attachments: [
    //     {
    //       filename: `agreement-${agreementId}.pdf`,
    //       content: pdfBuffer,
    //       encoding: "base64",
    //     },
    //   ],
    // };

    // Send email and update agreement status
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
      .replace(/\s+/g, "-");

    const mail = new MailComposer({
      from: `"Unavar Food Inspection and Certification Private Limited" <${sendersEmail}>`,
      to,
      cc,
      subject: "Agreement Document",
      html: finalMessage,
      attachments: [
        {
          filename: `${cleanFboName}_Agreement.pdf`,
          content: borderedPdfBuffer,
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

    await Agreement.findByIdAndUpdate(agreementId, { status: "Mail Sent" });

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
