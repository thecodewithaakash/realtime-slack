import mongoose from "mongoose";
import Channel from "../models/Channel.js";
import Message from "../models/Message.js";
import { channelRoom } from "../socket.js";
import { findUserChannel } from "../utils/workspace.js";

const messageFields = "content channel author reactions editedAt createdAt updatedAt";

export async function listMessages(req, res) {
  const { channelId } = req.params;
  if (!mongoose.isValidObjectId(channelId)) return res.status(400).json({ message: "Invalid channel ID." });
  if (!(await findUserChannel(channelId, req.user.workspace))) {
    return res.status(404).json({ message: "This channel isn't in your workspace." });
  }

  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const filter = { channel: channelId };
  if (req.query.before) {
    if (!mongoose.isValidObjectId(req.query.before)) return res.status(400).json({ message: "Invalid message cursor." });
    filter._id = { $lt: req.query.before };
  }
  const batch = await Message.find(filter)
    .select(messageFields)
    .populate("author", "_id name title role")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = batch.length > limit;
  const messages = batch.slice(0, limit).reverse();
  return res.json({ messages, hasMore });
}

export async function searchMessages(req, res) {
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (query.length < 2) return res.status(400).json({ message: "Search needs at least two characters." });

  const channelIds = await Channel.find({ workspace: req.user.workspace }).distinct("_id");
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const messages = await Message.find({
    channel: { $in: channelIds },
    content: { $regex: escaped, $options: "i" },
  })
    .select(messageFields)
    .populate("author", "_id name title role")
    .populate("channel", "_id name")
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
  return res.json({ messages });
}

export async function editMessage(req, res) {
  if (!mongoose.isValidObjectId(req.params.messageId)) return res.status(400).json({ message: "Invalid message ID." });
  const { content } = req.body ?? {};
  if (typeof content !== "string" || !content.trim() || content.trim().length > 4000) {
    return res.status(400).json({ message: "Messages must be between 1 and 4,000 characters." });
  }
  const message = await Message.findOneAndUpdate(
    { _id: req.params.messageId, author: req.user._id },
    { $set: { content: content.trim(), editedAt: new Date() } },
    { new: true, runValidators: true },
  ).select(messageFields).populate("author", "_id name title role").lean();
  if (!message) return res.status(404).json({ message: "Message not found or you are not its author." });
  req.app.get("io").to(channelRoom(message.channel)).emit("message:update", message);
  return res.json({ message });
}

export async function deleteMessage(req, res) {
  if (!mongoose.isValidObjectId(req.params.messageId)) return res.status(400).json({ message: "Invalid message ID." });
  const message = await Message.findOneAndDelete({
    _id: req.params.messageId,
    author: req.user._id,
  }).select("_id channel");
  if (!message) return res.status(404).json({ message: "Message not found or you are not its author." });
  req.app.get("io").to(channelRoom(message.channel)).emit("message:delete", { id: message._id });
  return res.json({ id: message._id, channelId: message.channel });
}

export async function toggleReaction(req, res) {
  const { messageId } = req.params;
  const { emoji } = req.body ?? {};
  if (!mongoose.isValidObjectId(messageId)) return res.status(400).json({ message: "Invalid message ID." });
  if (typeof emoji !== "string" || !/^(?:👍|❤️|😂|🎉|👀|🙌|✨|✅)$/.test(emoji)) {
    return res.status(400).json({ message: "Choose one of the available reactions." });
  }
  const message = await Message.findById(messageId);
  if (!message) return res.status(404).json({ message: "Message not found." });
  if (!(await findUserChannel(message.channel, req.user.workspace))) {
    return res.status(404).json({ message: "This message isn't in your workspace." });
  }

  let reaction = message.reactions.find((entry) => entry.emoji === emoji);
  if (!reaction) {
    message.reactions.push({ emoji, users: [req.user._id] });
  } else {
    const index = reaction.users.findIndex((id) => id.equals(req.user._id));
    if (index === -1) reaction.users.push(req.user._id);
    else reaction.users.splice(index, 1);
    if (reaction.users.length === 0) message.reactions.splice(message.reactions.indexOf(reaction), 1);
  }
  await message.save();
  const updated = await Message.findById(message._id)
    .select(messageFields)
    .populate("author", "_id name title role")
    .lean();
  req.app.get("io").to(channelRoom(message.channel)).emit("message:update", updated);
  return res.json({ message: updated });
}
