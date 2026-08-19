/**
 * 10xs Governance Kernel — Execution Profile v1 Schema (DC-01)
 *
 * Controlled-vocabulary execution profile for dynamic doctrine generation.
 * 3 domain families, 6 ENUM types, cross-field validation.
 *
 * @module 10xs/kernel-runtime/schemas
 */

import { z } from "zod";

// ── ENUM schemas ──────────────────────────────────────────────

export const DomainFamilySchema = z.enum(["software", "operations", "hardware"]);
export type DomainFamily = z.infer<typeof DomainFamilySchema>;

export const WorkModeSchema = z.enum([
  "specification", "planning", "implementation", "execution",
  "testing", "review", "tracking", "iteration", "release",
  "procurement", "fabrication", "certification", "research",
  "design", "delivery",
]);
export type WorkMode = z.infer<typeof WorkModeSchema>;

export const ArtifactTypeSchema = z.enum([
  "project_model", "prd", "architecture", "workflow", "task_breakdown",
  "tracker", "repo_structure", "playbook", "checklist", "template",
  "calendar", "report", "bom", "schematic", "test_protocol",
  "compliance_doc", "training_material", "contract", "budget", "prototype",
]);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

export const QualityModeSchema = z.enum([
  "correctness", "completeness", "consistency", "testability",
  "deployability", "reviewability", "traceability", "operational_readiness",
  "compliance", "manufacturability", "reliability", "reproducibility",
]);
export type QualityMode = z.infer<typeof QualityModeSchema>;

export const RoleArchetypeSchema = z.enum([
  "architect", "builder", "operator", "reviewer", "owner", "approver", "qa",
  "designer", "researcher", "certifier",
]);
export type RoleArchetype = z.infer<typeof RoleArchetypeSchema>;

export const WorkflowPatternSchema = z.enum([
  "idea_to_plan", "plan_to_task", "backlog_to_microtask", "draft_to_review",
  "execution_to_review", "review_to_iteration", "build_to_test",
  "dev_to_qa", "qa_to_release", "schedule_to_publish",
  "design_to_prototype", "prototype_to_test", "test_to_certification",
  "research_to_publish", "procure_to_assemble", "draft_to_approval",
]);
export type WorkflowPattern = z.infer<typeof WorkflowPatternSchema>;

// ── Extensions ────────────────────────────────────────────────

export const ExecutionProfileExtensionsSchema = z.object({
  context_labels: z.array(z.string().min(1)).max(12).optional(),
  custom_artifacts: z.array(z.string().min(1)).max(12).optional(),
  custom_roles: z.array(z.string().min(1)).max(12).optional(),
  notes: z.string().max(1000).optional(),
});

// ── Main schema ───────────────────────────────────────────────

export const ExecutionProfileV1Schema = z.object({
  version: z.literal("1.0"),
  domain_family: DomainFamilySchema,
  work_modes: z.array(WorkModeSchema).min(3).max(6),
  artifact_types: z.array(ArtifactTypeSchema).min(3).max(8),
  quality_modes: z.array(QualityModeSchema).min(3).max(5),
  role_archetypes: z.array(RoleArchetypeSchema).min(2).max(5),
  workflow_patterns: z.array(WorkflowPatternSchema).min(3).max(6),
  extensions: ExecutionProfileExtensionsSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.domain_family === "software") {
    if (!data.work_modes.includes("implementation"))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Software profiles must include 'implementation' in work_modes", path: ["work_modes"] });
    if (!data.quality_modes.includes("testability"))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Software profiles must include 'testability' in quality_modes", path: ["quality_modes"] });
    if (!data.role_archetypes.includes("builder"))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Software profiles must include 'builder' in role_archetypes", path: ["role_archetypes"] });
  }
  if (data.domain_family === "operations") {
    if (!data.work_modes.includes("execution"))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Operations profiles must include 'execution' in work_modes", path: ["work_modes"] });
    if (!data.quality_modes.includes("reviewability"))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Operations profiles must include 'reviewability' in quality_modes", path: ["quality_modes"] });
    if (!data.role_archetypes.includes("operator"))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Operations profiles must include 'operator' in role_archetypes", path: ["role_archetypes"] });
    if (!data.artifact_types.includes("prd"))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Operations profiles must include 'prd' in artifact_types", path: ["artifact_types"] });
  }
  if (data.domain_family === "hardware") {
    if (!data.work_modes.includes("fabrication"))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Hardware profiles must include 'fabrication' in work_modes", path: ["work_modes"] });
    if (!data.quality_modes.includes("compliance"))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Hardware profiles must include 'compliance' in quality_modes", path: ["quality_modes"] });
    if (!data.role_archetypes.includes("designer"))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Hardware profiles must include 'designer' in role_archetypes", path: ["role_archetypes"] });
    if (!data.artifact_types.includes("bom"))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Hardware profiles must include 'bom' in artifact_types", path: ["artifact_types"] });
  }
});

export type ExecutionProfileV1 = z.infer<typeof ExecutionProfileV1Schema>;
