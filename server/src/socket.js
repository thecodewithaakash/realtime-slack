import jwt from "jsonwebtoken";
import config from "./config/config.js";
import Message from "./models/Message.js";
import User from "./models/User.js";
import { findUserChannel } from "./utils/workspace.js";

export function channelRoom(channelId) {
  return `channel:${channelId}`;
}

function workspaceRoom(workspaceId) {
  return `workspace:${workspaceId}`;
}

export function configureSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string") return next(new Error("Sign in to connect."));
      const payload = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(payload.sub).select("_id name email role workspace title");
      if (!user) return next(new Error("Your account is no longer available."));
      socket.data.user = user;
      return next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        return next(new Error("Your session expired. Sign in again to reconnect."));
      }
      return next(error);
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user;
    const userId = user._id.toString();
    const spaceId = user.workspace.toString();
    const space = workspaceRoom(spaceId);
    socket.join(space);

    const alreadyOnline = (await io.in(space).fetchSockets()).some(
      (connected) => connected.id !== socket.id && connected.data.user._id.toString() === userId,
    );
    if (!alreadyOnline) io.to(space).emit("presence:update", { userId, status: "online" });
    const currentSockets = await io.in(space).fetchSockets();
    const onlineIds = [...new Set(currentSockets.map((connected) => connected.data.user._id.toString()))];
    socket.emit("presence:list", onlineIds);

    socket.on("channel:join", async (channelId, acknowledge = () => {}) => {
      try {
        if (typeof channelId !== "string" || !(await findUserChannel(channelId, user.workspace))) {
          return acknowledge({ error: "You can only join channels in your workspace." });
        }
        if (socket.data.activeChannel) socket.leave(channelRoom(socket.data.activeChannel));
        socket.join(channelRoom(channelId));
        socket.data.activeChannel = channelId;
        return acknowledge({ ok: true });
      } catch (error) {
        console.error("Socket channel join failed:", error);
        return acknowledge({ error: "Could not join the channel. Please try again." });
      }
    });

    socket.on("message:send", async (payload, acknowledge = () => {}) => {
      const now = Date.now();
      const rate = socket.data.messageRate ?? { start: now, count: 0 };
      if (now - rate.start >= 5000) {
        rate.start = now;
        rate.count = 0;
      }
      rate.count += 1;
      socket.data.messageRate = rate;
      if (rate.count > 12) return acknowledge({ error: "You’re sending messages too quickly. Take a moment and try again." });

      try {
        const { channelId, content } = payload ?? {};
        if (!socket.rooms.has(channelRoom(channelId)) || socket.data.activeChannel !== channelId) {
          return acknowledge({ error: "Join this channel before sending a message." });
        }
        if (typeof content !== "string" || !content.trim() || content.trim().length > 4000) {
          return acknowledge({ error: "Messages must be between 1 and 4,000 characters." });
        }
        if (!(await findUserChannel(channelId, user.workspace))) {
          return acknowledge({ error: "This channel isn't in your workspace." });
        }
        const message = await Message.create({
          channel: channelId,
          author: user._id,
          content: content.trim(),
        });
        const populated = await Message.findById(message._id)
          .populate("author", "_id name title role")
          .lean();
        io.to(channelRoom(channelId)).emit("message:new", populated);
        return acknowledge({ ok: true, message: populated });
      } catch (error) {
        console.error("Socket message send failed:", error);
        return acknowledge({ error: "Your message could not be sent. Please try again." });
      }
    });

    socket.on("typing:start", (channelId) => {
      if (socket.rooms.has(channelRoom(channelId)) && socket.data.activeChannel === channelId) {
        socket.to(channelRoom(channelId)).emit("typing:update", { channelId, userId, name: user.name, typing: true });
      }
    });

    socket.on("typing:stop", (channelId) => {
      if (socket.rooms.has(channelRoom(channelId)) && socket.data.activeChannel === channelId) {
        socket.to(channelRoom(channelId)).emit("typing:update", { channelId, userId, name: user.name, typing: false });
      }
    });

    socket.on("disconnect", async () => {
      try {
        const stillOnline = (await io.in(space).fetchSockets()).some(
          (connected) => connected.data.user._id.toString() === userId,
        );
        if (!stillOnline) io.to(space).emit("presence:update", { userId, status: "offline" });
      } catch (error) {
        console.error("Socket presence cleanup failed:", error);
      }
    });
  });
}
