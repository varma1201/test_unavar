import express from "express";
import {
  registerUser,
  loginUser,
  forgotPassword,
  verifyOTP,
  setNewPassword,
  fetchAllUsers,
  fetchAllRepresentatives,
  deleteFields,
  getUserById,
  updateUser,
} from "../controller/authController.js";
import { verifyOTPToken } from "../middleware/verifyOTPToken.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

router.post("/registerUser", upload.single("signature"), registerUser);
router.post("/login", loginUser);
router.post("/forgotPassword", forgotPassword);
router.post("/verifyOtp", verifyOTP);
router.post("/setNewPassword", verifyOTPToken, setNewPassword);
router.get("/getAllUsers", fetchAllUsers);
router.get("/getAllRepresentatives", fetchAllRepresentatives);
router.delete("/deleteFields", deleteFields);
router.get("/getUserById/:userId", getUserById);
router.put("/updateUser/:userId", upload.single("signature"), updateUser);

router.get("/protected", verifyToken, (req, res) => {
  console.log(req.user);
  res.status(200).json({
    message: "This is a protected route",
    user: {
      userName: req.user.userName,
      userId: req.user.userId,
      roles: req.user.roles,
      role: req.user.role, // Current loggined Role
      _id: req.user._id,
    },
  });
});

export default router;
