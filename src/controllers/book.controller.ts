import type e from "express";
import BaseError from "../errors/auth.errors.js";
import bookService from "../services/books/book.service.js";
import { prisma } from "../services/prisma.js";
import { AccessType } from "../generated/prisma/enums.js";

class BookController {
  async getBooks(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const { page, per_page, search } = req.query;
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
      );

      res.status(200).json({
        message: "Books fetched successfully",
        data: result,
        _meta: { page: pageNum, per_page: perPageNum, total: result.length },
      });
    } catch (error) {
      next(
        BaseError.badRequest(
          "Get books failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }
  async getBookDetails(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const { id } = req.params;

      const result = await bookService.getBookDetails(id as string);

      if (result) {
        res.status(200).json({
          message: "Book fetched successfully",
          data: result,
        });
      } else {
        res.status(404).json({
          message: "Book not found",
        });
      }
    } catch (error) {
      next(BaseError.badRequest("Get book failed", (error as Error).message));
    }
  }
  async getBookAuthtorDetails(
    req: e.Request,
    res: e.Response,
    next: e.NextFunction,
  ) {
    try {
      const { id } = req.params;

      const result = await bookService.getBookAuthtorDetails(id as string);

      if (result) {
        res.status(200).json({
          message: "Book fetched successfully",
          data: result,
        });
      } else {
        res.status(404).json({
          message: "Book not found",
        });
      }
    } catch (error) {
      next(BaseError.badRequest("Get book failed", (error as Error).message));
    }
  }

  async buyBook(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const { bookId } = req.body;
      const userId = req.user?.id as string | undefined;

      if (!bookId) {
        return next(
          BaseError.badRequest("Buy book failed", "bookId is required"),
        );
      }

      if (!userId) {
        return next(BaseError.UnauthorizedError());
      }

      const result = await bookService.buyBook(bookId, userId);
      return res.status(200).json(result);
    } catch (error) {
      next(
        BaseError.badRequest(
          "Buy book failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }
  async myBooks(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const userId = req.user?.id as string | undefined;

      if (!userId) {
        return next(BaseError.UnauthorizedError());
      }

      const now = new Date();

      // Clean up expired rentals for this user
      await prisma.bookAccess.deleteMany({
        where: {
          userId,
          accessType: AccessType.RENTED,
          endAt: { lt: now },
        },
      });

      const result = await prisma.book.findMany({
        where: {
          accesses: {
            some: {
              userId,
              OR: [{ endAt: null }, { endAt: { gt: now } }],
            },
          },
        },
        include: {
          accesses: {
            where: { userId, OR: [{ endAt: null }, { endAt: { gt: now } }] },
            select: { accessType: true, startAt: true, endAt: true },
          },
        },
      });

      return res.status(200).json(result);
    } catch (error) {
      next(
        BaseError.badRequest(
          "Get my books failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }

  async rentBook(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const { bookId, period } = req.body;
      const userId = req.user?.id as string | undefined;

      if (!bookId) {
        return next(
          BaseError.badRequest("Buy book failed", "bookId is required"),
        );
      }

      if (!userId) {
        return next(BaseError.UnauthorizedError());
      }

      const result = await bookService.rentBook(bookId, userId, period);
      return res.status(200).json(result);
    } catch (error) {
      next(
        BaseError.badRequest(
          "Buy book failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }
}

export default new BookController();
