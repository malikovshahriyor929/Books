import express from "express";
import authorController from "../controllers/author.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
const router = express.Router();

router.get("/get-authors/:id", authMiddleware, authorController.getAuthor);
// router.get("/get-author/:id", authorController.getAuthorDetails);
// router.post("/create-author", authorController.createAuthor);
// router.put("/edit-author/:id", authorController.editAuthor);
// router.delete("/delete-author/:id", authorController.deleteAuthor);

export default router;
