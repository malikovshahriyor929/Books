import e from "express";
import express from "express";
import bookController from "../controllers/book.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();
router.get("/get-books", bookController.getBooks);
router.get("/get-book/:id", authMiddleware, bookController.getBookDetails);
router.get("/get-book-author/:id", bookController.getBookAuthtorDetails);
router.post("/buy-book", authMiddleware, bookController.buyBook);
router.post("/rent-book",authMiddleware, bookController.rentBook);
router.get("/my-books", authMiddleware, bookController.myBooks )

export default router;
