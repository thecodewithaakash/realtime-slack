import { Router } from "express";
import { listMembers, updateMemberRole } from "../controllers/adminController.js";
import { createChannel, listChannels } from "../controllers/channelController.js";
import { deleteMessage, editMessage, listMessages, searchMessages, toggleReaction } from "../controllers/messageController.js";
import { suggestReply, summarizeConversation } from "../controllers/aiController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/channels", requireAuth, listChannels);
router.post("/channels", requireAuth, createChannel);
router.get("/admin/members", requireAuth, requireAdmin, listMembers);
router.patch("/admin/members/:memberId/role", requireAuth, requireAdmin, updateMemberRole);
router.get("/channels/:channelId/messages", requireAuth, listMessages);
router.get("/messages/search", requireAuth, searchMessages);
router.patch("/messages/:messageId", requireAuth, editMessage);
router.delete("/messages/:messageId", requireAuth, deleteMessage);
router.put("/messages/:messageId/reactions", requireAuth, toggleReaction);
router.post("/channels/:channelId/ai/summary", requireAuth, summarizeConversation);
router.post("/channels/:channelId/ai/suggestion", requireAuth, suggestReply);

export default router;
