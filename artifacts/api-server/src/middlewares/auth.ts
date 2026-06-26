import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../routes/auth";

export interface AuthenticatedRequest extends Request {
  usuario?: { id: number; email: string; rol: string };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; rol: string };
    req.usuario = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.usuario?.rol !== "Admin") {
    res.status(403).json({ error: "Acceso denegado" });
    return;
  }
  next();
}
