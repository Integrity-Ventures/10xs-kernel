/**
 * 10xs Governance Kernel — Project Model Schema (v4.0)
 *
 * Canonical machine representation of a project.
 * All downstream artifacts (PRD, Blueprint, Microtasks) are generated from this model.
 *
 * @module 10xs/kernel-runtime/schemas
 */

import { z } from "zod";
import { ExecutionProfileV1Schema } from "./execution-profile";

export const EXECUTION_MODEL_TYPES = [
  "build_system",
  "run_system",
  "pipeline_system",
  "knowledge_system",
] as const;

export type ExecutionModelType = typeof EXECUTION_MODEL_TYPES[number];

/**
 * DECOMP-FID-01: Brownfield vs greenfield classification tiers.
 * Drives decompose generator verb selection ("Create new" vs "Integrate with existing").
 */
export const PROJECT_TYPE_TIERS = [
  "greenfield",
  "brownfield",
  "mixed",
] as const;

export type ProjectTypeTier = typeof PROJECT_TYPE_TIERS[number];

/**
 * DECOMP-FID-02: Refinement constraints extracted from refined PRD text.
 * denyList = technologies the user explicitly rejected.
 * reuseList = existing systems the user wants to integrate with, not recreate.
 * Ready for FID-03 to inject into decompose prompts.
 */
export const RefinementConstraintsSchema = z.object({
  denyList: z.array(z.string()).max(10),
  reuseList: z.array(z.string()).max(10),
  rationale: z.string(),
});

export type RefinementConstraints = z.infer<typeof RefinementConstraintsSchema>;

/**
 * DECOMP-FID-07 (SLEG M4): Infrastructure-as-Code tool selection.
 * Drives decompose prompt injection so all infra microtasks emit files
 * with matching extensions (.tf / .yaml / .ts). "none" = no IaC at all.
 */
export const IAC_TOOLS = [
  "sam",
  "cdk",
  "terraform",
  "cloudformation",
  "none",
] as const;

export type IacTool = typeof IAC_TOOLS[number];

export const PROJECT_TYPES = [
  "software_product",
  "internal_operating_system",
  "infrastructure",
  "hardware",
  "research",
  "community_project",
  "operations",
  "marketing_os",
] as const;

export const ProjectModelSchema = z.object({
  project_id: z.string().min(1),
  project_type: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  subsystems: z.array(z.string()).min(1),
  artifacts: z.array(z.string()).min(1),
  /** @deprecated Use execution_profile.workflow_patterns instead (DC-01) */
  execution_loop: z.string().optional(),
  components: z.array(z.string()).optional(),
  vendors: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  execution_profile: ExecutionProfileV1Schema.optional(),
  execution_model_type: z.enum(EXECUTION_MODEL_TYPES).optional(),
  /** DECOMP-FID-01: Optional (legacy records predate this field). Drives decompose verb selection. */
  detected_project_type: z.enum(PROJECT_TYPE_TIERS).optional(),
  /** DECOMP-FID-02: Optional (legacy records predate this field). Drives decompose constraint injection. */
  refinement_constraints: RefinementConstraintsSchema.optional(),
  /** DECOMP-FID-07: Optional (legacy records predate this field). Drives IaC-aware file extensions in decompose. */
  iac_tool: z.enum(IAC_TOOLS).optional(),
});

export type ProjectModel = z.infer<typeof ProjectModelSchema>;
