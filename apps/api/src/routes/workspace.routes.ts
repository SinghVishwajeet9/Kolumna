import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  listWorkspacesForUser,
  createWorkspace,
} from "../repositories/workspace.repo.js";

const router = Router();

const createWorkspaceSchema = z.object({
  name: z.string().min(1),
});

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const workspaces = await listWorkspacesForUser(req.user!.id);
    res.status(200).json(workspaces);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const result = createWorkspaceSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.flatten() });
    }

    const { name } = result.data;
    const slug =
      name.toLowerCase().replace(/\s+/g, "-") +
      "-" +
      Math.random().toString(36).substr(2, 9);

    const workspace = await createWorkspace(req.user!.id, name, slug);
    res.status(201).json(workspace);
  } catch (err) {
    next(err);
  }
});

export default router;
