import { Router } from "express";
import { RoomController } from "../controllers/room.controller.js";

const router = Router();
const controller = new RoomController();

router.post("/create", controller.createRoom);
router.post("/join", controller.joinRoom);

export default router;
