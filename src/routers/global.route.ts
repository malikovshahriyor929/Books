import e from "express";
import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import globalController from "../controllers/global.controller.js";

const router = express.Router();

router.get("/profile", authMiddleware, globalController.profile);

export default router;
