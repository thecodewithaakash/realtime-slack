import mongoose from "mongoose";

const channelSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, lowercase: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 200, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

channelSchema.index({ workspace: 1, name: 1 }, { unique: true });

const Channel = mongoose.model("Channel", channelSchema);
export default Channel;
