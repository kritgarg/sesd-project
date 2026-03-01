import { prisma } from "../config/db.js";

export class RoomRepository {
  async createRoom(code: string, expiresAt: Date) {
    return prisma.room.create({
      data: {
        code,
        expiresAt,
      },
    });
  }

  async findByCode(code: string) {
    return prisma.room.findUnique({
      where: { code },
    });
  }
}
