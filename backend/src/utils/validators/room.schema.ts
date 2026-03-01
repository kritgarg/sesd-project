import { z } from "zod";

export const joinRoomSchema = z.object({
  code: z.string().min(4).max(10),
});
