import { RoomRepository } from "../repositories/room.repository.js";
import { v4 as uuidv4 } from "uuid";

export class RoomService {
  private roomRepo = new RoomRepository();

  generateRoomCode() {
    return uuidv4().slice(0, 6); // short code
  }

  async createRoom() {
    const code = this.generateRoomCode();
    return this.roomRepo.createRoom(code);
  }

  async joinRoom(code: string) {
    const room = await this.roomRepo.findByCode(code);
    if (!room) {
      throw new Error("Room not found");
    }
    return room;
  }
}
