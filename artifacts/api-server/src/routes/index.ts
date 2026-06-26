import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import procesosRouter from "./procesos";
import etapasRouter from "./etapas";
import checklistRouter from "./checklist";
import chatRouter from "./chat";
import notificacionesRouter from "./notificaciones";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(procesosRouter);
router.use(etapasRouter);
router.use(checklistRouter);
router.use(chatRouter);
router.use(notificacionesRouter);
router.use(adminRouter);

export default router;
