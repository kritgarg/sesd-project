import { PrismaClient } from "../generated/prisma/client.js";

// @ts-ignore: Prisma 7 strictly expects an argument natively sometimes, bypassing constructor type error
export const prisma = new PrismaClient();
