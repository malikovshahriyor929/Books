import e from "express";
import express from "express";
import bookController from "../controllers/book.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();
router.get("/get-books",authMiddleware, bookController.getBooks);
router.get("/get-book/:id", authMiddleware, bookController.getBookDetails);
router.get("/get-book-author/:id",authMiddleware, bookController.getBookAuthtorDetails);
router.post("/buy-book", authMiddleware, bookController.buyBook);
router.post("/rent-book",authMiddleware, bookController.rentBook);
router.get("/my-books", authMiddleware, bookController.myBooks );
router.get("/my-rent-books", authMiddleware, bookController.myRentedBooks );
// get book chapters
router.get("/chapters/:bookId",authMiddleware, bookController.getChapters);
router.get("/chapters/:bookId/:orderId", bookController.getChapterOrder);

router.post("/create-book", authMiddleware, bookController.createBook);
router.put("/edit-book/:id",authMiddleware,bookController.editBook );
// router.delete("/delete-book/:id",authMiddleware,bookController.deleteBook );
router.post("/create-chapter/:bookId", authMiddleware, bookController.createChapterOrder);
router.put("/put-chapter/:bookId/:chapterId", authMiddleware, bookController.editChapter);


export default router;
