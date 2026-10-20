import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import { DEFAULT_WORKSPACE_SLUG } from "../utils/workspace.js";

function issueToken(user) {
  return jwt.sign({ sub: user._id.toString() }, config.jwtSecret, { expiresIn: "7d" });
}

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    workspace: user.workspace,
  };
}

export async function register(req, res) {
  const { name, email, password } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) {
    return res.status(400).json({ message: "Your name must be between 2 and 80 characters." });
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }
  if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({ message: "Password must be at least 8 characters and no more than 72 UTF-8 bytes." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail })) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }
  const workspace = await Workspace.findOne({ slug: DEFAULT_WORKSPACE_SLUG });
  if (!workspace) throw new Error("The default workspace has not been initialized.");

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 12),
    workspace: workspace._id,
  });
  await Workspace.updateOne({ _id: workspace._id }, { $addToSet: { members: user._id } });
  return res.status(201).json({ token: issueToken(user), user: serializeUser(user) });
}

export async function login(req, res) {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({ message: "Enter a valid email and password." });
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: "Email or password is incorrect." });
  }
  return res.json({ token: issueToken(user), user: serializeUser(user) });
}

export async function me(req, res) {
  const [workspace, members] = await Promise.all([
    Workspace.findById(req.user.workspace).select("name slug description"),
    User.find({ workspace: req.user.workspace }).select("_id name title role").sort({ name: 1 }).lean(),
  ]);
  return res.json({ user: serializeUser(req.user), workspace, members });
}
