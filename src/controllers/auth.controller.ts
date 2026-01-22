import type { NextFunction, Request, Response } from "express";

class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    res.json({ message: "register" });
  }

  async login(req: Request, res: Response, next: NextFunction) {
    res.json({ message: "login" });
  }
}
