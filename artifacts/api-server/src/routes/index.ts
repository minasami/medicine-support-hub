import { Router, type IRouter } from "express";
import healthRouter from "./health";
import medicinesRouter from "./medicines";
import requestsRouter from "./requests";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";
import uploadsRouter from "./uploads";
import authRouter from "./auth";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(authRouter);
router.use(adminRouter);
router.use(healthRouter);
router.use(medicinesRouter);
router.use(requestsRouter);
router.use(dashboardRouter);
router.use(aiRouter);
router.use(uploadsRouter);

export default router;
