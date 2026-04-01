import type e from "express";
import BaseError from "../errors/auth.errors.js";
import bookService from "../services/books/book.service.js";
import { prisma } from "../services/prisma.js";
import {
  AccessType,
  BookStatus,
  Monetization,
} from "../generated/prisma/enums.js";
import { ChapterDto } from "../dtos/book.dto.js";

class BookController {
  async getBooks(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const {
        page,
        per_page,
        perPage,
        search,
        sort,
        category,
        status,
        language,
      } = req.query;
      const minPagesRaw =
        req.query.minPages ??
        req.query.min_pages ??
        req.query.min_page ??
        req.query.pages_from ??
        req.query.page_from ??
        req.query.min_chapters;
      const maxPagesRaw =
        req.query.maxPages ??
        req.query.max_pages ??
        req.query.max_page ??
        req.query.pages_to ??
        req.query.page_to ??
        req.query.max_chapters;
      const pageNum = Number(page ?? 1);
      const perPageNum = Number(perPage ?? per_page ?? 10);
      const minPages = minPagesRaw != null ? Number(minPagesRaw) : undefined;
      const maxPages = maxPagesRaw != null ? Number(maxPagesRaw) : undefined;

      if (!Number.isFinite(pageNum) || pageNum < 1)
        throw new Error("Invalid page");
      if (!Number.isFinite(perPageNum) || perPageNum < 1)
        throw new Error("Invalid perPage");
      if (minPagesRaw != null && (!Number.isFinite(minPages!) || minPages! < 0))
        throw new Error("Invalid minPages");
      if (maxPagesRaw != null && (!Number.isFinite(maxPages!) || maxPages! < 0))
        throw new Error("Invalid maxPages");

      const result = await bookService.getBooks({
        page: pageNum,
        perPage: perPageNum,
        search: search ? String(search) : undefined,
        sort: sort ? String(sort) : undefined,
        category: category ? String(category) : undefined,
        status: status ? String(status) : undefined,
        language: language ? String(language) : undefined,
        minPages,
        maxPages,
      });

      res.status(200).json({
        message: "Books fetched successfully",
        data: result.books,
        _meta: {
          page: pageNum,
          perPage: perPageNum,
          per_page: perPageNum,
          total: result.total,
        },
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
      const userId = req.user?.id as string | undefined;

      const result = await bookService.getBookDetails(id as string, userId);

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
  async myRentedBooks(req: e.Request, res: e.Response, next: e.NextFunction) {
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

  async myBooks(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const userId = req.user?.id as string | undefined;
      const { page, per_page } = req.query;

      if (!page || !per_page) {
        return next(
          BaseError.badRequest(
            "Get my books failed",
            "page and per_page is required",
          ),
        );
      }

      if (!userId) {
        return next(BaseError.UnauthorizedError());
      }

      const pageNum = Number(page);
      const perPageNum = Number(per_page);

      const skip = (pageNum - 1) * perPageNum;
      const take = perPageNum;

      const total = await prisma.book.count({
        where: {
          authorId: userId,
        },
      });

      const result = await prisma.book.findMany({
        where: {
          authorId: userId,
        },
        skip,
        take,
      });

      return res.status(200).json({
        data: result,
        _meta: { page: pageNum, per_page: perPageNum, total },
      });
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
  async editBook(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const { id } = req.params;
      const body = req.body as FormData;
      // as {
      //   title: string;
      //   language: string;
      //   category: string;
      //   status: BookStatus;
      //   visibility: string;
      //   monetization: Monetization;
      //   buyPriceCents: number;
      //   rentPriceCents: number;
      //   rentDurationDays: number;
      //   currency: string;
      //   description: string;
      //   coverUrl: string;
      // };
      console.log(body);

      const result = await bookService.editBook(
        id as string,
        req.user.id,
        body,
      );
      res.status(200).json(result);
    } catch (error) {
      next(
        BaseError.badRequest(
          "Editing book failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }
  async getChapters(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const { bookId } = req.params;
      const { page, per_page } = req.query;

      if (!bookId) {
        return next(
          BaseError.badRequest("Get chapters failed", "bookId is required"),
        );
      }

      if (!page || !per_page) {
        return next(
          BaseError.badRequest(
            "Get chapters failed",
            "page and per_page are required",
          ),
        );
      }
      const pageNum = Number(page);
      const perPageNum = Number(per_page);

      if (!Number.isFinite(pageNum) || pageNum < 1)
        throw new Error("Invalid page");
      if (!Number.isFinite(perPageNum) || perPageNum < 1)
        throw new Error("Invalid per_page");

      const skip = (pageNum - 1) * perPageNum;
      const take = perPageNum;

      const result = await prisma.chapter.findMany({
        where: { bookId: bookId as string },
        orderBy: { order: "asc" },
        skip,
        take,
      });
      const total = await prisma.chapter.count({
        where: { bookId: bookId as string },
      });
      const resDto = result.map((chapter) => new ChapterDto(chapter));
      return res.status(200).json({
        data: resDto,
        _meta: {
          page: pageNum,
          per_page: perPageNum,
          total,
        },
      });
    } catch (error) {
      next(
        BaseError.badRequest(
          "Get chapters failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }
  async getChapterOrder(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const { bookId, orderId } = req.params;

      const result = await bookService.getChapterOrder(
        bookId as string,
        orderId as string,
      );
      return res.status(200).json(result);
    } catch (error) {
      next(
        BaseError.badRequest(
          "Get chapter failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }
  async createBook(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const userId = req.user?.id as string | undefined;

      if (!userId) {
        return next(BaseError.UnauthorizedError());
      }

      const body = req.body as FormData;
      const result = await bookService.createBook(userId, body);
      return res.status(200).json(result);
    } catch (error) {
      next(
        BaseError.badRequest(
          "Create book failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }
  async createChapterOrder(
    req: e.Request,
    res: e.Response,
    next: e.NextFunction,
  ) {
    try {
      const userId = req.user?.id as string | undefined;
      const body = req.body as FormData;
      const { bookId } = req.params;

      if (!userId) {
        return next(BaseError.UnauthorizedError());
      }

      const result = await bookService.createChapter(
        userId,
        body,
        bookId as string,
      );
      return res.status(200).json(result);
    } catch (error) {
      next(
        BaseError.badRequest(
          "Create chapter order failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }
  async editChapter(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const { bookId, chapterId } = req.params;

      const body = req.body as FormData;
      const result = await bookService.editChapter(
        chapterId as string,
        bookId as string,
        body,
      );
      return res.status(200).json(result);
    } catch (error) {
      next(
        BaseError.badRequest(
          "Edit chapter failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }
  async saveBook(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const { bookId } = req.params;
      const userId = req.user?.id as string | undefined;

      if (!userId) {
        return next(BaseError.UnauthorizedError());
      }

      const result = await bookService.saveBook(bookId as string, userId);
      return res.status(200).json(result);
    } catch (error) {
      next(
        BaseError.badRequest(
          "Save book failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }
  async getSavedBooks(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const userId = req.user?.id as string | undefined;
      const { page, per_page } = req.query as { page: string; per_page: string };

      if (!userId) {
        return next(BaseError.UnauthorizedError());
      }
      const result = await bookService.getSavedBooks(userId, +page, +per_page);
      return res.status(200).json(result);
    } catch (error) {
      next(
        BaseError.badRequest(
          "Get saved books failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }
}

export default new BookController();
