import { prisma } from "../prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import {
  AccessType,
  BookStatus,
  type BookStatus as BookStatusValue,
  Monetization,
  OrderStatus,
  OrderType,
} from "../../generated/prisma/enums.js";
import BaseError from "../../errors/auth.errors.js";

const publicAuthorSelect = {
  id: true,
  name: true,
  avatar: true,
  authorProfile: {
    select: {
      penName: true,
      bio: true,
      avatarUrl: true,
    },
  },
};

type GetBooksParams = {
  page: number;
  perPage: number;
  search?: string | undefined;
  sort?: string | undefined;
  category?: string | undefined;
  status?: string | undefined;
  language?: string | undefined;
  minPages?: number | undefined;
  maxPages?: number | undefined;
};

const filterStatusMap: Record<string, BookStatusValue | "ALL"> = {
  all: "ALL",
  barchasi: "ALL",
  draft: BookStatus.DRAFT,
  published: BookStatus.PUBLISHED,
  archived: BookStatus.ARCHIVED,
  tugallangan: BookStatus.ARCHIVED,
  completed: BookStatus.ARCHIVED,
  ongoing: BookStatus.PUBLISHED,
  davom_etmoqda: BookStatus.PUBLISHED,
};

function splitFilterValues(value?: string) {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBookStatus(status?: string) {
  if (!status) return undefined;

  const normalizedStatus = status.trim().toLowerCase().replace(/\s+/g, "_");
  const mappedStatus = filterStatusMap[normalizedStatus];

  if (!mappedStatus) {
    const validStatuses = Object.keys(filterStatusMap).join(", ");
    throw new Error(`Invalid status. Allowed values: ${validStatuses}`);
  }

  return mappedStatus === "ALL" ? undefined : mappedStatus;
}

function buildStringFilter(
  field: "category" | "language",
  values: string[],
): Prisma.BookWhereInput | undefined {
  if (!values.length) return undefined;

  return {
    OR: values.map((value) => ({
      [field]: { equals: value, mode: "insensitive" },
    })),
  } as Prisma.BookWhereInput;
}

function mapBookWithChapterCount<T extends { _count: { chapters: number } }>(
  book: T,
) {
  const { _count, ...rest } = book;

  return {
    ...rest,
    chapterCount: _count.chapters,
  };
}

class BookService {
  async getBooks(params: GetBooksParams) {
    const safePage =
      Number.isFinite(params.page) && params.page > 0
        ? Math.floor(params.page)
        : 1;
    const safePerPage =
      Number.isFinite(params.perPage) && params.perPage > 0
        ? Math.floor(params.perPage)
        : 10;

    const skip = (safePage - 1) * safePerPage;
    const take = safePerPage;
    const minPages =
      params.minPages != null
        ? Math.max(0, Math.floor(params.minPages))
        : undefined;
    const maxPages =
      params.maxPages != null
        ? Math.max(0, Math.floor(params.maxPages))
        : undefined;

    if (minPages != null && maxPages != null && minPages > maxPages) {
      throw new Error("min_pages cannot be greater than max_pages");
    }

    const where: Prisma.BookWhereInput = {};
    const andFilters: Prisma.BookWhereInput[] = [];

    if (params.search) {
      andFilters.push({
        OR: [
          {
            title: { contains: params.search, mode: "insensitive" },
          },
          {
            description: {
              contains: params.search,
              mode: "insensitive",
            },
          },
          {
            author: {
              is: { name: { contains: params.search, mode: "insensitive" } },
            },
          },
        ],
      });
    }

    const categoryFilter = buildStringFilter(
      "category",
      splitFilterValues(params.category),
    );
    if (categoryFilter) {
      andFilters.push(categoryFilter);
    }

    const languageFilter = buildStringFilter(
      "language",
      splitFilterValues(params.language),
    );
    if (languageFilter) {
      andFilters.push(languageFilter);
    }

    const statusFilter = normalizeBookStatus(params.status);
    if (statusFilter) {
      andFilters.push({ status: statusFilter });
    }

    if (andFilters.length) {
      where.AND = andFilters;
    }

    const orderBy: Prisma.BookOrderByWithRelationInput = params.sort
      ? ({
          [params.sort.replace("-", "")]: params.sort.startsWith("-")
            ? "desc"
            : "asc",
        } as Prisma.BookOrderByWithRelationInput)
      : { createdAt: "desc" };

    const queryOptions = {
      where,
      orderBy,
      include: {
        author: {
          select: publicAuthorSelect,
        },
        _count: {
          select: {
            chapters: true,
          },
        },
      },
    } satisfies Prisma.BookFindManyArgs;

    if (minPages != null || maxPages != null) {
      const books = await prisma.book.findMany(queryOptions);
      const filteredBooks = books.filter((book) => {
        if (minPages != null && book._count.chapters < minPages) return false;
        if (maxPages != null && book._count.chapters > maxPages) return false;

        return true;
      });

      return {
        books: filteredBooks
          .slice(skip, skip + take)
          .map(mapBookWithChapterCount),
        total: filteredBooks.length,
      };
    }

    const [total, books] = await Promise.all([
      prisma.book.count({ where }),
      prisma.book.findMany({
        ...queryOptions,
        skip,
        take,
      }),
    ]);

    return {
      books: books.map(mapBookWithChapterCount),
      total,
    };
  }
  async getBookDetails(id: string, userId?: string) {
    const book = await prisma.book.findUnique({
      where: { id },
    });
    const is_Author = book?.authorId === userId;

    return { ...book, is_Author };
  }
  async getBookAuthtorDetails(id: string) {
    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        author: {
          select: publicAuthorSelect,
        },
      },
    });
    console.log(id);

    return book;
  }
  async buyBook(bookId: string, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const book = await tx.book.findUnique({
        where: { id: bookId },
        select: {
          id: true,
          authorId: true,
          status: true,
          monetization: true,
          buyPriceCents: true,
          currency: true,
        },
      });
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, balanceCents: true },
      });
      if (!book) {
        throw new Error("Book not found");
      }
      if (!user) {
        throw new Error("User not found");
      }
      if (book.authorId == userId) {
        throw new Error("Authors cannot purchase their own books");
      }
      if (book.status !== BookStatus.PUBLISHED) {
        throw new Error("Book is not available for purchase");
      }
      if (book.monetization === Monetization.FREE) {
        throw new Error("Book is free and cannot be purchased");
      }
      if (book.buyPriceCents == null) {
        throw new Error("Book price is not configured");
      }
      if (book.buyPriceCents > user.balanceCents) {
        throw new Error(
          "User does not have enough balance to purchase the book",
        );
      }
      if (user.balanceCents < 0 || user.balanceCents === 0) {
        throw new Error("User balance is negative");
      }

      if (book.monetization == "RENT_ONLY") {
        throw new Error(
          `This book cannot be purchased with ${book.monetization === "RENT_ONLY" && "Only rent"}!`,
        );
      }

      const updateUser = await tx.user.update({
        where: { id: userId },
        data: { balanceCents: { decrement: book.buyPriceCents } },
        select: { id: true, balanceCents: true },
      });
      if (!updateUser) {
        throw new Error("User not found");
      }
      const isExistingAccess = await tx.bookAccess.findFirst({
        where: {
          userId,
          bookId,
        },
      });
      if (isExistingAccess) {
        throw new Error("User already has access to the book");
      }
      const order = await tx.order.create({
        data: {
          userId,
          bookId,
          type: OrderType.BUY,
          status: OrderStatus.PAID,
          amountCents: book.buyPriceCents,
          currency: book.currency,
          provider: "WALLET",
          paidAt: new Date(),
        },
      });
      const access = await tx.bookAccess.create({
        data: {
          userId,
          bookId,
          accessType: AccessType.PURCHASED,
          startAt: new Date(),
          orderId: order.id,
        },
      });
      return {
        message: "Book purchased successfully",
        order,
        access,
        balanceCents: updateUser.balanceCents,
      };
    });
    // return prisma.$transaction(async (tx) => {
    //   const [book, user] = await Promise.all([
    //     tx.book.findUnique({
    //       where: { id: bookId },
    //       select: {
    //         id: true,
    //         authorId: true,
    //         status: true,
    //         monetization: true,
    //         buyPriceCents: true,
    //         currency: true,
    //       },
    //     }),
    //     tx.user.findUnique({
    //       where: { id: userId },
    //       select: { id: true, balanceCents: true },
    //     }),
    //   ]);

    //   if (!book) {
    //     throw new Error("Book not found");
    //   }

    //   if (!user) {
    //     throw new Error("User not found");
    //   }

    //   if (book.authorId === userId) {
    //     throw new Error("Authors cannot purchase their own books");
    //   }

    //   if (book.status !== BookStatus.PUBLISHED) {
    //     throw new Error("Book is not available for purchase");
    //   }

    //   if (book.monetization === Monetization.FREE) {
    //     throw new Error("Book is free to read – no purchase required");
    //   }

    //   const canBePurchased =
    //     book.monetization === Monetization.BUY_ONLY ||
    //     book.monetization === Monetization.BUY_AND_RENT;

    //   if (!canBePurchased) {
    //     throw new Error("This book cannot be purchased");
    //   }

    //   if (book.buyPriceCents == null) {
    //     throw new Error("Book price is not configured");
    //   }

    //   const existingAccess = await tx.bookAccess.findFirst({
    //     where: {
    //       userId,
    //       bookId,
    //       accessType: AccessType.PURCHASED,
    //       endAt: null,
    //     },
    //   });

    //   if (existingAccess) {
    //     return {
    //       message: "Book already purchased",
    //       access: existingAccess,
    //       balanceCents: user.balanceCents,
    //     };
    //   }

    //   if (user.balanceCents < book.buyPriceCents) {
    //     throw new Error("Insufficient balance");
    //   }

    //   const updatedUser = await tx.user.update({
    //     where: { id: userId },
    //     data: { balanceCents: { decrement: book.buyPriceCents } },
    //     select: { id: true, balanceCents: true },
    //   });

    //   const order = await tx.order.create({
    //     data: {
    //       userId,
    //       bookId,
    //       type: OrderType.BUY,
    //       status: OrderStatus.PAID,
    //       amountCents: book.buyPriceCents,
    //       currency: book.currency,
    //       provider: "WALLET",
    //       paidAt: new Date(),
    //     },
    //   });

    //   const access = await tx.bookAccess.create({
    //     data: {
    //       userId,
    //       bookId,
    //       accessType: AccessType.PURCHASED,
    //       startAt: new Date(),
    //       orderId: order.id,
    //     },
    //   });

    //   return {
    //     message: "Book purchased successfully",
    //     order,
    //     access,
    //     balanceCents: updatedUser.balanceCents,
    //   };
    // });
  }
  async rentBook(bookId: string, userId: string, period: string) {
    const days = Number(period);
    if (!Number.isFinite(days) || days <= 0) {
      throw new Error("Rental period must be a positive number of days");
    }

    const now = new Date();
    const endAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return prisma.$transaction(async (tx) => {
      const book = await tx.book.findUnique({
        where: { id: bookId },
        select: {
          id: true,
          authorId: true,
          status: true,
          monetization: true,
          rentPriceCents: true,
          currency: true,
        },
      });
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, balanceCents: true },
      });

      if (!book) {
        throw new Error("Book not found");
      }
      if (!user) {
        throw new Error("User not found");
      }
      if (book.authorId === userId) {
        throw new Error("Authors cannot rent their own books");
      }
      if (book.status !== BookStatus.PUBLISHED) {
        throw new Error("Book is not available for rent");
      }
      const canRent =
        book.monetization === Monetization.RENT_ONLY ||
        book.monetization === Monetization.BUY_AND_RENT;
      if (!canRent) {
        throw new Error("This book cannot be rented");
      }
      if (book.rentPriceCents == null) {
        throw new Error("Book rent price is not configured");
      }

      const existingAccess = await tx.bookAccess.findFirst({
        where: {
          userId,
          bookId,
          accessType: AccessType.RENTED,
          OR: [{ endAt: null }, { endAt: { gt: now } }],
        },
      });
      if (existingAccess) {
        throw new Error("User already has rented access to the book");
      }

      if (user.balanceCents < book.rentPriceCents) {
        throw new Error("Insufficient balance");
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { balanceCents: { decrement: book.rentPriceCents } },
        select: { id: true, balanceCents: true },
      });

      const order = await tx.order.create({
        data: {
          userId,
          bookId,
          type: OrderType.RENT,
          status: OrderStatus.PAID,
          amountCents: book.rentPriceCents,
          currency: book.currency,
          provider: "WALLET",
          paidAt: now,
        },
      });

      const access = await tx.bookAccess.create({
        data: {
          userId,
          bookId,
          accessType: AccessType.RENTED,
          startAt: now,
          endAt,
          orderId: order.id,
        },
      });

      return {
        message: `Book rented for ${days} day(s)`,
        order,
        access,
        balanceCents: updatedUser.balanceCents,
      };
    });
  }
  async editBook(bookId: string, userId: string, body: any) {
    if (!userId) throw new Error("Authour id missing");
    if (!bookId) throw new Error("Book id missing");
    const userRole = await prisma.user.findFirst({
      where: {
        id: userId,
      },
    });
    if (!userRole) throw new Error("User not found");
    const book = await prisma.book.findFirst({
      where: {
        id: bookId,
      },
    });
    if (!book) throw new Error("Book not found");

    const updatedBook = await prisma.book.update({
      where: {
        id: bookId,
      },
      data: {
        title: body.title,
        language: body.language,
        category: body.category,
        status: body.status,
        // visibility: body.visibility,
        monetization: body.monetization,
        buyPriceCents: body.buyPriceCents,
        rentPriceCents: body.rentPriceCents,
        rentDurationDays: body.rentDurationDays,
        currency: body.currency,
        description: body.description,
        coverUrl: body.coverUrl,
      },
    });

    return updatedBook;
  }
  async getChapterOrder(bookId: string, orderId: string) {
    const currentOrder = Number(orderId);
    if (!Number.isFinite(currentOrder) || currentOrder < 1) {
      throw new Error("Invalid orderId");
    }

    const [chapter, prevChapter, nextChapter, total] = await Promise.all([
      prisma.chapter.findFirst({
        where: {
          bookId,
          order: currentOrder,
        },
      }),
      prisma.chapter.findFirst({
        where: {
          bookId,
          order: { lt: currentOrder },
        },
        orderBy: { order: "desc" },
        select: { order: true },
      }),
      prisma.chapter.findFirst({
        where: {
          bookId,
          order: { gt: currentOrder },
        },
        orderBy: { order: "asc" },
        select: { order: true },
      }),
      prisma.chapter.count({
        where: { bookId },
      }),
    ]);

    if (!chapter) throw new Error("Chapter not found");

    return {
      chapter,
      nav: {
        prev: prevChapter?.order ?? null,
        total,
        next: nextChapter?.order ?? null,
      },
    };
  }

  async createBook(userId: string, body: any) {
    if (!userId) throw new Error("Authour id missing");

    const newBook = await prisma.book.create({
      data: {
        title: body.title,
        language: body.language,
        category: body.category,
        status: body.status,
        visibility: body.visibility,
        monetization: body.monetization,
        buyPriceCents: body.buyPriceCents,
        rentPriceCents: body.rentPriceCents,
        rentDurationDays: body.rentDurationDays,
        currency: body.currency,
        description: body.description,
        coverUrl: body.coverUrl,
        authorId: userId,
      },
    });
    return newBook;
  }
  async createChapter(userId: string, body: any, bookId: string) {
    if (!userId) throw new Error("Authour id missing");
    const chapter = await prisma.chapter.findFirst({
      where: {
        bookId,
      },
      orderBy: {
        order: "desc",
      },
    });

    const newChapter = await prisma.chapter.create({
      data: {
        ...body,
        order: chapter ? chapter.order + 1 : 1,
        bookId,
      },
    });
    return newChapter;
  }
  async editChapter(chapterId: string, bookId: string, body: any) {
    if (!chapterId) throw new Error("Order id missing");
    if (!bookId) throw new Error("Authour id missing");
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        bookId,
        // order: Number(order),
      },
    });
    if (!chapter) throw new Error("Chapter not found");
    const updatedChapter = await prisma.chapter.update({
      where: {
        id: chapterId,
        bookId,
        // order: Number(order),
      },
      data: {
        ...body,
      },
    });
    return updatedChapter;
  }
  async saveBook(bookId: string, userId: string) {
    if (!userId) throw new Error("User id missing");
    if (!bookId) throw new Error("Book id missing");
    return prisma.$transaction(async (tx) => {
      const book = await tx.book.findUnique({
        where: { id: bookId },
        select: { id: true },
      });
      if (!book) {
        throw new Error("Book not found");
      }

      const existingSave = await tx.save.findUnique({
        where: {
          userId_bookId: {
            userId,
            bookId,
          },
        },
      });

      if (existingSave) {
        await tx.save.delete({
          where: {
            userId_bookId: {
              userId,
              bookId,
            },
          },
        });
        return { message: "Book unsaved" };
      }

      await tx.save.create({
        data: {
          userId,
          bookId,
        },
      });
      return { message: "Book saved" };
    });
  }
  async getSavedBooks(userId: string, page: number, per_page: number) {
    if (!userId) throw new Error("User id missing");
    const skip = (page - 1) * per_page;
    const take = per_page;
    const result = await prisma.book.findMany({
      where: {
        saves: {
          some: {
            userId,
          },
        },
      },
      skip,
      take,
    });
    const total = await prisma.book.count({
      where: {
        saves: {
          some: {
            userId,
          },
        },
      },
    });
    return { books: result, _meta: { page, per_page, total } };
  }
}

export default new BookService();
