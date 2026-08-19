/**
 * 10xs Governance Kernel — Agile Hierarchy Schemas
 *
 * Defines Zod schemas for: Epic -> Story -> Microtask
 * Schemas validate STRUCTURE. Constraint bounds come from ExecutionContract.
 *
 * @module 10xs/kernel-runtime/schemas
 */

import { z } from "zod";
import type { ExecutionContract } from "../adapter/kernelAdapter";
// STRUCTURAL SCHEMAS (no hardcoded constraint values)

/** Base fields for all execution units. `estimatedHours` is deliberately NOT here: it is
 *  REQUIRED on a microtask and OPTIONAL on a story/epic, so it cannot be shared. */
const ExecutionUnitBase = z.object({
  id: z.string().min(1),
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  priority: z.enum(["critical", "high", "medium", "low"]),
  dependencies: z.array(z.string()).default([]),
  status: z.enum(["pending", "in_progress", "completed", "blocked"]).default("pending"),
  /**
   * MT-20260712_02: audit trail for any hour adjustment (`originalHours`). Zod strips
   * unknown keys, so before this field existed every `metadata` set by post-processing
   * was discarded by `Phase2ResultSchema.parse()` and the exported DECOMPOSITION.json
   * carried NO record that hours had been altered. Its presence is what makes a silent
   * alteration impossible: if we touch an estimate, the original survives to export.
   */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * MT-20260712_03 — ONE ESTIMATE, AND THE MICROTASK CARRIES IT.
 *
 * A Phase-1 number guesses ABOUT work not yet enumerated; a Phase-2 number SUMS work
 * that has been. Only the second is an estimate (benchmark: Phase 1 said 292h, the
 * enumerated total was 451h, a human architect 512h). Hours are OBSERVED on microtasks
 * and only ROLL UP: story = sum(microtasks), epic = sum(stories), project = sum(epics).
 *
 * So an UNDECOMPOSED story/epic has NO hours — ABSENT, emphatically not `0`. `0` claims
 * the work is free; absent says nobody has looked. Coercing absent → 0 reintroduces the
 * deleted clamp in a new place.
 */
const OPTIONAL_ROLLED_UP_HOURS = z.number().positive().optional();
export const DispositionSchema = z.enum([
  "discover", "extend", "integrate", "refactor", "replace", "remove", "create",
]);
type Brownfield = {
  disposition: z.infer<typeof DispositionSchema>;
  asBuilt: string[];
  mustNotBreak?: string;
};
const RISKY_DISPOSITIONS = new Set(["refactor", "replace", "remove"]);
const BrownfieldSchema = z.object({
  disposition: DispositionSchema, asBuilt: z.array(z.string()).default([]),
  mustNotBreak: z.string().optional(),
}).superRefine((value: Brownfield, context: z.RefinementCtx) => {
  if (RISKY_DISPOSITIONS.has(value.disposition) && !value.mustNotBreak?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["mustNotBreak"],
      message: `mustNotBreak is required for ${value.disposition}` });
  }
});

/** Microtask — smallest executable unit (2-4h, <=5 files). THE ONLY PLACE HOURS ARE OBSERVED. */
export const MicrotaskSchema = ExecutionUnitBase.extend({
  type: z.literal("microtask"),
  estimatedHours: z.number().positive(), // REQUIRED — Phase 2 looked; this is the observation.
  parentStoryId: z.string().optional(),
  targetFiles: z.array(z.string().min(1)).default([]),
  acceptanceCriteria: z.array(z.string()).min(1),
  testingStrategy: z.string().min(1),
  implementationNotes: z.string().optional(),
  skills: z.array(z.string()).default([]),
  complexity: z.enum(["trivial", "simple", "moderate", "complex"]).default("moderate"),
  governanceTags: z.array(z.string()).default([]),
  riskScore: z.number().min(1).max(5).optional(),
  brownfield: BrownfieldSchema.optional(),
  // v3.5 additions (strictly additive — CTO Decision 2026-02-25)
  currentExecutionContractId: z.string().optional(),
  workflowStatus: z.enum(["backlog", "in_progress", "done"]).default("backlog"),
});

/** Story — value slice (3..8 microtasks; 6-32h band checked AFTER rollup).
 *  `estimatedHours` is ABSENT until decomposed, then = sum(microtasks). */
export const StorySchema = ExecutionUnitBase.extend({
  type: z.literal("story"),
  estimatedHours: OPTIONAL_ROLLED_UP_HOURS,
  parentEpicId: z.string().optional(),
  userValue: z.string().min(1),
  microtasks: z.array(MicrotaskSchema).default([]),
  brownfield: BrownfieldSchema.optional(),
});

/** Epic — domain group (2..5 stories; 12-160h band checked AFTER rollup).
 *  `estimatedHours` is ABSENT until a story is decomposed, then = sum(those that have hours). */
export const EpicSchema = ExecutionUnitBase.extend({
  type: z.literal("epic"),
  estimatedHours: OPTIONAL_ROLLED_UP_HOURS,
  domain: z.string().min(1),
  stories: z.array(StorySchema).default([]),
});

/** Version metadata embedded in results */
const VersionMetadataSchema = z.object({
  kernelVersion: z.string(),
  artifactVersion: z.string(),
  generatorVersion: z.string(),
  generatedAt: z.string(),
});

/**
 * Phase 1 output: Blueprint -> Epics with nested Stories (no microtasks, NO HOURS).
 * `totalEstimatedHours` is OPTIONAL and ABSENT on a fresh result — it appears only once
 * microtasks exist and roll up. A pre-decomposition project has no total; the UI must
 * say so rather than print a confident guess.
 */
export const Phase1ResultSchema = z.object({
  schemaVersion: z.literal("2.0.0"),
  blueprintId: z.string().optional(),
  epics: z.array(EpicSchema),
  metadata: VersionMetadataSchema.extend({
    totalEpics: z.number(),
    totalStories: z.number(),
    totalEstimatedHours: z.number().optional(),
    domainSummary: z.record(z.string(), z.number()),
    asBuiltRef: z.object({ artifactId: z.string(), version: z.number() }).optional(),
    directionRef: z.object({ artifactId: z.string(), version: z.number() }).optional(),
  }),
});

/** Phase 2 output: Stories -> Microtasks for selected stories */
export const Phase2ResultSchema = z.object({
  schemaVersion: z.literal("2.0.0"),
  storyId: z.string(),
  microtasks: z.array(MicrotaskSchema),
  metadata: VersionMetadataSchema.extend({
    totalMicrotasks: z.number(),
    totalEstimatedHours: z.number(),
  }),
});

/** Validation errors keyed by field path */
export interface ContractViolation {
  path: string;
  message: string;
  actual: number;
  limit: number;
}

/** Validate a microtask against the resolved execution contract */
export function validateMicrotaskAgainstContract(
  microtask: z.infer<typeof MicrotaskSchema>,
  contract: ExecutionContract
): ContractViolation[] {
  const violations: ContractViolation[] = [];
  const rules = contract.microtask;

  if (microtask.estimatedHours < rules.minHours) {
    violations.push({
      path: "estimatedHours",
      message: "Below minimum hours",
      actual: microtask.estimatedHours,
      limit: rules.minHours,
    });
  }
  if (microtask.estimatedHours > rules.maxHours) {
    violations.push({
      path: "estimatedHours",
      message: "Exceeds maximum hours",
      actual: microtask.estimatedHours,
      limit: rules.maxHours,
    });
  }
  if (microtask.targetFiles.length > rules.maxFiles) {
    violations.push({
      path: "targetFiles",
      message: "Exceeds file limit",
      actual: microtask.targetFiles.length,
      limit: rules.maxFiles,
    });
  }
  if (microtask.dependencies.length > rules.maxDependencies) {
    violations.push({
      path: "dependencies",
      message: "Exceeds dependency limit",
      actual: microtask.dependencies.length,
      limit: rules.maxDependencies,
    });
  }

  return violations;
}

export type Microtask = z.infer<typeof MicrotaskSchema>;
export type Story = z.infer<typeof StorySchema>;
export type Epic = z.infer<typeof EpicSchema>;
export type Phase1Result = z.infer<typeof Phase1ResultSchema>;
export type Phase2Result = z.infer<typeof Phase2ResultSchema>;
