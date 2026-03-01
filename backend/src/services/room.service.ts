import { RoomRepository } from "../repositories/room.repository.js";
import { v4 as uuidv4 } from "uuid";

export class RoomService {
  private roomRepo = new RoomRepository();

  generateRoomCode() {
    return uuidv4().slice(0, 6); // short code
  }

  async createRoom() {
    let code = "";
    let exists = true;

    while (exists) {
      code = this.generateRoomCode();
      const room = await this.roomRepo.findByCode(code);
      if (!room) exists = false;
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    return this.roomRepo.createRoom(code, expiresAt);
  }

  async joinRoom(code: string) {
    const room = await this.roomRepo.findByCode(code);

    if (!room) {
      throw new Error("Room not found");
    }

    if (room.expiresAt && new Date() > room.expiresAt) {
      throw new Error("Room expired");
    }

    return room;
  }
}
