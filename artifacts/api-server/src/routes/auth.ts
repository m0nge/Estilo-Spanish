import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usuariosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

const JWT_SECRET = process.env.SESSION_SECRET ?? "intelfon-secret-key-2024";

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const [usuario] = await db.select().from(usuariosTable).where(eq(usuariosTable.email, email));

  if (!usuario || !usuario.activo) {
    res.status(401).json({ error: "Credenciales inválidas" });
    return;
  }

  const valid = await bcrypt.compare(password, usuario.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Credenciales inválidas" });
    return;
  }

  const token = jwt.sign(
    { id: usuario.id, email: usuario.email, rol: usuario.rol },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  req.log.info({ userId: usuario.id }, "User logged in");

  res.json({
    token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      area: usuario.area,
      activo: usuario.activo,
      fechaCreacion: usuario.fechaCreacion,
    },
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    const [usuario] = await db.select().from(usuariosTable).where(eq(usuariosTable.id, decoded.id));

    if (!usuario || !usuario.activo) {
      res.status(401).json({ error: "No autorizado" });
      return;
    }

    res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      area: usuario.area,
      activo: usuario.activo,
      fechaCreacion: usuario.fechaCreacion,
    });
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ message: "Sesión cerrada" });
});

export { JWT_SECRET };
export default router;
