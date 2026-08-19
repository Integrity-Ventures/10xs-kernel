/**
 * ExecutionContract V1 — Per-microtask execution agreement
 *
 * Blueprint v3.5 §3.2: Versioned contract linking governance rules
 * to individual microtask execution, with validation tracking.
 *
 * Conceptually distinct from v3.4 ExecutionContract (= CoreRulesDefinition).
 *
 * @module 10xs/kernel-runtime/schemas/execution-contract
 */

import { z } from "zod";

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

/** Governance compliance validation result */
export const ValidationResultSchema = z.object({
  result: z
    .enum(["not_submitted", "pass", "warn", "fail"])
    .default("not_submitted"),
  violations: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
        actual: z.number(),
        limit: z.number(),
      }),
    )
    .default([]),
  warnings: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
      }),
    )
    .default([]),
  validatedAt: z.string().nullable().default(null),
});

/** Reporting template — filled during/after execution */
export const ReportingTemplateSchema = z.object({
  filesModified: z.array(z.string()).default([]),
  linesAdded: z.number().default(0),
  linesRemoved: z.number().default(0),
  timeSpentHours: z.number().default(0),
  testsAdded: z.number().default(0),
  riskNotes: z.string().default(""),
  complianceDeclaration: z.string().default(""),
});

/** Contract definition — scope & constraints */
export const ContractDefinitionSchema = z.object({
  scopeSummary: z.string().min(1),
  allowedBoundaries: z.array(z.string()).default([]),
  requiredTests: z.array(z.string()).default([]),
  namingConstraints: z.array(z.string()).default([]),
  acceptanceChecklist: z.array(z.string()).min(1),
  enforcementSummary: z.string().min(1),
});

// ============================================================================
// MAIN SCHEMA
// ============================================================================

/** ExecutionContract V1 — per-microtask versioned execution agreement */
export const ExecutionContractV1Schema = z.object({
  executionContractId: z.string().min(1),
  microtaskId: z.string().min(1),
  blueprintVersion: z.literal("3.5"),
  governanceHash: z.string().min(1),
  kernelVersion: z.string().min(1),
  contractHash: z.string().min(1),
  revision: z.number().int().positive().default(1),
  supersedesExecutionContractId: z.string().nullable().default(null),
  definition: ContractDefinitionSchema,
  reportingTemplate: ReportingTemplateSchema,
  validation: ValidationResultSchema,
  createdAt: z.string(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ExecutionContractV1 = z.infer<typeof ExecutionContractV1Schema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type ReportingTemplate = z.infer<typeof ReportingTemplateSchema>;
export type ContractDefinition = z.infer<typeof ContractDefinitionSchema>;
