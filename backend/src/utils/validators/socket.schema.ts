import { z } from "zod";

export const socketMessageSchema = z.object({
  type: z.enum(["join-room", "offer", "answer", "ice-candidate"]),
  roomCode: z.string().optional(),
  payload: z.any().optional(),
});
