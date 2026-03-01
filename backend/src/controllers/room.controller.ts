import { Request, Response } from "express";
import { RoomService } from "../services/room.service.js";
import { joinRoomSchema } from "../utils/validators/room.schema.js";

const roomService = new RoomService();

export class RoomController {
  async createRoom(req: Request, res: Response): Promise<void> {
    try {
      const room = await roomService.createRoom();
      res.json(room);
    } catch (err) {
      res.status(500).json({ error: "Failed to create room" });
    }
  }

  async joinRoom(req: Request, res: Response): Promise<any> {
    try {
      const parsed = joinRoomSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.flatten(),
        });
      }

      const { code } = parsed.data;

      const room = await roomService.joinRoom(code);
      res.json(room);
    } catch (err) {
      res.status(404).json({ error: "Room not found or expired" });
    }
  }
}
