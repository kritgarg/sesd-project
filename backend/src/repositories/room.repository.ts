import { prisma } from "../config/db.js";

export class RoomRepository {
  async createRoom(code: string) {
    return prisma.room.create({
      data: { code },
    });
  }

  async findByCode(code: string) {
    return prisma.room.findUnique({
      where: { code },
    });
  }
}
