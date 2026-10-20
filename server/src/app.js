import cors from "cors";
import express from "express";
import authRoutes from "./routes/authRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import config from "./config/config.js";


const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: "32kb" }));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api", workspaceRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
