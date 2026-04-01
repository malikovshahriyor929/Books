import type e from "express";
import BaseError from "../errors/auth.errors.js";
import { prisma } from "../services/prisma.js";
import userDto from "../dtos/auth.dto.js";

class AuthorController {
  async getAuthor(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
      const { id } = req.params;
      const result = await prisma.user.findUnique({
        where: { id: id as string },
      });
      const bookCount = await prisma.book.count({
        where: { authorId: id as string },
      });
      const is_saved = Boolean(await prisma.save.findFirst({
        where: {
          userId: id as string,
        },
      }));
      const resDto = new userDto(result);
      return res.status(200).json({ ...resDto, bookCount,is_saved });
    } catch (error) {
      next(
        BaseError.badRequest(
          "Get author failed",
          (error as Error).message || "Unknown error",
        ),
      );
    }
  }
}

export default new AuthorController();
