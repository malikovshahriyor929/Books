import type e from "express";
import BaseError from "../errors/auth.errors.js";
import { prisma } from "../services/prisma.js";

class GlobalController {
  async profile(req: e.Request, res: e.Response, next: e.NextFunction) {
    try {
        const userId = req.user?.id as string | undefined;

        if (!userId) {
          return next(BaseError.UnauthorizedError());
        }
        const result = await prisma.user.findUnique({
          where: { id: userId },
        });
        return res.status(200).json(result);
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

export default new GlobalController();