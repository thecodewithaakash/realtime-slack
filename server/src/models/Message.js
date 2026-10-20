import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true, maxlength: 8 },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 4000 },
    reactions: { type: [reactionSchema], default: [] },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

messageSchema.index({ channel: 1, createdAt: -1, _id: -1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
