import { WebSocketServer, WebSocket } from "ws";
import { socketMessageSchema } from "../utils/validators/socket.schema.js";
import { prisma } from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

interface Client {
  socket: WebSocket;
  roomCode?: string;
  socketId: string;
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

          // remove session from DB
          await prisma.session.deleteMany({
            where: { socketId: client.socketId },
          });

          this.clients.delete(ws);
        }
      });
    });
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

  // ✅ VALIDATION + DB SYNC
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

    const client = this.clients.get(ws);
    if (!client) return;

    client.roomCode = roomCode;

    // create session in DB
    await prisma.session.create({
      data: {
        roomId: room.id,
        socketId: client.socketId,
      },
    });

    ws.send(JSON.stringify({ type: "joined", roomCode }));
    
    // Notify others in the room to initiate the WebRTC offer
    this.broadcastToRoom(ws, { type: "peer-joined" });
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
