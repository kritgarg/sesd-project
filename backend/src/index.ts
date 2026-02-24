import express from "express";
import cors from "cors";
import { prisma } from "./config/db.js";


const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.send("Server is running 🚀");
});


app.get("/test-db", async (req, res) => {
  const rooms = await prisma.room.findMany();
  res.json(rooms);
});
const PORT = 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
