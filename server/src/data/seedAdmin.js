import bcrypt from "bcryptjs";
import config from "../config/config.js";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";

export function validateAdminSeedConfig({ adminEmail, adminPassword }) {
  if (!adminEmail && !adminPassword) return false;
  if (!adminEmail || !adminPassword) {
    throw new Error("Set both ADMIN_EMAIL and ADMIN_PASSWORD, or leave both blank to disable workspace-owner seeding.");
  }

  const passwordBytes = Buffer.byteLength(adminPassword, "utf8");
  if (adminPassword.length < 8 || passwordBytes > 72) {
    throw new Error(`ADMIN_PASSWORD must be at least 8 characters and no more than 72 UTF-8 bytes for workspace-owner seeding (currently ${adminPassword.length} characters, ${passwordBytes} bytes). Update server/.env, or leave both admin variables blank to skip seeding.`);
  }

  const email = adminEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_EMAIL must be a valid email address.");
  }
  return true;
}

export async function seedAdmin() {
  const { adminEmail, adminPassword, adminName } = config;
  if (!validateAdminSeedConfig({ adminEmail, adminPassword })) return;
  const email = adminEmail.trim().toLowerCase();
  if (await User.exists({ email })) return;
  const workspace = await Workspace.findOne({ slug: "the-good-place" });
  if (!workspace) throw new Error("The default workspace has not been initialized.");

  const owner = await User.create({
    name: adminName.trim(),
    email,
    passwordHash: await bcrypt.hash(adminPassword, 12),
    role: "admin",
    workspace: workspace._id,
  });
  await Workspace.updateOne(
    { _id: workspace._id },
    { $set: { owner: owner._id }, $addToSet: { members: owner._id } },
  );
  console.log(`Created initial workspace owner ${email}.`);
}
