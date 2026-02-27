import { Request, Response } from "express";
import { RoomService } from "../services/room.service.js";

const roomService = new RoomService();

export class RoomController {
  async createRoom(req: Request, res: Response) {
    try {
      const room = await roomService.createRoom();
      res.json(room);
    } catch (err) {
      res.status(500).json({ error: "Failed to create room" });
    }
  }

  async joinRoom(req: Request, res: Response) {
    try {
      const { code } = req.body;
      const room = await roomService.joinRoom(code);
      res.json(room);
    } catch (err) {
      res.status(404).json({ error: "Room not found" });
    }
  }
}
