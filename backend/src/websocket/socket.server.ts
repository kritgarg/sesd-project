import { WebSocketServer, WebSocket } from "ws";
import { socketMessageSchema } from "../utils/validators/socket.schema.js";
import { prisma } from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

interface Client {
  socket: WebSocket;
  roomCode?: string;
  socketId: string;
  role?: "sender" | "receiver";
}

export class SocketServer {
  private wss: WebSocketServer;
  private clients = new Map<WebSocket, Client>();

  constructor(server: any) {
    this.wss = new WebSocketServer({ server });

    this.wss.on("connection", (ws) => {
      const socketId = uuidv4();

      console.log("Client connected:", socketId);

      this.clients.set(ws, { socket: ws, socketId });

      ws.on("message", async (message) => {
        try {
          const parsed = socketMessageSchema.safeParse(
            JSON.parse(message.toString())
          );

          if (!parsed.success) {
            return ws.send(
              JSON.stringify({ error: "Invalid message format" })
            );
          }

          await this.handleMessage(ws, parsed.data);
        } catch (err) {
          console.error("WS Error:", err);
        }
      });

      ws.on("close", async () => {
        const client = this.clients.get(ws);
        if (client) {
          console.log("Client disconnected:", client.socketId);

          // Notify peer that they disconnected
          if (client.roomCode) {
            this.broadcastToRoom(ws, {
              type: "peer-disconnected",
            });
          }

          // remove session from DB
          await prisma.session.deleteMany({
            where: { socketId: client.socketId },
          });

          this.clients.delete(ws);
        }
      });
    });
  }

  // Count how many clients are in a given room
  private getRoomCount(roomCode: string): number {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.roomCode === roomCode) count++;
    });
    return count;
  }

  private async handleMessage(ws: WebSocket, data: any) {
    switch (data.type) {
      case "join-room":
        await this.joinRoom(ws, data.roomCode);
        break;

      case "offer":
      case "answer":
      case "ice-candidate":
        this.broadcastToRoom(ws, data);
        break;
    }
  }

  // ✅ VALIDATION + DB SYNC + 2-USER LIMIT + ROLE ASSIGNMENT
  private async joinRoom(ws: WebSocket, roomCode: string) {
    const room = await prisma.room.findUnique({
      where: { code: roomCode },
    });

    if (!room) {
      return ws.send(JSON.stringify({ error: "Room not found" }));
    }

    if (room.expiresAt && new Date() > room.expiresAt) {
      return ws.send(JSON.stringify({ error: "Room expired" }));
    }

    // ── 2-user limit ──────────────────────────────────────────
    const currentCount = this.getRoomCount(roomCode);
    if (currentCount >= 2) {
      return ws.send(
        JSON.stringify({ type: "room-full", error: "Room is full (max 2 users)" })
      );
    }

    const client = this.clients.get(ws);
    if (!client) return;

    client.roomCode = roomCode;

    // ── Role assignment ───────────────────────────────────────
    // Assign opposite of whoever is already in the room.
    // If nobody is here, default to "sender" (room creator).
    let assignedRole: "sender" | "receiver" = "sender";

    for (const [, c] of this.clients) {
      if (c.roomCode === roomCode && c.socket !== ws && c.role) {
        assignedRole = c.role === "sender" ? "receiver" : "sender";
        break;
      }
    }

    client.role = assignedRole;

    // create session in DB
    await prisma.session.create({
      data: {
        roomId: room.id,
        socketId: client.socketId,
      },
    });

    // Tell this client their role
    ws.send(
      JSON.stringify({
        type: "role-assigned",
        role: assignedRole,
        roomCode,
      })
    );

    // If this is the receiver joining, notify the sender to create offer
    if (assignedRole === "receiver") {
      this.broadcastToRoom(ws, { type: "peer-joined" });
    }
  }

  private broadcastToRoom(sender: WebSocket, data: any) {
    const senderClient = this.clients.get(sender);
    if (!senderClient?.roomCode) return;

    this.clients.forEach((client, ws) => {
      if (
        ws !== sender &&
        client.roomCode === senderClient.roomCode
      ) {
        ws.send(JSON.stringify(data));
      }
    });
  }
}
