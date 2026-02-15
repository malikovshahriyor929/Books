import e from "express";
import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import globalController from "../controllers/global.controller.js";

const router = express.Router();

router.get("/profile", authMiddleware, globalController.profile);
router.get("/lookup", globalController.lookupBooks);
router.get("/lookup/:category", globalController.lookupBooks);
router.get("/lookup/:category/:status", globalController.lookupBooks);

export default router;
