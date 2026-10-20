import Channel from "../models/Channel.js";

export async function listChannels(req, res) {
  const channels = await Channel.find({ workspace: req.user.workspace })
    .sort({ name: 1 })
    .lean();
  return res.json({ channels });
}

export async function createChannel(req, res) {
  const { name, description = "" } = req.body ?? {};
  if (typeof name !== "string" || !/^[a-zA-Z0-9_-]{2,60}$/.test(name.trim())) {
    return res.status(400).json({ message: "Channel names must be 2–60 letters, numbers, dashes, or underscores." });
  }
  if (typeof description !== "string" || description.length > 200) {
    return res.status(400).json({ message: "Channel descriptions must be 200 characters or fewer." });
  }

  const normalizedName = name.trim().toLowerCase();
  if (await Channel.exists({ workspace: req.user.workspace, name: normalizedName })) {
    return res.status(409).json({ message: "That channel name is already taken." });
  }
  const channel = await Channel.create({
    workspace: req.user.workspace,
    name: normalizedName,
    description: description.trim(),
    createdBy: req.user._id,
  });
  return res.status(201).json({ channel });
}
