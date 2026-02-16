import { prisma } from "../prisma.js";
import {
  AccessType,
  BookStatus,
  Monetization,
  OrderStatus,
  OrderType,
} from "../../generated/prisma/enums.js";
import BaseError from "../../errors/auth.errors.js";

class BookService {
  async getBooks(
    page: number,
    per_page: number,
    search?: string,
    sort?: string,
    category?: string,
  ) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safePerPage =
      Number.isFinite(per_page) && per_page > 0 ? Math.floor(per_page) : 10;

    const skip = (safePage - 1) * safePerPage;
    const take = safePerPage;

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        {
          author: {
            is: { name: { contains: search, mode: "insensitive" } },
          },
        },
      ];
    }

    if (category) {
      where.category = { equals: category, mode: "insensitive" };
    }

    const orderBy: any = sort
      ? {
          [sort.replace("-", "")]: sort.startsWith("-") ? "desc" : "asc",
        }
      : { createdAt: "desc" };

    const books = await prisma.book.findMany({
      where,
      orderBy,
      skip,
      take,
    });
    return books;
  }
  async getBookDetails(id: string) {
    const book = await prisma.book.findUnique({
      where: { id },
    });
    return book;
  }
  async getBookAuthtorDetails(id: string) {
    const book = await prisma.book.findUnique({
      where: { id },
      // include: {
      //   author: true,
      // },
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
  async editChapter(chapterId: string,  bookId: string, body: any) {
    if (!chapterId) throw new Error("Order id missing");
    if (!bookId) throw new Error("Authour id missing");
    const chapter = await prisma.chapter.findFirst({
      where: {
        id:chapterId,
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
}

export default new BookService();
