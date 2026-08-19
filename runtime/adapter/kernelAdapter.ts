/**
 * 10xs Governance Kernel — Adapter
 *
 * This is the ONLY public interface to kernel governance rules.
 * All engine code must consume constraints through this adapter.
 *
 * Architecture: Core Rules -> (Profile Rules) -> (Org Extensions) -> Resolved Contract
 * For MT-017: Only core rules are active. Resolution mechanism exists for future layers.
 *
 * Rules are loaded from kernel-spec/ YAML files, NOT hardcoded in TypeScript.
 *
 * @module 10xs/kernel-runtime/adapter
 */

import { loadYamlSpec } from "../loader";
import {
  getVersionMetadata,
  type VersionMetadata,
} from "../version/kernelVersion";

/** Constraint ranges for each execution unit type */
export interface ExecutionUnitConstraints {
  minHours: number;
  maxHours: number;
  maxFiles: number;
  maxDependencies: number;
  requiresTestingStrategy: boolean;
  requiresImplementationNotes: boolean;
  enforcementMode: "warn" | "block";
}

/** Decomposition policy configuration */
export interface DecompositionPolicy {
  hierarchy: readonly string[];
  maxDepth: number;
  maxChildrenPerParent: number;
  requiresDependencyMapping: boolean;
}

/**
 * MT-20260712_02: scale-aware tolerance for the `hour_overbudget` WARNING.
 * A Phase-2 total above `phase1Estimate * ceiling` means Phase 1's estimate is
 * suspect and a human should look. It is NEVER used to scale hours down.
 */
export interface BudgetPolicy {
  ceilingByScale: Record<string, number>;
}

/** Complete core rules structure */
export interface CoreRulesDefinition {
  microtask: ExecutionUnitConstraints;
  story: Omit<ExecutionUnitConstraints, "maxFiles"> & { maxMicrotasks: number };
  epic: Omit<ExecutionUnitConstraints, "maxFiles"> & { maxStories: number };
  budget: BudgetPolicy;
  decomposition: DecompositionPolicy;
}

/** Optional rule layer for future profile/org extensions */
export type RuleOverrides = {
  [K in keyof CoreRulesDefinition]?: Partial<CoreRulesDefinition[K]>;
};

/** Options for rule resolution */
export interface ResolveOptions {
  profileRules?: RuleOverrides;
  orgExtensions?: RuleOverrides;
}

/** The resolved execution contract — the ONLY thing engine code should reference */
export type ExecutionContract = CoreRulesDefinition;

/** Instruction template structure */
export interface InstructionTemplate {
  sections: string[];
  requiredFields: string[];
  format: string;
}

/** Cache for loaded core rules (load once from YAML, reuse) */
let _cachedRules: CoreRulesDefinition | null = null;

/** Load core rules from YAML spec (cached) */
function getCoreRules(): CoreRulesDefinition {
  if (!_cachedRules) {
    _cachedRules = loadYamlSpec<CoreRulesDefinition>("rules/core.yaml");
  }
  return _cachedRules;
}

/**
 * Deep merge a base rule set with an optional override layer.
 * Override values replace base values at the leaf level.
 */
function mergeRuleLayer(
  base: CoreRulesDefinition,
  overrides?: RuleOverrides
): CoreRulesDefinition {
  if (!overrides) return base;

  return {
    microtask: { ...base.microtask, ...overrides.microtask },
    story: { ...base.story, ...overrides.story },
    epic: { ...base.epic, ...overrides.epic },
    budget: { ...base.budget, ...overrides.budget },
    decomposition: { ...base.decomposition, ...overrides.decomposition },
  } as CoreRulesDefinition;
}

/**
 * Resolve the execution contract through layered rule merging.
 * Resolution order: Core -> Profile -> Organization
 */
export function resolveExecutionContract(
  options?: ResolveOptions
): ExecutionContract {
  let resolved: CoreRulesDefinition = { ...getCoreRules() };
  resolved = mergeRuleLayer(resolved, options?.profileRules);
  resolved = mergeRuleLayer(resolved, options?.orgExtensions);
  return resolved;
}

// ============================================================================
// CTO-MANDATED PUBLIC API (Primary Directive Section 4)
// ============================================================================

/** Get constraints for a specific execution unit type */
export function getExecutionUnitConstraints(
  type: "microtask",
  options?: ResolveOptions
): CoreRulesDefinition["microtask"];
export function getExecutionUnitConstraints(
  type: "story",
  options?: ResolveOptions
): CoreRulesDefinition["story"];
export function getExecutionUnitConstraints(
  type: "epic",
  options?: ResolveOptions
): CoreRulesDefinition["epic"];
export function getExecutionUnitConstraints(
  type: "microtask" | "story" | "epic",
  options?: ResolveOptions
): CoreRulesDefinition[keyof Omit<CoreRulesDefinition, "decomposition">] {
  const contract = resolveExecutionContract(options);
  return contract[type];
}

/** Get the instruction template structure for a given type */
export function getInstructionTemplate(
  type: "microtask_v1"
): InstructionTemplate {
  const templates: Record<string, InstructionTemplate> = {
    microtask_v1: {
      sections: [
        "objective",
        "inputs",
        "outputs",
        "constraints",
        "acceptance_criteria",
        "testing_strategy",
      ],
      requiredFields: ["objective", "acceptance_criteria", "testing_strategy"],
      format: "markdown",
    },
  };
  return templates[type] ?? templates["microtask_v1"];
}

/** Get the decomposition policy for a given hierarchy type */
export function getDecompositionPolicy(
  type: "agile_hierarchy_v2",
  options?: ResolveOptions
): DecompositionPolicy {
  const contract = resolveExecutionContract(options);
  return contract.decomposition;
}

/**
 * MT-20260712_02: scale-aware budget ceiling from the kernel spec. WARNING
 * THRESHOLD ONLY — it must never scale hours down (the clamp it once fed was
 * deleted for silently deleting real work). Unknown scale → 1.
 */
export function getBudgetCeiling(scale: string, options?: ResolveOptions): number {
  const ceilings = resolveExecutionContract(options).budget?.ceilingByScale ?? {};
  return typeof ceilings[scale] === "number" ? ceilings[scale] : 1;
}

/** Get current kernel version */
export function getKernelVersion(): VersionMetadata {
  return getVersionMetadata();
}

/** Get the current enforcement mode from kernel spec */
export function getEnforcementMode(
  options?: ResolveOptions,
): "warn" | "block" {
  const contract = resolveExecutionContract(options);
  return contract.microtask.enforcementMode;
}
