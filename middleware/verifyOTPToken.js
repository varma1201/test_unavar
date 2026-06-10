// middleware/verifyOTPToken.js
import jwt from "jsonwebtoken";

const OTP_SECRET = process.env.OTP_SECRET || "arun@321";
console.log(OTP_SECRET ,"verify otp secret key");

export const verifyOTPToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authorization token missing" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, OTP_SECRET);
    // decoded should contain { userId: "..."} from verifyOTP controller
    req.userId = decoded.userId?.toLowerCase?.() || decoded.userId;
    next();
  } catch (error) {
    console.error("Invalid or expired token:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
