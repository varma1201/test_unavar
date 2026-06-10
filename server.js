process.env.TZ = "Asia/Kolkata";

import dotenv from "dotenv";
// Configure environment variables
dotenv.config();
console.log("ENV CHECK:", process.env.JWT_SECRET);


import express from "express";
import connectDB from "./config/dbConnect.js";
import cors from "cors";
import morgan from "morgan";
import bussinessRoutes from "./routes/bussinessRoutes.js";
import authenticatinRoutes from "./routes/authenticationRoutes.js";
import enquiryRoutes from "./routes/enquiryRoutes.js";
import proposalRoutes from "./routes/proposalRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import agreementRoutes from "./routes/agreementRoutes.js";
import auditorRoutes from "./routes/auditorRoutes.js";
import settingRoutes from "./routes/settingRoutes.js";
import workLogRoutes from "./routes/workLogRoutes.js";
import summaryRoutes from "./routes/summaryRoutes.js";
import MarketingWebsiteRouts from "./routes/MarketingWebsiteRoutes.js";

import cron from "node-cron";
import {
  runCarryForwardForAllUsers,
  resetFinancialYearLeave,
} from "./controller/workLogController.js";

import path from "path";
import { fileURLToPath } from "url";
import paymentRoutes from "./routes/paymentRoutes.js";



// cron.schedule("1 0 1 * *", async () => {
//   console.log("⏰ Running monthly carry forward...");
//   await runCarryForwardForAllUsers();
// });

cron.schedule(
  "1 0 1 4 *",
  async () => {
    console.log("📅 Yearly financial leave reset running...");
    await resetFinancialYearLeave();
  },
  {
    timezone: "Asia/Kolkata",
  }
);

// Create Express app
const app = express();

// Get current filename and directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// // Serve React app
app.use(express.static(path.join(__dirname, "./client/build")));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Connect to database and start server
connectDB();

// Middleware setup
app.use(express.json());
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://192.168.0.227:3000',
    'https://pragati-v1.netlify.app',
    'http://unavar-admin.s3-website.ap-south-1.amazonaws.com',
    'https://admin.unavar.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));
app.use(morgan("dev"));

// app.get((req, res) => {
//   res.send("<h1>welcome to unaver</h1>");
// });

// API routes
app.use("/api/", bussinessRoutes);
app.use("/api/enquiry", enquiryRoutes);
app.use("/api/proposal", proposalRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/agreement", agreementRoutes);
app.use("/api/auth", authenticatinRoutes);
app.use("/api/auditor", auditorRoutes);
app.use("/api/setting", settingRoutes);
app.use("/api/worklogs", workLogRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/summary", summaryRoutes);

// marketing website routes
app.use("/api/marketingwebsite", MarketingWebsiteRouts);


app.use("/", function (req, res) {
  res.send(`<h1 style="text-align:center">Welcome to Unavar</h1>`);
});

// All other routes (non-API routes) go to React app
app.use("*", (req, res) => {
  res.status(404).json({ error: "API Route Not Found" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// Port
const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.bgGreen
      .white
  );
});
