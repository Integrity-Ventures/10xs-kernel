/**
 * 10xs Governance Kernel — Project Model Version Record (v4.0)
 *
 * Versioning metadata lives OUTSIDE the model per CTO directive.
 *
 * @module 10xs/kernel-runtime/schemas
 */

import { z } from "zod";
import { ProjectModelSchema } from "./project-model";

const VERSION_SOURCES = [
  "initial_generation",
  "refinement",
  "migration",
] as const;

export const ProjectModelVersionSchema = z.object({
  project_id: z.string().min(1),
  version: z.number().int().positive(),
  model_json: ProjectModelSchema,
  created_at: z.string().datetime(),
  source: z.enum(VERSION_SOURCES),
});

export type ProjectModelVersion = z.infer<typeof ProjectModelVersionSchema>;
