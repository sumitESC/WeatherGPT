import { Router, type IRouter } from "express";
import { chatController } from "../chat/chat.controller";

const router: IRouter = Router();

// Chat endpoint routed to the new modular controller
router.post("/chat", chatController);

export default router;