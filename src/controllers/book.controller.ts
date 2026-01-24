import type e from "express";
import BaseError from "../errors/auth.errors.js";
import bookService from "../services/books/book.service.js";

class BookController {
  async getBooks(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      //   const { page, perPage, search, sort } = req.params;
      //   const pageNum = Number(page) || 1;
      //   const perPageNum = Number(perPage) || 10;

      //   if (!Number.isFinite(pageNum) || pageNum < 1) throw new Error("Invalid page");
      //   if (!Number.isFinite(perPageNum) || perPageNum < 1)
      //     throw new Error("Invalid perPage");

      //   const result = await bookService.getBooks(
      //     pageNum,
      //     perPageNum,
      //     search?.toString(),
      //     sort?.toString(),
      //   );

      const { page, per_page, search, sort } = req.query;

      const pageNum = Number(page ?? 1);
      const perPageNum = Number(per_page ?? 10);

      if (!Number.isFinite(pageNum) || pageNum < 1)
        throw new Error("Invalid page");
      if (!Number.isFinite(perPageNum) || perPageNum < 1)
        throw new Error("Invalid per_page");

      const result = await bookService.getBooks(
        pageNum,
        perPageNum,
        search ? String(search) : undefined,
        sort ? String(sort) : undefined,
      );

      res
        .status(200)
        .json({ message: "Books fetched successfully", data: result });
    } catch (error) {
      next(
        BaseError.badRequest(
          "Get books failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }
}

export default new BookController();
