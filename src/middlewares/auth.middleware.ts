import type { NextFunction, Request, Response } from "express";
import BaseError from "../errors/auth.errors.js";
import tokenService from "../services/auth/token.service.js";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export default function (req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return next(BaseError.UnauthorizedError());
    const token = authHeader.split(" ")[1];
    if (!token) return next(BaseError.UnauthorizedError());
    const userData = tokenService.validateAccessToken(token);
    if (!userData) return next(BaseError.UnauthorizedError());
    req.user = userData;
    next();
  } catch (error) {
    return next(BaseError.UnauthorizedError());
  }
}
