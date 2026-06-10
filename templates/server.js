import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/dbConnect.js";
import cors from "cors";
import morgan from "morgan";
import bussinessRoutes from "./routes/bussinessRoutes.js";
import authenticatinRoutes from "./routes/authenticationRoutes.js";
import enquiryRoutes from "./routes/enquiryRoutes.js";
import proposalRoutes from "./routes/proposalRoutes.js";
import agreementRoutes from "./routes/agreementRoutes.js";

// Configure environment variables
dotenv.config();

// Connect to database and start server
connectDB();

// Create Express app
const app = express();

// Middleware setup
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

// API routes
app.use("/api/", bussinessRoutes);
app.use("/api/enquiry", enquiryRoutes);
app.use("/api/proposal", proposalRoutes);
app.use("/api/agreement", agreementRoutes);
app.use("/api/auth", authenticatinRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// Port
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
