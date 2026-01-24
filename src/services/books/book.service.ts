import { prisma } from "../prisma.js";

class BookService {
  async getBooks(
    page: number,
    per_page: number,
    search?: string,
    sort?: string,
  ) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safePerPage =
      Number.isFinite(per_page) && per_page > 0 ? Math.floor(per_page) : 10;


    const skip = (safePage - 1) * safePerPage;
    const take = safePerPage;

    const where: any = search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { author: { is: { name: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {};

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
}

export default new BookService();
