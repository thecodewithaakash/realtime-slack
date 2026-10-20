import mongoose from "mongoose";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";

export async function listMembers(req, res) {
  const [members, workspace] = await Promise.all([
    User.find({ workspace: req.user.workspace })
      .select("_id name email title role createdAt")
      .sort({ name: 1 })
      .lean(),
    Workspace.findById(req.user.workspace).select("owner").lean(),
  ]);
  return res.json({ members, ownerId: workspace?.owner });
}

export async function updateMemberRole(req, res) {
  const { memberId } = req.params;
  const { role } = req.body ?? {};
  if (!mongoose.isValidObjectId(memberId)) return res.status(400).json({ message: "Invalid member ID." });
  if (!["member", "admin"].includes(role)) return res.status(400).json({ message: "Role must be member or admin." });
  if (memberId === req.user._id.toString()) return res.status(400).json({ message: "You cannot change your own role." });

  const member = await User.findOne({ _id: memberId, workspace: req.user.workspace });
  if (!member) return res.status(404).json({ message: "Workspace member not found." });
  const workspace = await Workspace.findById(req.user.workspace).select("owner");
  if (role === "member" && String(workspace?.owner) === memberId) {
    return res.status(409).json({ message: "The workspace owner cannot be demoted." });
  }
  if (member.role === "admin" && role === "member" && await User.countDocuments({ workspace: req.user.workspace, role: "admin" }) <= 1) {
    return res.status(409).json({ message: "The last workspace administrator cannot be demoted." });
  }

  member.role = role;
  await member.save();
  return res.json({
    member: { id: member._id, name: member.name, email: member.email, title: member.title, role: member.role },
  });
}
