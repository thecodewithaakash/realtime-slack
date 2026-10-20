import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import config, { validateConfig } from "./config/config.js";
import { connectDatabase } from "./config/db.js";
import { seedAdmin } from "./data/seedAdmin.js";
import { configureSocket } from "./socket.js";
import { ensureDefaultWorkspace } from "./utils/workspace.js";

validateConfig();
await connectDatabase();
await ensureDefaultWorkspace();
await seedAdmin();

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: config.clientOrigin },
  maxHttpBufferSize: 32_768,
});
configureSocket(io);
app.set("io", io);

httpServer.listen(config.port, () => console.log(`Slack AI is listening on http://localhost:${config.port}`));
