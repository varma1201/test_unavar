import express from "express";
import multer from "multer";
import {
  CreateCmsCard,
  createWebsiteEnquiry,
  DeleteCmsCard,
  removeWebsiteEnquiry,
  ShowCmsCards,
  showWebsiteEnquires,
  UpdateCmsCard,
} from "../controller/websiteEnquiresController.js";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/contact-us", createWebsiteEnquiry);
router.get("/contact-users", showWebsiteEnquires);
router.patch("/remove-enquiry", removeWebsiteEnquiry);

//website CMS Routes

router.post("/create-cms-card", upload.single("imageUrl"), CreateCmsCard);
router.patch("/update-cms-card/:id", upload.single("imageUrl"), UpdateCmsCard);
router.get("/show-cms-cards", ShowCmsCards);
router.delete("/delete-cms-card/:id", DeleteCmsCard);

// /api/marketingwebsite/create-cms-card
// /api/marketingwebsite/update-cms-card/:id
// /api/marketingwebsite/show-cms-cards
// /api/marketingwebsite//delete-cms-card/:id

export default router;
