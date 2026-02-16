import type e from "express";
import BaseError from "../errors/auth.errors.js";
import { prisma } from "../services/prisma.js";

class AuthorController {

    async getAuthor(req: e.Request, res: e.Response, next: e.NextFunction) {
        try {
            const { id } = req.params;
            const result = await prisma.user.findUnique({
                where: { id: id as string },
            });
            return res.status(200).json(result);
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