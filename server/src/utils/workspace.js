import Channel from "../models/Channel.js";
import Workspace from "../models/Workspace.js";

export const DEFAULT_WORKSPACE_SLUG = "the-good-place";

export async function findUserChannel(channelId, workspaceId) {
  return Channel.findOne({ _id: channelId, workspace: workspaceId });
}

export async function ensureDefaultWorkspace() {
  let workspace = await Workspace.findOne({ slug: DEFAULT_WORKSPACE_SLUG });
  if (!workspace) {
    workspace = await Workspace.create({
      name: "The Good Place",
      slug: DEFAULT_WORKSPACE_SLUG,
      description: "A friendly little corner of the internet.",
    });
  }

  const initialChannels = [
    { name: "general", description: "A place for the things we all share." },
    { name: "introductions", description: "Say hello and tell us what you are into." },
    { name: "ideas", description: "Half-formed thoughts welcome." },
    { name: "watercooler", description: "The important, unimportant stuff." },
  ];

  for (const { name, description } of initialChannels) {
    await Channel.updateOne(
      { workspace: workspace._id, name },
      { $setOnInsert: { workspace: workspace._id, name, description } },
      { upsert: true, runValidators: true },
    );
  }
  return workspace;
}
