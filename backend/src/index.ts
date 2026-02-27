import express from "express";
import roomRoutes from "./routes/room.routes.js";
import cors from "cors";


const app = express();

app.use(cors());
app.use(express.json());

app.use("/room", roomRoutes);

app.get("/health", (req, res) => {
  res.send("Server is running 🚀");
});



const PORT = 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
